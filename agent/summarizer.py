"""
DBR Comprehensive Summarization System

This module provides intelligent summarization of Daily Business Reports (DBRs)
using the existing RAG system with hierarchical processing and context management.
Optimized for Gemini 2.5 Flash by using concise, JSON-only prompts, retry/backoff,
and optional stage-specific model selection.
"""

import os
import logging
import asyncio
import time
import random
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import json
import hashlib
import re

from .agent import rag_agent, AgentDependencies
from .providers import get_llm_model
from pydantic_ai import Agent as PydanticAgent
from .db_utils import (
    get_document_chunks, get_document, vector_search,
    get_cached_summary, store_summary, list_document_summaries,
    update_summary_job_status, is_summary_job_cancelled
)
from .tools import vector_search_tool, hybrid_search_tool, VectorSearchInput, HybridSearchInput
from .models import ChunkResult
from .document_classifier import document_classifier, DocumentDomain

logger = logging.getLogger(__name__)

class DBRSummarizer:
    """
    Comprehensive DBR summarization using hierarchical processing
    and RAG-enhanced context retrieval.
    """
    
    def __init__(self, max_context_tokens: int = 32000):
        """
        Initialize the DBR summarizer.
        
        Args:
            max_context_tokens: Maximum tokens to use for context window
        """
        self.max_context_tokens = max_context_tokens
        
        # Token estimation: rough approximation (1 token ≈ 4 characters)
        self.chars_per_token = 4
        
        # Reserve tokens for system prompt and response
        self.reserved_tokens = 2000
        self.available_tokens = max_context_tokens - self.reserved_tokens
    
    async def summarize_dbr(
        self,
        document_id: str,
        include_context: bool = True,
        context_queries: Optional[List[str]] = None,
        summary_type: str = "comprehensive",
        force_regenerate: bool = False,
        job_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive summary of a DBR document.
        
        Args:
            document_id: UUID of the document to summarize
            include_context: Whether to include RAG context from related documents
            context_queries: Specific queries to search for context (auto-generated if None)
            summary_type: Type of summary ("comprehensive", "executive", "financial", "operational")
            force_regenerate: Force regeneration even if cached summary exists
        
        Returns:
            Dictionary containing the summary and metadata
        """
        try:
            # 1. Check for cached summary first (unless forced to regenerate)
            if not force_regenerate:
                logger.info(f"Checking for cached summary: {document_id} ({summary_type})")
                cached_summary = await get_cached_summary(document_id, summary_type)
                if cached_summary:
                    logger.info(f"Found cached summary for document {document_id}")
                    # Convert database format to API format
                    return {
                        "document_id": cached_summary["document_id"],
                        "document_title": "Cached Document",  # We'll get this from doc metadata if needed
                        "summary_type": cached_summary["summary_type"],
                        "generated_at": cached_summary["created_at"],
                        "summary": cached_summary["summary_content"],
                        "domain_classification": cached_summary["domain_classification"],
                        "metadata": {
                            **cached_summary["metadata"],
                            "cached": True,
                            "cache_updated_at": cached_summary["updated_at"]
                        }
                    }
            
            # 2. Get document metadata for fresh generation
            document = await get_document(document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")
            
            logger.info(f"Generating new summary for document: {document.get('title', 'Unknown')}")
            
            # 2. Get all document chunks
            chunks = await get_document_chunks(document_id)
            if not chunks:
                raise ValueError(f"No chunks found for document {document_id}")
            
            # 3. Classify document domain for expert analysis
            logger.info("Classifying document domain for expert-level analysis...")
            domain_classification = await document_classifier.classify_document(
                document, chunks[:5]  # Use first 5 chunks for classification
            )
            logger.info(f"Document classified as {domain_classification.domain.value} "
                       f"(confidence: {domain_classification.confidence:.2f})")
            
            # 4. Get RAG context if requested
            context_info = {}
            if include_context:
                context_info = await self._get_rag_context(
                    document, chunks[:5], context_queries  # Use first 5 chunks for context queries
                )
            
            # 5. Perform hierarchical summarization with domain expertise
            # Update job status with total batches/progress when known
            summary_result = await self._hierarchical_summarize(
                chunks, document, context_info, summary_type, domain_classification,
                job_id=job_id
            )
            
            # 6. Generate final structured summary with domain expertise
            if job_id:
                try:
                    await update_summary_job_status(job_id, "finalizing")
                except Exception:
                    pass
            final_summary = await self._generate_final_summary(
                summary_result, document, context_info, summary_type, domain_classification
            )
            
            # 7. Prepare the response data
            domain_classification_data = {
                "domain": domain_classification.domain.value,
                "domain_name": domain_classification.domain.name.replace('_', ' ').title(),
                "confidence": domain_classification.confidence,
                "reasoning": domain_classification.reasoning,
                "keywords": domain_classification.keywords
            }
            
            metadata = {
                "total_chunks": len(chunks),
                "context_queries_used": len(context_info.get("queries", [])),
                "related_documents": len(context_info.get("related_docs", [])),
                "processing_time": summary_result.get("processing_time", 0),
                "expert_analysis": True,
                "cached": False,
                "cache_saved": False
            }
            
            response_data = {
                "document_id": document_id,
                "document_title": document.get("title", "Unknown"),
                "summary_type": summary_type,
                "generated_at": datetime.utcnow().isoformat(),
                "summary": final_summary,
                "domain_classification": domain_classification_data,
                "metadata": metadata
            }
            
            # 8. Store the summary in cache for future use (sanitize context to JSON-safe)
            def _serialize_chunk_obj(ch: Any) -> Dict[str, Any]:
                if isinstance(ch, dict):
                    return {
                        "chunk_id": ch.get("chunk_id"),
                        "document_id": ch.get("document_id"),
                        "content": ch.get("content"),
                        "score": ch.get("score"),
                        "metadata": ch.get("metadata", {}),
                        "document_title": ch.get("document_title"),
                        "document_source": ch.get("document_source"),
                    }
                # Pydantic model (ChunkResult)
                cid = getattr(ch, "chunk_id", None)
                did = getattr(ch, "document_id", None)
                content = getattr(ch, "content", None)
                score = getattr(ch, "score", None)
                metadata_c = getattr(ch, "metadata", {}) or {}
                dt = getattr(ch, "document_title", None)
                ds = getattr(ch, "document_source", None)
                return {
                    "chunk_id": cid,
                    "document_id": did,
                    "content": content,
                    "score": score,
                    "metadata": metadata_c,
                    "document_title": dt,
                    "document_source": ds,
                }

            safe_context_info = {
                "queries": list(context_info.get("queries", [])),
                "related_docs": list(context_info.get("related_docs", [])),
                "related_chunks": [
                    _serialize_chunk_obj(ch) for ch in context_info.get("related_chunks", [])
                ],
            }
            try:
                cache_ok = await store_summary(
                    document_id=document_id,
                    summary_type=summary_type,
                    domain_classification=domain_classification_data,
                    summary_content=final_summary,
                    context_info=safe_context_info,
                    metadata=metadata
                )
                metadata["cache_saved"] = bool(cache_ok)
                if cache_ok:
                    logger.info(f"Cached summary for document {document_id} ({summary_type})")
                else:
                    logger.warning(f"store_summary returned False for document {document_id} ({summary_type})")
            except Exception as cache_error:
                metadata["cache_saved"] = False
                metadata["cache_error"] = str(cache_error)
                logger.warning(f"Failed to cache summary: {cache_error}")
                # Don't fail the request if caching fails
            
            return response_data
            
        except Exception as e:
            logger.error(f"DBR summarization failed: {e}")
            raise
    
    async def _get_rag_context(
        self,
        document: Dict[str, Any],
        sample_chunks: List[Dict[str, Any]],
        custom_queries: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Get relevant context using RAG searches based on document content.
        """
        context_info = {
            "queries": [],
            "related_docs": [],
            "related_chunks": []
        }
        
        try:
            # Generate context queries if not provided
            queries = custom_queries or await self._generate_context_queries(document, sample_chunks)
            context_info["queries"] = queries
            
            # Perform RAG searches for each query
            all_related_chunks = []
            for query in queries[:3]:  # Limit to 3 queries to control context size
                try:
                    # Use hybrid search for better results
                    search_input = HybridSearchInput(
                        query=query,
                        limit=5,  # Limit results per query
                        document_ids=[document["id"]]  # Exclude current document
                    )
                    
                    chunks = await hybrid_search_tool(search_input)
                    all_related_chunks.extend(chunks)
                    
                    # Track unique related documents
                    for chunk in chunks:
                        doc_id = chunk.document_id
                        if doc_id not in [d["id"] for d in context_info["related_docs"]]:
                            # Get document info
                            related_doc = await get_document(doc_id)
                            if related_doc:
                                context_info["related_docs"].append({
                                    "id": doc_id,
                                    "title": related_doc.get("title", "Unknown"),
                                    "created_at": related_doc.get("created_at")
                                })
                
                except Exception as e:
                    logger.warning(f"Context search failed for query '{query}': {e}")
                    continue
            
            # Deduplicate and limit context chunks
            seen_chunks = set()
            unique_chunks: List[Any] = []
            for chunk in all_related_chunks:
                # Support both pydantic objects (ChunkResult) and dicts
                doc_id = getattr(chunk, 'document_id', None)
                if doc_id is None and isinstance(chunk, dict):
                    doc_id = chunk.get('document_id')

                chunk_id = getattr(chunk, 'chunk_id', None)
                if chunk_id is None and isinstance(chunk, dict):
                    chunk_id = chunk.get('chunk_id')

                # Fallback to content hash when chunk_id is missing
                if not chunk_id:
                    content = getattr(chunk, 'content', None)
                    if content is None and isinstance(chunk, dict):
                        content = chunk.get('content')
                    if content:
                        chunk_id = hashlib.sha1(content.encode('utf-8')).hexdigest()  # stable-ish key
                    else:
                        # As a last resort, use the index in the list
                        chunk_id = f"idx_{len(unique_chunks)}"

                key = f"{doc_id}_{chunk_id}"
                if key not in seen_chunks:
                    seen_chunks.add(key)
                    unique_chunks.append(chunk)
            
            context_info["related_chunks"] = unique_chunks[:10]  # Limit to 10 most relevant
            
        except Exception as e:
            logger.error(f"RAG context retrieval failed: {e}")
        
        return context_info
    
    async def _generate_context_queries(
        self,
        document: Dict[str, Any],
        sample_chunks: List[Dict[str, Any]]
    ) -> List[str]:
        """
        Generate smart context queries based on document content.
        """
        try:
            # Create prompt to generate context queries
            sample_content = "\n".join([
                chunk.get("content", "")[:500]  # First 500 chars of each chunk
                for chunk in sample_chunks[:3]
            ])
            
            prompt = f"""
Based on this Daily Business Report content, generate 3-4 specific search queries
to find related historical reports or relevant context data:

Document Title: {document.get('title', 'Unknown')}
Sample Content:
{sample_content}

Generate queries that would help provide context for:
1. Historical comparison data
2. Related business metrics
3. Industry trends or benchmarks
4. Previous period comparisons

Return only the queries, one per line:
"""
            
            # Use agent for query generation
            deps = AgentDependencies(session_id=f"summary_{document['id']}")
            result = await rag_agent.run(prompt, deps=deps)
            response = result.data
            
            # Parse queries from response
            queries = [
                line.strip().lstrip('1234567890.- ')
                for line in response.split('\n')
                if line.strip() and len(line.strip()) > 10
            ]
            
            return queries[:4]  # Limit to 4 queries
            
        except Exception as e:
            logger.error(f"Context query generation failed: {e}")
            return [
                "historical business performance metrics",
                "quarterly revenue trends and comparisons",
                "operational efficiency indicators"
            ]
    
    async def _hierarchical_summarize(
        self,
        chunks: List[Dict[str, Any]],
        document: Dict[str, Any],
        context_info: Dict[str, Any],
        summary_type: str,
        domain_classification: Optional[Any] = None,
        *,
        job_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Perform hierarchical summarization of document chunks.
        """
        start_time = datetime.utcnow()
        
        # Step 1: Group chunks into manageable batches
        batch_size = self._calculate_batch_size(chunks)
        chunk_batches = [chunks[i:i + batch_size] for i in range(0, len(chunks), batch_size)]
        
        logger.info(f"Processing {len(chunks)} chunks in {len(chunk_batches)} batches")
        # Notify job progress
        if job_id:
            try:
                await update_summary_job_status(job_id, "running", progress=0, total=len(chunk_batches))
            except Exception:
                pass
        
        # Step 2: Summarize each batch with domain expertise (parallelized)
        batch_summaries: List[Dict[str, Any]] = []
        concurrency = int(os.getenv("SUMMARY_CONCURRENCY", "8"))
        sem = asyncio.Semaphore(max(1, concurrency))
        lock = asyncio.Lock()
        completed = 0

        async def process_batch(index: int, batch: List[Dict[str, Any]]):
            nonlocal completed
            async with sem:
                # Cancellation check before starting work on this batch
                if job_id:
                    try:
                        if await is_summary_job_cancelled(job_id):
                            raise RuntimeError("Summary job cancelled")
                    except Exception:
                        pass
                try:
                    result = await self._summarize_batch(
                        batch, document, summary_type, index + 1, domain_classification
                    )
                    async with lock:
                        batch_summaries.append(result)
                        completed += 1
                        if job_id:
                            try:
                                await update_summary_job_status(job_id, "running", progress=completed, total=len(chunk_batches))
                            except Exception:
                                pass
                except Exception as e:
                    logger.error(f"Batch {index + 1} summarization failed: {e}")
                    async with lock:
                        completed += 1
                        if job_id:
                            try:
                                await update_summary_job_status(job_id, "running", progress=completed, total=len(chunk_batches))
                            except Exception:
                                pass

        await asyncio.gather(*[process_batch(i, batch) for i, batch in enumerate(chunk_batches)])
        # Keep deterministic order by batch_number if present
        try:
            batch_summaries.sort(key=lambda x: x.get("batch_number", 0))
        except Exception:
            pass

        processing_time = (datetime.utcnow() - start_time).total_seconds()
        
        return {
            "batch_summaries": batch_summaries,
            "total_batches": len(chunk_batches),
            "successful_batches": len(batch_summaries),
            "processing_time": processing_time
        }
    
    def _calculate_batch_size(self, chunks: List[Dict[str, Any]]) -> int:
        """
        Calculate optimal batch size based on chunk content length.
        """
        if not chunks:
            return 1
        
        # Estimate average chunk size
        sample_size = min(5, len(chunks))
        avg_chunk_size = sum(
            len(chunk.get("content", ""))
            for chunk in chunks[:sample_size]
        ) // sample_size
        
        # Calculate how many chunks fit in available token budget
        avg_tokens_per_chunk = avg_chunk_size // self.chars_per_token
        
        # Reserve space for prompt and summary generation
        tokens_for_content = self.available_tokens // 2
        
        batch_size = max(1, tokens_for_content // avg_tokens_per_chunk)
        return min(batch_size, 25)  # Increased cap to reduce total batches
    
    async def _summarize_batch(
        self,
        batch: List[Dict[str, Any]],
        document: Dict[str, Any],
        summary_type: str,
        batch_number: int,
        domain_classification: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Summarize a batch of chunks.
        """
        # Combine batch content
        batch_content = "\n\n".join([
            f"--- Chunk {i + 1} ---\n{chunk.get('content', '')}"
            for i, chunk in enumerate(batch)
        ])
        
        # Prepare domain-specific summary prompt
        if domain_classification and domain_classification.domain != DocumentDomain.GENERAL:
            # Use expert domain-specific prompt
            prompt = document_classifier.get_domain_expert_prompt(
                domain_classification.domain, summary_type, document
            )
            prompt += (
                f"\n\nDocument Section {batch_number}:\n{batch_content}\n\n"
                "Respond ONLY with a compact JSON object (no markdown code fences, no prose) with keys: "
                "'highlights' (array of brief bullet strings), 'metrics' (object of key:value numeric or short string), "
                "'risks' (array of brief bullet strings), 'summary' (<=120 words)."
            )
        else:
            # Use general prompt
            prompt = self._get_summary_prompt(batch_content, document, summary_type, batch_number)
        
        # Generate summary using agent
        try:
            deps = AgentDependencies(session_id=f"batch_summary_{batch_number}")
            summary = await self._run_llm_with_retry(prompt, stage="batch", deps=deps)
            
            return {
                "batch_number": batch_number,
                "chunk_count": len(batch),
                "summary": summary.strip(),
                "chunk_indices": [chunk.get("chunk_index", i) for i, chunk in enumerate(batch)]
            }
        except Exception as e:
            logger.error(f"Batch summary generation failed: {e}")
            raise
    
    def _get_summary_prompt(
        self,
        content: str,
        document: Dict[str, Any],
        summary_type: str,
        batch_number: int
    ) -> str:
        """
        Generate the appropriate summary prompt based on summary type.
        Optimized for Gemini 2.5 Flash: concise, JSON-only output without code fences.
        """
        doc_title = document.get("title", "Daily Business Report")
        
        base_prompt = (
            f"Analyze and summarize the following section from \"{doc_title}\" (Part {batch_number}):\n\n"
            f"{content}\n\n"
            "Respond ONLY with a compact JSON object (no markdown code fences, no additional text). "
            "Use keys: 'highlights' (array of brief bullets), 'metrics' (object), 'risks' (array), "
            "'summary' (<=120 words)."
        )
        
        if summary_type == "executive":
            return base_prompt + (
                " Focus on outcomes, decisions, and executive insights in 'highlights' and 'summary'."
            )
        
        elif summary_type == "financial":
            return base_prompt + (
                " Emphasize numeric KPIs in 'metrics' (e.g., revenue, costs, margins, variances)."
            )
        
        elif summary_type == "operational":
            return base_prompt + (
                " Emphasize process/throughput/quality indicators in 'metrics' and concise 'risks'."
            )
        
        else:  # comprehensive
            return base_prompt + (
                " Provide balanced coverage across metrics, highlights, and succinct risks."
            )
    
    async def _generate_final_summary(
        self,
        summary_result: Dict[str, Any],
        document: Dict[str, Any],
        context_info: Dict[str, Any],
        summary_type: str,
        domain_classification: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Generate the final comprehensive summary from batch summaries.
        """
        batch_summaries = summary_result.get("batch_summaries", [])
        
        if not batch_summaries:
            raise ValueError("No batch summaries available for final summary generation")
        
        # Combine all batch summaries
        combined_summaries = "\n\n".join([
            f"=== SECTION {batch['batch_number']} ===\n{batch['summary']}"
            for batch in batch_summaries
        ])
        
        # Add context information
        context_section = ""
        if context_info.get("related_chunks"):
            context_content = "\n".join([
                f"- {chunk.content[:200]}..." if len(chunk.content) > 200 else f"- {chunk.content}"
                for chunk in context_info["related_chunks"][:5]
            ])
            context_section = f"\n\nRELATED CONTEXT:\n{context_content}"
        
        # Generate domain-specific final summary prompt (JSON-only, concise)
        if domain_classification and domain_classification.domain != DocumentDomain.GENERAL:
            # Use expert domain-specific final prompt
            domain_name = domain_classification.domain.name.replace('_', ' ').title()
            final_prompt = f"""
You are a senior expert in {domain_classification.domain.value.replace('_', ' ')} providing the final comprehensive analysis.

DOCUMENT: {document.get('title', 'Document')}
DOMAIN: {domain_name} (Confidence: {domain_classification.confidence:.1%})
CLASSIFICATION REASONING: {domain_classification.reasoning}

EXPERT SECTION ANALYSES:
{combined_summaries}

{context_section}

As a domain expert, synthesize these analyses into a comprehensive final summary that demonstrates deep professional expertise in {domain_classification.domain.value.replace('_', ' ')}.

Respond STRICTLY with a single JSON object (no markdown code fences, no extra text) with keys:
- "executive_overview": concise executive summary (<= 180 words)
- "key_metrics": object of KPIs and quantitative findings
- "major_highlights": array of 5-8 concise bullets
- "challenges_and_risks": array of concise bullets
- "opportunities_and_recommendations": array of concise bullets
- "conclusion": brief outlook
"""
        else:
            # Use general prompt
            final_prompt = f"""
Create a comprehensive final summary by synthesizing the following section summaries:

Document: {document.get('title', 'Document')}
Date: {document.get('created_at', 'Unknown')}

SECTION SUMMARIES:
{combined_summaries}

{context_section}

Generate a well-structured final summary and respond STRICTLY with one JSON object (no markdown fences, no extra text) with keys:
- "executive_overview": brief high-level summary (<= 180 words)
- "key_metrics": object of important quantitative data and KPIs
- "major_highlights": 5-8 most important findings (array of strings)
- "challenges_and_risks": key issues identified (array of strings)
- "opportunities_and_recommendations": strategic next steps (array of strings)
- "conclusion": overall outlook
"""
        
        try:
            deps = AgentDependencies(session_id=f"final_summary_{document['id']}")
            final_response = await self._run_llm_with_retry(final_prompt, stage="final", deps=deps)

            # Helper: try to parse loose JSON (strip code fences, isolate outer braces)
            def try_parse_json_loose(s: str):
                if not s:
                    return None
                t = s.strip()
                # Strip markdown code fences
                if t.startswith("```") and t.endswith("```"):
                    t = re.sub(r"^```[a-zA-Z]*\n?", "", t)
                    t = re.sub(r"```$", "", t)
                    t = t.strip()
                # Isolate substring from first '{' to last '}'
                if '{' in t and '}' in t:
                    start = t.find('{')
                    end = t.rfind('}') + 1
                    candidate = t[start:end]
                    try:
                        return json.loads(candidate)
                    except Exception:
                        pass
                # Direct parse attempt
                try:
                    return json.loads(t)
                except Exception:
                    return None

            # First, attempt strict and then loose JSON parsing
            parsed = None
            try:
                parsed = json.loads(final_response)
            except Exception:
                parsed = try_parse_json_loose(final_response)

            if isinstance(parsed, dict):
                return parsed

            # Fallback to text-based summary without hard truncation
            # Executive overview: first paragraph (or first 800 chars), no ellipsis
            text = final_response.strip()
            first_paragraph = text.split("\n\n", 1)[0] if text else ""
            if not first_paragraph:
                first_paragraph = text[:1200]

            return {
                "executive_overview": first_paragraph,
                "full_text": text,
                "format": "text"
            }
                
        except Exception as e:
            logger.error(f"Final summary generation failed: {e}")
            raise


    # Helper methods for model execution with retry/backoff and optional stage-specific models
    def _get_stage_agent(self, stage: str) -> PydanticAgent:
        use_separate = os.getenv("SUMMARY_SEPARATE_MODELS", "0").strip() in {"1", "true", "yes"}
        if not use_separate:
            return rag_agent
        # Lazy-init cached agents
        if not hasattr(self, "_batch_agent"):
            self._batch_agent = None
            self._final_agent = None
        if stage == "batch":
            if self._batch_agent is None:
                model_name = os.getenv("SUMMARY_BATCH_MODEL", os.getenv("LLM_CHOICE", "gemini-2.5-flash"))
                self._batch_agent = PydanticAgent(get_llm_model(model_name), deps_type=AgentDependencies)
            return self._batch_agent
        else:
            if self._final_agent is None:
                model_name = os.getenv("SUMMARY_FINAL_MODEL", os.getenv("LLM_CHOICE", "gemini-2.5-flash"))
                self._final_agent = PydanticAgent(get_llm_model(model_name), deps_type=AgentDependencies)
            return self._final_agent

    async def _run_llm_with_retry(self, prompt: str, stage: str, deps: AgentDependencies, *, max_retries: int = 4) -> str:
        agent = self._get_stage_agent(stage)
        last_err: Optional[Exception] = None
        for attempt in range(max_retries + 1):
            try:
                result = await agent.run(prompt, deps=deps)
                return (result.data or "").strip()
            except Exception as e:
                last_err = e
                # Simple exponential backoff with jitter
                delay = min(20.0, (2 ** attempt) + random.random())
                if attempt >= max_retries:
                    break
                logger.warning(f"LLM call failed (stage={stage}, attempt={attempt+1}/{max_retries}) : {e}. Retrying in {delay:.1f}s")
                await asyncio.sleep(delay)
        raise RuntimeError(f"LLM call failed after retries (stage={stage}): {last_err}")


# Singleton instance for the API
dbr_summarizer = DBRSummarizer()