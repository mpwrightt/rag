"""
DBR Comprehensive Summarization System

This module provides intelligent summarization of Daily Business Reports (DBRs)
using the existing RAG system with hierarchical processing and context management.
"""

import os
import logging
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import json

from .providers import get_llm_model
from .db_utils import get_document_chunks, get_document, vector_search
from .tools import vector_search_tool, hybrid_search_tool, VectorSearchInput, HybridSearchInput
from .models import ChunkResult

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
        self.llm = get_llm_model()
        
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
        summary_type: str = "comprehensive"
    ) -> Dict[str, Any]:
        """
        Generate a comprehensive summary of a DBR document.
        
        Args:
            document_id: UUID of the document to summarize
            include_context: Whether to include RAG context from related documents
            context_queries: Specific queries to search for context (auto-generated if None)
            summary_type: Type of summary ("comprehensive", "executive", "financial", "operational")
        
        Returns:
            Dictionary containing the summary and metadata
        """
        try:
            # 1. Get document metadata
            document = await get_document(document_id)
            if not document:
                raise ValueError(f"Document {document_id} not found")
            
            logger.info(f"Starting DBR summarization for document: {document.get('title', 'Unknown')}")
            
            # 2. Get all document chunks
            chunks = await get_document_chunks(document_id)
            if not chunks:
                raise ValueError(f"No chunks found for document {document_id}")
            
            # 3. Get RAG context if requested
            context_info = {}
            if include_context:
                context_info = await self._get_rag_context(
                    document, chunks[:5], context_queries  # Use first 5 chunks for context queries
                )
            
            # 4. Perform hierarchical summarization
            summary_result = await self._hierarchical_summarize(
                chunks, document, context_info, summary_type
            )
            
            # 5. Generate final structured summary
            final_summary = await self._generate_final_summary(
                summary_result, document, context_info, summary_type
            )
            
            return {
                "document_id": document_id,
                "document_title": document.get("title", "Unknown"),
                "summary_type": summary_type,
                "generated_at": datetime.utcnow().isoformat(),
                "summary": final_summary,
                "metadata": {
                    "total_chunks": len(chunks),
                    "context_queries_used": len(context_info.get("queries", [])),
                    "related_documents": len(context_info.get("related_docs", [])),
                    "processing_time": summary_result.get("processing_time", 0)
                }
            }
            
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
            unique_chunks = []
            for chunk in all_related_chunks:
                chunk_key = f"{chunk.document_id}_{chunk.chunk_index}"
                if chunk_key not in seen_chunks:
                    seen_chunks.add(chunk_key)
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
            
            # Use simple completion for query generation (faster than agent)
            response = await self.llm.complete(prompt)
            
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
        summary_type: str
    ) -> Dict[str, Any]:
        """
        Perform hierarchical summarization of document chunks.
        """
        start_time = datetime.utcnow()
        
        # Step 1: Group chunks into manageable batches
        batch_size = self._calculate_batch_size(chunks)
        chunk_batches = [chunks[i:i + batch_size] for i in range(0, len(chunks), batch_size)]
        
        logger.info(f"Processing {len(chunks)} chunks in {len(chunk_batches)} batches")
        
        # Step 2: Summarize each batch
        batch_summaries = []
        for i, batch in enumerate(chunk_batches):
            try:
                batch_summary = await self._summarize_batch(batch, document, summary_type, i + 1)
                batch_summaries.append(batch_summary)
            except Exception as e:
                logger.error(f"Batch {i + 1} summarization failed: {e}")
                # Continue with other batches
                continue
        
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
        return min(batch_size, 10)  # Cap at 10 chunks per batch
    
    async def _summarize_batch(
        self,
        batch: List[Dict[str, Any]],
        document: Dict[str, Any],
        summary_type: str,
        batch_number: int
    ) -> Dict[str, Any]:
        """
        Summarize a batch of chunks.
        """
        # Combine batch content
        batch_content = "\n\n".join([
            f"--- Chunk {i + 1} ---\n{chunk.get('content', '')}"
            for i, chunk in enumerate(batch)
        ])
        
        # Prepare summary prompt based on type
        prompt = self._get_summary_prompt(batch_content, document, summary_type, batch_number)
        
        # Generate summary
        try:
            summary = await self.llm.complete(prompt)
            
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
        """
        doc_title = document.get("title", "Daily Business Report")
        
        base_prompt = f"""
Analyze and summarize the following section from "{doc_title}" (Part {batch_number}):

{content}

"""
        
        if summary_type == "executive":
            return base_prompt + """
Provide an EXECUTIVE SUMMARY focusing on:
- Key business outcomes and results
- Critical decisions and actions taken
- Strategic implications
- High-level performance indicators
- Executive-level insights and recommendations

Be concise and focus on what executives need to know.
"""
        
        elif summary_type == "financial":
            return base_prompt + """
Provide a FINANCIAL SUMMARY focusing on:
- Revenue, costs, and profit metrics
- Budget performance and variances
- Financial KPIs and ratios
- Cash flow and liquidity indicators
- Investment and capital allocation
- Financial risks and opportunities

Extract and highlight all numerical financial data.
"""
        
        elif summary_type == "operational":
            return base_prompt + """
Provide an OPERATIONAL SUMMARY focusing on:
- Production and delivery metrics
- Process efficiency and quality indicators
- Resource utilization and capacity
- Operational challenges and solutions
- Team performance and productivity
- System and infrastructure status

Emphasize operational performance and process insights.
"""
        
        else:  # comprehensive
            return base_prompt + """
Provide a COMPREHENSIVE SUMMARY covering:
- Key business metrics and performance indicators
- Major events, decisions, and outcomes
- Financial highlights and operational results
- Strategic developments and market insights
- Challenges faced and solutions implemented
- Important trends and patterns identified
- Recommendations and next steps

Be thorough but organized. Structure the summary with clear sections.
"""
    
    async def _generate_final_summary(
        self,
        summary_result: Dict[str, Any],
        document: Dict[str, Any],
        context_info: Dict[str, Any],
        summary_type: str
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
        
        # Generate final summary prompt
        final_prompt = f"""
Create a comprehensive final summary of this Daily Business Report by synthesizing the following section summaries:

Document: {document.get('title', 'Daily Business Report')}
Date: {document.get('created_at', 'Unknown')}

SECTION SUMMARIES:
{combined_summaries}

{context_section}

Generate a well-structured final summary that:
1. Synthesizes key insights from all sections
2. Identifies overarching themes and patterns
3. Highlights critical business metrics and outcomes
4. Provides executive-level conclusions
5. Includes actionable insights and recommendations

Structure the response as a JSON object with these sections:
- "executive_overview": Brief high-level summary (2-3 paragraphs)
- "key_metrics": Important quantitative data and KPIs
- "major_highlights": 3-5 most important findings or events
- "challenges_and_risks": Key issues identified
- "opportunities_and_recommendations": Strategic insights and next steps
- "conclusion": Overall assessment and outlook

Ensure the summary is comprehensive yet concise, suitable for executive review.
"""
        
        try:
            final_response = await self.llm.complete(final_prompt)
            
            # Try to parse as JSON, fallback to structured text
            try:
                summary_json = json.loads(final_response)
                return summary_json
            except json.JSONDecodeError:
                # Fallback to text-based summary
                return {
                    "executive_overview": final_response[:1000] + "..." if len(final_response) > 1000 else final_response,
                    "full_text": final_response,
                    "format": "text"
                }
                
        except Exception as e:
            logger.error(f"Final summary generation failed: {e}")
            raise


# Singleton instance for the API
dbr_summarizer = DBRSummarizer()