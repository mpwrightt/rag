"""
Enhanced Retrieval Pipeline with Full Visibility
Implements comprehensive retrieval with detailed logging and result fusion.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime

from .query_processor import QueryProcessor, ProcessedQuery, QueryIntent
from .tools import (
    vector_search_tool,
    graph_search_tool,
    VectorSearchInput,
    GraphSearchInput
)
from .context import emit_retrieval_event

logger = logging.getLogger(__name__)


@dataclass
class RetrievalStep:
    """Represents a single step in the retrieval process."""
    step_name: str
    timestamp: datetime
    duration_ms: int
    input_data: Dict[str, Any]
    output_data: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RetrievalContext:
    """Complete context for a retrieval operation."""
    session_id: str
    query: ProcessedQuery
    steps: List[RetrievalStep] = field(default_factory=list)
    graph_results: List[Dict] = field(default_factory=list)
    vector_results: List[Dict] = field(default_factory=list)
    reranked_results: List[Dict] = field(default_factory=list)
    final_results: List[Dict] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class EnhancedRetriever:
    """Advanced retrieval system with full transparency."""
    
    def __init__(self):
        self.query_processor = QueryProcessor()
        self.retrieval_history = []
        
    async def retrieve(
        self,
        query: str,
        session_id: str,
        config: Optional[Dict[str, Any]] = None
    ) -> Tuple[List[Dict], RetrievalContext]:
        """
        Execute comprehensive retrieval with full visibility.
        
        Args:
            query: User query
            session_id: Session ID for tracking
            config: Optional configuration parameters
            
        Returns:
            Tuple of (final results, retrieval context with all steps)
        """
        config = config or {}
        start_time = datetime.now()
        
        # Initialize context
        context = RetrievalContext(
            session_id=session_id,
            query=None,  # Will be set after processing
            metadata={
                "config": config,
                "start_time": start_time
            }
        )
        
        try:
            # Step 1: Query Understanding
            await self._emit_step_event(session_id, "query_understanding", "start", {"query": query})
            processed_query = await self._process_query(query, context)
            context.query = processed_query
            await self._emit_step_event(
                session_id, 
                "query_understanding", 
                "complete",
                {
                    "intent": processed_query.intent.value,
                    "entities": len(processed_query.entities),
                    "keywords": processed_query.keywords[:5]
                }
            )
            
            # Step 2: Graph Search
            if config.get("use_graph", True):
                await self._emit_step_event(
                    session_id,
                    "graph_search",
                    "start",
                    {"query": processed_query.graph_query}
                )
                graph_results = await self._execute_graph_search(processed_query, context)
                context.graph_results = graph_results
                await self._emit_step_event(
                    session_id,
                    "graph_search",
                    "complete",
                    {"results": len(graph_results), "sample": graph_results[:2] if graph_results else []}
                )
            
            # Step 3: Vector Search
            if config.get("use_vector", True):
                await self._emit_step_event(
                    session_id,
                    "vector_search",
                    "start",
                    {"query": processed_query.vector_query}
                )
                vector_results = await self._execute_vector_search(processed_query, context, config)
                context.vector_results = vector_results
                await self._emit_step_event(
                    session_id,
                    "vector_search",
                    "complete",
                    {"results": len(vector_results), "top_score": vector_results[0].get("score") if vector_results else 0}
                )
            
            # Step 4: Result Fusion & Reranking
            await self._emit_step_event(session_id, "fusion", "start", {})
            fused_results = await self._fuse_results(context)
            context.reranked_results = fused_results
            await self._emit_step_event(
                session_id,
                "fusion",
                "complete",
                {"fused_count": len(fused_results)}
            )
            
            # Step 5: Diversity & Deduplication
            await self._emit_step_event(session_id, "diversify", "start", {})
            final_results = await self._diversify_results(fused_results, context)
            context.final_results = final_results
            await self._emit_step_event(
                session_id,
                "diversify",
                "complete",
                {"final_count": len(final_results)}
            )
            
            # Calculate total time
            total_time = (datetime.now() - start_time).total_seconds() * 1000
            context.metadata["total_time_ms"] = total_time
            
            # Store in history
            self.retrieval_history.append(context)
            
            # Emit final retrieval complete event
            await self._emit_retrieval_summary(session_id, context)
            
            return final_results, context
            
        except Exception as e:
            logger.error(f"Retrieval failed: {e}", exc_info=True)
            context.metadata["error"] = str(e)
            return [], context
    
    async def _process_query(self, query: str, context: RetrievalContext) -> ProcessedQuery:
        """Process and understand the query."""
        step_start = datetime.now()
        
        # Process query
        processed = self.query_processor.process(query)
        
        # Log step
        step = RetrievalStep(
            step_name="query_understanding",
            timestamp=step_start,
            duration_ms=int((datetime.now() - step_start).total_seconds() * 1000),
            input_data={"query": query},
            output_data={
                "intent": processed.intent.value,
                "entities": processed.entities,
                "keywords": processed.keywords,
                "key_phrases": processed.key_phrases,
                "temporal_refs": processed.temporal_refs
            },
            metadata={
                "confidence_scores": processed.confidence_scores
            }
        )
        context.steps.append(step)
        
        logger.info(f"Query processed: intent={processed.intent.value}, entities={len(processed.entities)}")
        return processed
    
    async def _execute_graph_search(
        self,
        query: ProcessedQuery,
        context: RetrievalContext
    ) -> List[Dict]:
        """Execute knowledge graph search."""
        step_start = datetime.now()
        results = []
        
        try:
            # Search for facts using the optimized graph query
            graph_input = GraphSearchInput(query=query.graph_query)
            raw_results = await graph_search_tool(graph_input)
            
            # Convert to standardized format
            for r in raw_results[:20]:  # Limit to top 20
                results.append({
                    "type": "graph_fact",
                    "content": r.fact,
                    "metadata": {
                        "fact_id": r.uuid,
                        "valid_at": r.valid_at,
                        "invalid_at": r.invalid_at,
                        "source_node": r.source_node_uuid
                    },
                    "relevance_score": self._calculate_graph_relevance(r, query)
                })
            
            # Also search for specific entities if identified
            for entity in query.entities[:3]:  # Top 3 entities
                entity_facts = await self._search_entity_facts(entity["text"])
                for fact in entity_facts[:5]:  # Top 5 facts per entity
                    results.append({
                        "type": "entity_fact",
                        "content": fact["content"],
                        "metadata": {
                            "entity": entity["text"],
                            "entity_type": entity["type"],
                            **fact.get("metadata", {})
                        },
                        "relevance_score": fact.get("score", 0.5)
                    })
            
        except Exception as e:
            logger.error(f"Graph search failed: {e}")
        
        # Log step
        step = RetrievalStep(
            step_name="graph_search",
            timestamp=step_start,
            duration_ms=int((datetime.now() - step_start).total_seconds() * 1000),
            input_data={
                "graph_query": query.graph_query,
                "entities": query.entities
            },
            output_data={
                "results_count": len(results),
                "result_types": self._count_result_types(results)
            }
        )
        context.steps.append(step)
        
        return results
    
    async def _execute_vector_search(
        self,
        query: ProcessedQuery,
        context: RetrievalContext,
        config: Dict[str, Any]
    ) -> List[Dict]:
        """Execute vector similarity search with enhancements."""
        step_start = datetime.now()
        results = []
        
        try:
            # Initial vector search
            vector_input = VectorSearchInput(
                query=query.vector_query,
                limit=config.get("vector_limit", 20)
            )
            raw_results = await vector_search_tool(vector_input)
            
            # Convert to standardized format
            for r in raw_results:
                results.append({
                    "type": "vector_chunk",
                    "content": r.content,
                    "metadata": {
                        "chunk_id": r.chunk_id,
                        "document_title": r.document_title,
                        "document_source": r.document_source,
                        "original_score": r.score
                    },
                    "relevance_score": r.score
                })
            
            # Query expansion for better recall
            if config.get("use_query_expansion", True):
                expanded_queries = self._expand_query(query)
                for exp_query in expanded_queries[:2]:  # Top 2 expansions
                    exp_input = VectorSearchInput(query=exp_query, limit=5)
                    exp_results = await vector_search_tool(exp_input)
                    for r in exp_results:
                        # Slightly reduce score for expanded query results
                        results.append({
                            "type": "vector_chunk_expanded",
                            "content": r.content,
                            "metadata": {
                                "chunk_id": r.chunk_id,
                                "document_title": r.document_title,
                                "document_source": r.document_source,
                                "expansion_query": exp_query,
                                "original_score": r.score
                            },
                            "relevance_score": r.score * 0.85
                        })
            
        except Exception as e:
            logger.error(f"Vector search failed: {e}")
        
        # Log step
        step = RetrievalStep(
            step_name="vector_search",
            timestamp=step_start,
            duration_ms=int((datetime.now() - step_start).total_seconds() * 1000),
            input_data={
                "vector_query": query.vector_query,
                "limit": config.get("vector_limit", 20),
                "use_expansion": config.get("use_query_expansion", True)
            },
            output_data={
                "results_count": len(results),
                "avg_score": sum([r["relevance_score"] for r in results]) / len(results) if results else 0
            }
        )
        context.steps.append(step)
        
        return results
    
    async def _fuse_results(self, context: RetrievalContext) -> List[Dict]:
        """Fuse and rerank results from different sources."""
        step_start = datetime.now()
        
        # Combine all results
        all_results = []
        
        # Add graph results with source weight
        for r in context.graph_results:
            r["source_weight"] = 1.2  # Boost graph results
            all_results.append(r)
        
        # Add vector results
        for r in context.vector_results:
            r["source_weight"] = 1.0
            all_results.append(r)
        
        # Calculate final scores
        for result in all_results:
            base_score = result.get("relevance_score", 0.5)
            source_weight = result.get("source_weight", 1.0)
            
            # Boost based on query intent
            intent_boost = self._get_intent_boost(result, context.query.intent)
            
            # Boost if contains entities
            entity_boost = self._calculate_entity_boost(result, context.query.entities)
            
            # Final score
            result["final_score"] = base_score * source_weight * intent_boost * entity_boost
        
        # Sort by final score
        all_results.sort(key=lambda x: x["final_score"], reverse=True)
        
        # Log step
        step = RetrievalStep(
            step_name="result_fusion",
            timestamp=step_start,
            duration_ms=int((datetime.now() - step_start).total_seconds() * 1000),
            input_data={
                "graph_count": len(context.graph_results),
                "vector_count": len(context.vector_results)
            },
            output_data={
                "fused_count": len(all_results),
                "top_scores": [r["final_score"] for r in all_results[:5]]
            }
        )
        context.steps.append(step)
        
        return all_results
    
    async def _diversify_results(
        self,
        results: List[Dict],
        context: RetrievalContext
    ) -> List[Dict]:
        """Apply diversity to avoid redundancy (MMR-like approach)."""
        step_start = datetime.now()
        
        if not results:
            return []
        
        # Parameters
        lambda_param = 0.7  # Balance between relevance and diversity
        max_results = 10
        
        selected = []
        remaining = results.copy()
        
        # Select first result (highest score)
        if remaining:
            selected.append(remaining.pop(0))
        
        # Iteratively select diverse results
        while len(selected) < max_results and remaining:
            best_score = -1
            best_idx = -1
            
            for idx, candidate in enumerate(remaining):
                # Relevance score
                relevance = candidate["final_score"]
                
                # Diversity score (minimum similarity to selected)
                diversity = 1.0
                for selected_item in selected:
                    similarity = self._calculate_content_similarity(
                        candidate["content"],
                        selected_item["content"]
                    )
                    diversity = min(diversity, 1 - similarity)
                
                # MMR score
                mmr_score = lambda_param * relevance + (1 - lambda_param) * diversity
                
                if mmr_score > best_score:
                    best_score = mmr_score
                    best_idx = idx
            
            if best_idx >= 0:
                selected.append(remaining.pop(best_idx))
        
        # Log step
        step = RetrievalStep(
            step_name="diversify_results",
            timestamp=step_start,
            duration_ms=int((datetime.now() - step_start).total_seconds() * 1000),
            input_data={
                "input_count": len(results),
                "lambda": lambda_param
            },
            output_data={
                "output_count": len(selected),
                "diversity_achieved": True
            }
        )
        context.steps.append(step)
        
        return selected
    
    # Helper methods
    
    def _calculate_graph_relevance(self, result: Any, query: ProcessedQuery) -> float:
        """Calculate relevance score for graph results."""
        score = 0.5  # Base score
        
        # Check for entity matches
        fact_lower = result.fact.lower() if hasattr(result, 'fact') else ""
        for entity in query.entities:
            if entity["text"].lower() in fact_lower:
                score += 0.2
        
        # Check for keyword matches
        for keyword in query.keywords:
            if keyword.lower() in fact_lower:
                score += 0.1
        
        return min(1.0, score)
    
    async def _search_entity_facts(self, entity_name: str) -> List[Dict]:
        """Search for facts about a specific entity."""
        try:
            # Use graph search for entity
            input_data = GraphSearchInput(query=entity_name)
            results = await graph_search_tool(input_data)
            
            facts = []
            for r in results[:5]:
                facts.append({
                    "content": r.fact,
                    "metadata": {
                        "fact_id": r.uuid,
                        "valid_at": r.valid_at
                    },
                    "score": 0.7  # Default entity fact score
                })
            return facts
        except:
            return []
    
    def _expand_query(self, query: ProcessedQuery) -> List[str]:
        """Generate query expansions for better recall."""
        expansions = []
        
        # Add entity-focused expansion
        if query.entities:
            entity_names = [e["text"] for e in query.entities[:2]]
            expansions.append(f"{query.original} {' '.join(entity_names)}")
        
        # Add keyword-focused expansion
        if query.keywords:
            expansions.append(' '.join(query.keywords[:5]))
        
        # Add intent-specific expansions
        if query.intent == QueryIntent.TEMPORAL:
            expansions.append(f"{query.original} timeline history evolution")
        elif query.intent == QueryIntent.COMPARISON:
            expansions.append(f"{query.original} versus comparison difference")
        
        return expansions
    
    def _get_intent_boost(self, result: Dict, intent: QueryIntent) -> float:
        """Get relevance boost based on query intent."""
        content_lower = result.get("content", "").lower()
        
        if intent == QueryIntent.FACTUAL:
            # Boost results with factual indicators
            if any(word in content_lower for word in ["is", "are", "was", "defined"]):
                return 1.15
        elif intent == QueryIntent.TEMPORAL:
            # Boost results with dates
            import re
            if re.search(r'\b\d{4}\b', content_lower):
                return 1.2
        elif intent == QueryIntent.COMPARISON:
            # Boost comparative content
            if any(word in content_lower for word in ["versus", "compared", "unlike", "whereas"]):
                return 1.2
        
        return 1.0
    
    def _calculate_entity_boost(self, result: Dict, entities: List[Dict]) -> float:
        """Calculate boost based on entity presence."""
        if not entities:
            return 1.0
        
        content_lower = result.get("content", "").lower()
        boost = 1.0
        
        for entity in entities:
            if entity["text"].lower() in content_lower:
                boost += 0.1
        
        return min(1.5, boost)
    
    def _calculate_content_similarity(self, content1: str, content2: str) -> float:
        """Calculate similarity between two pieces of content."""
        # Simple Jaccard similarity for now
        words1 = set(content1.lower().split())
        words2 = set(content2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0
    
    def _count_result_types(self, results: List[Dict]) -> Dict[str, int]:
        """Count results by type."""
        counts = {}
        for r in results:
            r_type = r.get("type", "unknown")
            counts[r_type] = counts.get(r_type, 0) + 1
        return counts
    
    async def _emit_step_event(
        self,
        session_id: str,
        step: str,
        status: str,
        data: Dict[str, Any]
    ):
        """Emit detailed step event for frontend visibility."""
        if not session_id:
            logger.warning(f"No session_id for retrieval event: {step} {status}")
            return
        
        event = {
            "type": "retrieval_step",
            "step": step,
            "status": status,
            "data": data,
            "timestamp": datetime.now().isoformat()
        }
        logger.info(f"Emitting retrieval event for session {session_id}: {step} {status}")
        await emit_retrieval_event(session_id, event)
    
    async def _emit_retrieval_summary(self, session_id: str, context: RetrievalContext):
        """Emit final retrieval summary."""
        summary = {
            "type": "retrieval_summary",
            "query": {
                "original": context.query.original,
                "intent": context.query.intent.value,
                "entities": len(context.query.entities),
                "keywords": len(context.query.keywords)
            },
            "results": {
                "graph": len(context.graph_results),
                "vector": len(context.vector_results),
                "final": len(context.final_results)
            },
            "steps": [
                {
                    "name": step.step_name,
                    "duration_ms": step.duration_ms
                }
                for step in context.steps
            ],
            "total_time_ms": context.metadata.get("total_time_ms", 0)
        }
        await emit_retrieval_event(session_id, summary)
