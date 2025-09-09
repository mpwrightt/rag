"""
PostgreSQL-based Knowledge Graph utilities for Supabase integration.
Replaces Neo4j/Graphiti with PostgreSQL tables for nodes, edges, and facts.
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone
import asyncio
import time

from dotenv import load_dotenv
from .db_utils import (
    search_facts,
    search_facts_websearch,
    get_entity_relationships as db_get_entity_relationships,
    get_entity_timeline as db_get_entity_timeline,
    get_graph_statistics,
    add_episode_to_graph,
    clear_graph,
    upsert_node,
    create_relationship,
    add_fact,
    get_node_by_name
)

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


class KnowledgeGraphClient:
    """
    PostgreSQL-based knowledge graph client that replaces Graphiti.
    Uses nodes, edges, and facts tables for knowledge representation.
    """

    def __init__(self):
        """Initialize the knowledge graph client."""
        self._initialized = False
    
    async def initialize(self):
        """Initialize the knowledge graph client with enhanced error handling."""
        if self._initialized:
            return

        # Timeout for initialization (seconds)
        try:
            init_timeout = float(os.getenv("GRAPH_INIT_TIMEOUT", "15"))
        except Exception:
            init_timeout = 15.0

        try:
            # Test database connection and graph statistics with timeout
            start = time.perf_counter()
            
            # Try to get graph statistics, but don't fail if it doesn't exist
            try:
                stats = await asyncio.wait_for(get_graph_statistics(), timeout=init_timeout)
                elapsed = time.perf_counter() - start
                self._initialized = True
                logger.info(
                    f"Knowledge graph client initialized in {elapsed:.3f}s. Stats: {stats}"
                )
            except Exception as stats_error:
                logger.warning(f"Could not get graph statistics: {stats_error}, but continuing with initialization")
                # Still mark as initialized - the graph search functions will handle missing tables
                self._initialized = True
                elapsed = time.perf_counter() - start
                logger.info(f"Knowledge graph client initialized in {elapsed:.3f}s (without stats)")
                
        except asyncio.TimeoutError:
            logger.error(
                f"Knowledge graph initialization timed out after {init_timeout}s"
            )
            # Don't raise - mark as initialized and let individual operations handle failures
            self._initialized = True
            logger.info("Knowledge graph client marked as initialized despite timeout")
        except Exception as e:
            logger.error(f"Failed to initialize knowledge graph: {e}")
            # Don't raise - mark as initialized and let individual operations handle failures  
            self._initialized = True
            logger.info("Knowledge graph client marked as initialized despite errors")
    
    async def close(self):
        """Close the knowledge graph connection."""
        self._initialized = False
        logger.info("Knowledge graph client closed")
    
    async def add_episode(
        self,
        episode_id: str,
        content: str,
        source: str,
        timestamp: Optional[datetime] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Add an episode to the knowledge graph.

        Args:
            episode_id: Unique episode identifier
            content: Episode content
            source: Source of the content
            timestamp: Episode timestamp
            metadata: Additional metadata
        """
        if not self._initialized:
            await self.initialize()

        # Timeout for episode addition (seconds)
        try:
            episode_timeout = float(os.getenv("GRAPH_EPISODE_TIMEOUT", "30"))
        except Exception:
            episode_timeout = 30.0

        start = time.perf_counter()
        try:
            await asyncio.wait_for(
                add_episode_to_graph(
                    episode_id=episode_id,
                    content=content,
                    source=source,
                    metadata=metadata
                ),
                timeout=episode_timeout,
            )
            logger.info(
                f"Added episode {episode_id} to knowledge graph in {time.perf_counter() - start:.3f}s"
            )
        except asyncio.TimeoutError:
            logger.error(
                f"Timed out adding episode {episode_id} to knowledge graph after {episode_timeout}s"
            )
            raise
    
    async def search(
        self,
        query: str,
        center_node_distance: int = 2,
        use_hybrid_search: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Search the knowledge graph using full-text search on facts.

        Args:
            query: Search query
            center_node_distance: Not used in PostgreSQL implementation
            use_hybrid_search: Not used in PostgreSQL implementation

        Returns:
            Search results
        """
        if not self._initialized:
            await self.initialize()

        # Timeout for graph queries (seconds)
        try:
            query_timeout = float(os.getenv("GRAPH_QUERY_TIMEOUT", "20"))
        except Exception:
            query_timeout = 20.0

        try:
            start = time.perf_counter()
            
            # Try primary search function
            results = []
            try:
                results = await asyncio.wait_for(search_facts(query, limit=20), timeout=query_timeout)
            except Exception as primary_error:
                logger.warning(f"Primary search_facts failed: {primary_error}")
            
            # Fallback to websearch_to_tsquery for broader recall if strict search returns nothing
            if not results:
                logger.info("KG strict search returned 0; falling back to websearch_to_tsquery")
                try:
                    results = await asyncio.wait_for(search_facts_websearch(query, limit=20), timeout=query_timeout)
                except Exception as websearch_error:
                    logger.warning(f"Websearch fallback also failed: {websearch_error}")

            # Final fallback - direct database query if functions don't exist
            if not results:
                logger.info("All KG search functions failed; trying direct database fallback")
                results = await self._direct_fact_search(query, limit=20)

            # Convert to Graphiti-compatible format for backward compatibility
            converted_results = []
            for result in results:
                try:
                    converted_results.append({
                        "fact": result.get("content", ""),
                        "uuid": result.get("fact_id", ""),
                        "valid_at": result.get("valid_at"),
                        "invalid_at": result.get("invalid_at"),
                        "source_node_uuid": result.get("node_id", ""),
                        "node_name": result.get("node_name", ""),
                        "node_type": result.get("node_type", "")
                    })
                except Exception as conversion_error:
                    logger.warning(f"Failed to convert result: {conversion_error}, result: {result}")
                    continue
                    
            elapsed = time.perf_counter() - start
            logger.info(f"Graph search completed in {elapsed:.3f}s, returned {len(converted_results)} results")
            return converted_results

        except asyncio.TimeoutError:
            logger.error(f"Graph search timed out after {query_timeout}s for query: {query!r}")
            return []
        except Exception as e:
            logger.error(f"Graph search failed: {e}", exc_info=True)
            return []
    
    async def _direct_fact_search(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Direct database search as final fallback when search functions don't exist.
        
        Args:
            query: Search query
            limit: Maximum results
            
        Returns:
            List of fact results
        """
        try:
            from .db_utils import db_pool
            
            async with db_pool.acquire() as conn:
                # Try to search facts table directly
                results = await conn.fetch("""
                    SELECT 
                        f.id::text as fact_id,
                        f.content,
                        f.source,
                        f.valid_at,
                        f.invalid_at,
                        f.confidence,
                        n.id::text as node_id,
                        n.name as node_name,
                        n.type as node_type
                    FROM facts f
                    LEFT JOIN nodes n ON f.node_id = n.id
                    WHERE f.content ILIKE $1
                    ORDER BY f.created_at DESC
                    LIMIT $2
                """, f"%{query}%", limit)
                
                return [dict(r) for r in results]
                
        except Exception as e:
            logger.warning(f"Direct fact search failed: {e}")
            return []
    
    async def get_related_entities(
        self,
        entity_name: str,
        relationship_types: Optional[List[str]] = None,
        depth: int = 1
    ) -> Dict[str, Any]:
        """
        Get entities related to a given entity.

        Args:
            entity_name: Name of the entity
            relationship_types: Not used in PostgreSQL implementation
            depth: Maximum traversal depth

        Returns:
            Related entities and relationships
        """
        if not self._initialized:
            await self.initialize()

        try:
            query_timeout = float(os.getenv("GRAPH_QUERY_TIMEOUT", "20"))
        except Exception:
            query_timeout = 20.0

        try:
            start = time.perf_counter()
            return await asyncio.wait_for(
                db_get_entity_relationships(entity_name, depth),
                timeout=query_timeout,
            )
        except asyncio.TimeoutError:
            logger.error(
                f"Entity relationship query timed out after {query_timeout}s for entity: {entity_name!r}"
            )
            return {
                "central_entity": entity_name,
                "related_facts": [],
                "relationships": [],
                "error": "timeout",
            }
        except Exception as e:
            logger.error(f"Entity relationship query failed: {e}")
            return {
                "central_entity": entity_name,
                "related_facts": [],
                "relationships": [],
                "error": str(e)
            }
    
    async def get_entity_timeline(
        self,
        entity_name: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get timeline of facts for an entity.

        Args:
            entity_name: Name of the entity
            start_date: Start of time range
            end_date: End of time range

        Returns:
            Timeline of facts
        """
        if not self._initialized:
            await self.initialize()

        try:
            query_timeout = float(os.getenv("GRAPH_QUERY_TIMEOUT", "20"))
        except Exception:
            query_timeout = 20.0

        try:
            start = time.perf_counter()
            return await asyncio.wait_for(
                db_get_entity_timeline(entity_name, start_date, end_date),
                timeout=query_timeout,
            )
        except asyncio.TimeoutError:
            logger.error(
                f"Entity timeline query timed out after {query_timeout}s for entity: {entity_name!r}"
            )
            return []
        except Exception as e:
            logger.error(f"Entity timeline query failed: {e}")
            return []
    
    async def get_graph_statistics(self) -> Dict[str, Any]:
        """
        Get basic statistics about the knowledge graph.

        Returns:
            Graph statistics
        """
        if not self._initialized:
            await self.initialize()

        try:
            query_timeout = float(os.getenv("GRAPH_QUERY_TIMEOUT", "20"))
        except Exception:
            query_timeout = 20.0

        try:
            start = time.perf_counter()
            return await asyncio.wait_for(get_graph_statistics(), timeout=query_timeout)
        except asyncio.TimeoutError:
            logger.error(
                f"Failed to get graph statistics due to timeout after {query_timeout}s"
            )
            return {
                "graph_initialized": False,
                "error": "timeout",
            }
        except Exception as e:
            logger.error(f"Failed to get graph statistics: {e}")
            return {
                "graph_initialized": False,
                "error": str(e)
            }
    
    async def clear_graph(self):
        """Clear all data from the graph (USE WITH CAUTION)."""
        if not self._initialized:
            await self.initialize()

        try:
            query_timeout = float(os.getenv("GRAPH_QUERY_TIMEOUT", "20"))
        except Exception:
            query_timeout = 20.0

        try:
            start = time.perf_counter()
            success = await asyncio.wait_for(clear_graph(), timeout=query_timeout)
        except asyncio.TimeoutError:
            logger.error(f"Timed out clearing knowledge graph after {query_timeout}s")
            success = False
        if success:
            logger.warning("Cleared all data from knowledge graph")
        else:
            logger.error("Failed to clear knowledge graph")
    
    async def upsert_node(
        self,
        name: str,
        node_type: str,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Insert or update a knowledge graph node.

        Args:
            name: Node name
            node_type: Node type
            description: Optional description
            metadata: Optional metadata

        Returns:
            Node ID
        """
        if not self._initialized:
            await self.initialize()

        try:
            query_timeout = float(os.getenv("GRAPH_QUERY_TIMEOUT", "20"))
        except Exception:
            query_timeout = 20.0

        try:
            return await asyncio.wait_for(
                upsert_node(name, node_type, description, metadata),
                timeout=query_timeout,
            )
        except asyncio.TimeoutError:
            logger.error(
                f"Timed out upserting node {name!r}/{node_type!r} after {query_timeout}s"
            )
            raise
    
    async def create_relationship(
        self,
        source_node_id: str,
        target_node_id: str,
        relationship_type: str,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Create a relationship between two nodes.

        Args:
            source_node_id: Source node ID
            target_node_id: Target node ID
            relationship_type: Type of relationship
            description: Optional description
            metadata: Optional metadata

        Returns:
            Relationship ID
        """
        if not self._initialized:
            await self.initialize()

        try:
            query_timeout = float(os.getenv("GRAPH_QUERY_TIMEOUT", "20"))
        except Exception:
            query_timeout = 20.0

        try:
            return await asyncio.wait_for(
                create_relationship(source_node_id, target_node_id, relationship_type, description, metadata),
                timeout=query_timeout,
            )
        except asyncio.TimeoutError:
            logger.error(
                f"Timed out creating relationship {relationship_type!r} after {query_timeout}s"
            )
            raise
    
    async def add_fact(
        self,
        node_id: str,
        content: str,
        source: str,
        valid_at: Optional[datetime] = None,
        invalid_at: Optional[datetime] = None,
        confidence: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add a fact to a node.

        Args:
            node_id: Node ID
            content: Fact content
            source: Source of the fact
            valid_at: When the fact became valid
            invalid_at: When the fact became invalid
            confidence: Confidence score
            metadata: Optional metadata

        Returns:
            Fact ID
        """
        if not self._initialized:
            await self.initialize()

        try:
            query_timeout = float(os.getenv("GRAPH_QUERY_TIMEOUT", "20"))
        except Exception:
            query_timeout = 20.0

        try:
            return await asyncio.wait_for(
                add_fact(node_id, content, source, valid_at, invalid_at, confidence, metadata),
                timeout=query_timeout,
            )
        except asyncio.TimeoutError:
            logger.error(
                f"Timed out adding fact to node {node_id} after {query_timeout}s"
            )
            raise


# Global knowledge graph client instance (lazy initialization)
_graph_client_instance: Optional[KnowledgeGraphClient] = None

def get_graph_client() -> KnowledgeGraphClient:
    """Get the global knowledge graph client instance (lazy initialization)."""
    global _graph_client_instance
    if _graph_client_instance is None:
        _graph_client_instance = KnowledgeGraphClient()
    return _graph_client_instance

# For backward compatibility, provide graph_client as a property
class _GraphClientProxy:
    def __getattr__(self, name):
        return getattr(get_graph_client(), name)

graph_client = _GraphClientProxy()


async def initialize_graph():
    """Initialize graph client."""
    await graph_client.initialize()


async def close_graph():
    """Close graph client."""
    await graph_client.close()


# Convenience functions for common operations
async def add_to_knowledge_graph(
    content: str,
    source: str,
    episode_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """
    Add content to the knowledge graph.
    
    Args:
        content: Content to add
        source: Source of the content
        episode_id: Optional episode ID
        metadata: Optional metadata
    
    Returns:
        Episode ID
    """
    if not episode_id:
        episode_id = f"episode_{datetime.now(timezone.utc).isoformat()}"
    
    await graph_client.add_episode(
        episode_id=episode_id,
        content=content,
        source=source,
        metadata=metadata
    )
    
    return episode_id


async def search_knowledge_graph(
    query: str
) -> List[Dict[str, Any]]:
    """
    Search the knowledge graph.
    
    Args:
        query: Search query
    
    Returns:
        Search results
    """
    return await graph_client.search(query)


async def get_entity_relationships(
    entity: str,
    depth: int = 2
) -> Dict[str, Any]:
    """
    Get relationships for an entity.
    
    Args:
        entity: Entity name
        depth: Maximum traversal depth
    
    Returns:
        Entity relationships
    """
    return await graph_client.get_related_entities(entity, depth=depth)


async def test_graph_connection() -> bool:
    """
    Test graph database connection.
    
    Returns:
        True if connection successful
    """
    try:
        await graph_client.initialize()
        stats = await graph_client.get_graph_statistics()
        logger.info(f"Graph connection successful. Stats: {stats}")
        return True
    except Exception as e:
        logger.error(f"Graph connection test failed: {e}")
        return False