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
    """
    Represents a single, atomic step within the enhanced retrieval process.

    This class captures detailed information about each stage of the retrieval,
    including its name, duration, inputs, and outputs, for full transparency.

    Attributes:
        step_name: The name of the retrieval step (e.g., 'query_understanding').
        timestamp: The time when the step started.
        duration_ms: The duration of the step in milliseconds.
        input_data: A dictionary of the data that was input to the step.
        output_data: A dictionary of the data that was produced by the step.
        metadata: An optional dictionary for any additional metadata.
    """
    step_name: str
    timestamp: datetime
    duration_ms: int
    input_data: Dict[str, Any]
    output_data: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RetrievalContext:
    """
    Holds the complete context and all artifacts of a single retrieval operation.

    This class aggregates all the steps, intermediate results, and metadata for a
    retrieval, providing a full picture of the process from start to finish.

    Attributes:
        session_id: The ID of the session this retrieval belongs to.
        query: The `ProcessedQuery` object representing the user's query.
        steps: A list of `RetrievalStep` objects detailing each stage.
        graph_results: The results from the knowledge graph search.
        vector_results: The results from the vector search.
        reranked_results: The results after fusion and reranking.
        final_results: The final, diversified list of results.
        metadata: A dictionary for any other metadata about the retrieval.
    """
    session_id: str
    query: ProcessedQuery
    steps: List[RetrievalStep] = field(default_factory=list)
    graph_results: List[Dict] = field(default_factory=list)
    vector_results: List[Dict] = field(default_factory=list)
    reranked_results: List[Dict] = field(default_factory=list)
    final_results: List[Dict] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class EnhancedRetriever:
    """
    An advanced retrieval system that provides full transparency into its operations.

    This class orchestrates a multi-stage retrieval process that includes query
    understanding, multi-source search, result fusion, and diversification.
    """
    
    def __init__(self):
        """Initializes the EnhancedRetriever."""
        self.query_processor = QueryProcessor()
        self.retrieval_history = []
        
    async def retrieve(
        self,
        query: str,
        session_id: str,
        config: Optional[Dict[str, Any]] = None
    ) -> Tuple[List[Dict], RetrievalContext]:
        """
        Executes the full, multi-stage retrieval process.

        Args:
            query: The user's query string.
            session_id: The ID of the current session, for tracking and eventing.
            config: An optional dictionary of configuration parameters to control
                    the retrieval process.

        Returns:
            A tuple containing the final list of results and the `RetrievalContext`
            with a detailed log of the entire operation.
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
        """
        Processes and understands the user's query.

        This method uses the `QueryProcessor` to analyze the query's intent,
        extract entities, and generate different versions of the query for
        downstream tasks.

        Args:
            query: The user's query string.
            context: The current `RetrievalContext`.

        Returns:
            A `ProcessedQuery` object with the results of the analysis.
        """
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
        """
        Executes a search against the knowledge graph.

        This method queries the graph for both general facts and specific facts
        related to entities found in the query.

        Args:
            query: The `ProcessedQuery` object.
            context: The current `RetrievalContext`.

        Returns:
            A list of results from the knowledge graph.
        """
        step_start = datetime.now()
        results = []
        
        try:
            # Search for facts using the optimized graph query
            logger.info(f"Executing graph search with query: {query.graph_query}")
            graph_input = GraphSearchInput(query=query.graph_query)
            raw_results = await graph_search_tool(graph_input)
            logger.info(f"Graph search returned {len(raw_results)} results")
            
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
            if len(raw_results) == 0:
                logger.warning("No graph results found - graph may be empty")
            
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
        """
        Executes a vector similarity search.

        This method performs a vector search and can also use query expansion
        to improve recall.

        Args:
            query: The `ProcessedQuery` object.
            context: The current `RetrievalContext`.
            config: The configuration dictionary for the retrieval.

        Returns:
            A list of results from the vector search.
        """
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
        """
        Fuses and reranks the results from different retrieval sources.

        This method combines the results from the graph and vector searches and
        calculates a new, more holistic relevance score for each result.

        Args:
            context: The current `RetrievalContext`.

        Returns:
            A single, reranked list of results.
        """
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
        """
        Diversifies the result set to avoid redundancy.

        This method uses a Maximal Marginal Relevance (MMR)-like approach to select
        a set of results that is both relevant and diverse.

        Args:
            results: The list of results to diversify.
            context: The current `RetrievalContext`.

        Returns:
            A diversified list of results.
        """
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
        """
        Calculates a relevance score for a result from the knowledge graph.

        Args:
            result: The graph result to score.
            query: The `ProcessedQuery` object.

        Returns:
            A relevance score between 0.0 and 1.0.
        """
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
        """
        Searches for facts related to a specific entity.

        Args:
            entity_name: The name of the entity to search for.

        Returns:
            A list of facts related to the entity.
        """
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
        """
        Generates expanded versions of the query to improve recall.

        Args:
            query: The `ProcessedQuery` object.

        Returns:
            A list of expanded query strings.
        """
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
        """
        Calculates a relevance boost for a result based on the query's intent.

        Args:
            result: The result to be scored.
            intent: The `QueryIntent` of the user's query.

        Returns:
            A boost factor as a float.
        """
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
        """
        Calculates a relevance boost based on the presence of entities in the result.

        Args:
            result: The result to be scored.
            entities: A list of entities extracted from the query.

        Returns:
            A boost factor as a float.
        """
        if not entities:
            return 1.0
        
        content_lower = result.get("content", "").lower()
        boost = 1.0
        
        for entity in entities:
            if entity["text"].lower() in content_lower:
                boost += 0.1
        
        return min(1.5, boost)
    
    def _calculate_content_similarity(self, content1: str, content2: str) -> float:
        """
        Calculates the similarity between two pieces of text content.

        This method uses a simple Jaccard similarity score.

        Args:
            content1: The first piece of content.
            content2: The second piece of content.

        Returns:
            A similarity score between 0.0 and 1.0.
        """
        # Simple Jaccard similarity for now
        words1 = set(content1.lower().split())
        words2 = set(content2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0
    
    def _count_result_types(self, results: List[Dict]) -> Dict[str, int]:
        """
        Counts the number of results of each type in a list of results.

        Args:
            results: A list of result dictionaries.

        Returns:
            A dictionary mapping result types to their counts.
        """
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
        """
        Emits a detailed event for a specific step in the retrieval process.

        This is used for providing real-time visibility into the retrieval process
        on the frontend.

        Args:
            session_id: The ID of the session.
            step: The name of the step.
            status: The status of the step (e.g., 'start', 'complete').
            data: A dictionary of data associated with the event.
        """
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
        logger.info(f"Event details: {event}")
        await emit_retrieval_event(session_id, event)
    
    async def _emit_retrieval_summary(self, session_id: str, context: RetrievalContext):
        """
        Emits a final summary of the entire retrieval operation.

        Args:
            session_id: The ID of the session.
            context: The `RetrievalContext` containing all the retrieval data.
        """
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
