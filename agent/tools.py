"""
Tools for the Pydantic AI agent.
"""

import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio

from pydantic import BaseModel, Field
from dotenv import load_dotenv

from .db_utils import (
    vector_search,
    hybrid_search,
    get_document,
    list_documents,
    get_document_chunks
)
from .graph_utils import (
    search_knowledge_graph,
    get_entity_relationships,
    graph_client
)
from .models import ChunkResult, GraphSearchResult, DocumentMetadata
from .providers import get_embedding_client, get_embedding_model

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Initialize embedding client with flexible provider
embedding_client = get_embedding_client()
EMBEDDING_MODEL = get_embedding_model()


async def generate_embedding(text: str) -> List[float]:
    """
    Generate embedding for text using OpenAI.
    
    Args:
        text: Text to embed
    
    Returns:
        Embedding vector
    """
    try:
        response = await embedding_client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=text
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"Failed to generate embedding: {e}")
        raise


# Tool Input Models
class VectorSearchInput(BaseModel):
    """Input for vector search tool."""
    query: str = Field(..., description="Search query")
    limit: int = Field(default=10, description="Maximum number of results")
    collection_ids: Optional[List[str]] = Field(default=None, description="Restrict search to these collection UUIDs")
    document_ids: Optional[List[str]] = Field(default=None, description="Restrict search to these document UUIDs")


class GraphSearchInput(BaseModel):
    """Input for graph search tool."""
    query: str = Field(..., description="Search query")


class HybridSearchInput(BaseModel):
    """Input for hybrid search tool."""
    query: str = Field(..., description="Search query")
    limit: int = Field(default=10, description="Maximum number of results")
    text_weight: float = Field(default=0.3, description="Weight for text similarity (0-1)")
    collection_ids: Optional[List[str]] = Field(default=None, description="Restrict search to these collection UUIDs")
    document_ids: Optional[List[str]] = Field(default=None, description="Restrict search to these document UUIDs")


class DocumentInput(BaseModel):
    """Input for document retrieval."""
    document_id: str = Field(..., description="Document ID to retrieve")


class DocumentListInput(BaseModel):
    """Input for listing documents."""
    limit: int = Field(default=20, description="Maximum number of documents")
    offset: int = Field(default=0, description="Number of documents to skip")
    collection_ids: Optional[List[str]] = Field(default=None, description="Restrict listing to these collection UUIDs")
    document_ids: Optional[List[str]] = Field(default=None, description="Restrict listing to these document UUIDs")


class EntityRelationshipInput(BaseModel):
    """Input for entity relationship query."""
    entity_name: str = Field(..., description="Name of the entity")
    depth: int = Field(default=2, description="Maximum traversal depth")


class EntityTimelineInput(BaseModel):
    """Input for entity timeline query."""
    entity_name: str = Field(..., description="Name of the entity")
    start_date: Optional[str] = Field(None, description="Start date (ISO format)")
    end_date: Optional[str] = Field(None, description="End date (ISO format)")


# Helper Functions
async def search_by_title(
    query: str,
    collection_ids: Optional[List[str]] = None,
    document_ids: Optional[List[str]] = None,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Search for documents by title or filename, returning their first chunks.
    
    Args:
        query: Search query (document title/filename)
        collection_ids: Optional collection filter
        document_ids: Optional document filter
        limit: Maximum results
    
    Returns:
        List of chunk results from matching documents
    """
    from .db_utils import db_pool
    
    try:
        async with db_pool.acquire() as conn:
            # Build dynamic query with filters
            params = [f"%{query}%", f"%{query}%"]  # For ILIKE matching
            where_clauses = ["(d.title ILIKE $1 OR d.source ILIKE $2)"]
            
            if collection_ids:
                params.append(collection_ids)
                where_clauses.append(f"dc.collection_id = ANY(${len(params)}::uuid[])")
            
            if document_ids:
                params.append(document_ids)
                where_clauses.append(f"d.id = ANY(${len(params)}::uuid[])")
            
            # Query to find documents with title/filename matches and return their first chunk
            base_query = """
                SELECT 
                    c.id::text as chunk_id,
                    d.id::text as document_id,
                    c.content,
                    d.title as document_title,
                    d.source as document_source,
                    c.metadata,
                    0.95 as similarity,
                    ROW_NUMBER() OVER (PARTITION BY d.id ORDER BY c.chunk_index) as rn
                FROM documents d
                LEFT JOIN document_collections dc ON d.id = dc.document_id
                JOIN chunks c ON d.id = c.document_id
                WHERE {where}
            """.format(where=" AND ".join(where_clauses))
            
            final_query = f"""
                SELECT 
                    chunk_id, document_id, content, document_title, 
                    document_source, metadata, similarity
                FROM ({base_query}) ranked
                WHERE rn = 1
                ORDER BY similarity DESC
                LIMIT {limit}
            """
            
            results = await conn.fetch(final_query, *params)
            
            return [dict(r) for r in results]
            
    except Exception as e:
        logger.error(f"Title search failed: {e}")
        return []


# Tool Implementation Functions
async def vector_search_tool(input_data: VectorSearchInput) -> List[ChunkResult]:
    """
    Perform vector similarity search with enhanced title matching.
    
    Args:
        input_data: Search parameters
    
    Returns:
        List of matching chunks
    """
    try:
        # First, try to find exact or fuzzy title matches
        title_results = await search_by_title(
            query=input_data.query,
            collection_ids=input_data.collection_ids,
            document_ids=input_data.document_ids
        )
        
        # Generate embedding for the query
        embedding = await generate_embedding(input_data.query)
        
        # Perform vector search
        vector_results = await vector_search(
            embedding=embedding,
            limit=input_data.limit,
            collection_ids=input_data.collection_ids,
            document_ids=input_data.document_ids,
        )

        # Combine results, prioritizing title matches
        combined_results = []
        
        # Add title matches first (boost their scores)
        for r in title_results[:5]:  # Top 5 title matches
            combined_results.append(
                ChunkResult(
                    chunk_id=str(r["chunk_id"]),
                    document_id=str(r["document_id"]),
                    content=r["content"],
                    score=min(0.98, r.get("similarity", 0.9) + 0.3),  # Boost title matches
                    metadata={**r["metadata"], "match_type": "title_match"},
                    document_title=r["document_title"],
                    document_source=r["document_source"]
                )
            )
        
        # Add vector results, avoiding duplicates
        title_chunk_ids = {r["chunk_id"] for r in title_results}
        for r in vector_results:
            if r["chunk_id"] not in title_chunk_ids:
                combined_results.append(
                    ChunkResult(
                        chunk_id=str(r["chunk_id"]),
                        document_id=str(r["document_id"]),
                        content=r["content"],
                        score=r["similarity"],
                        metadata={**r["metadata"], "match_type": "semantic"},
                        document_title=r["document_title"],
                        document_source=r["document_source"]
                    )
                )
        
        # Sort by score and return top results
        combined_results.sort(key=lambda x: x.score, reverse=True)
        return combined_results[:input_data.limit]
        
    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        return []


async def graph_search_tool(input_data: GraphSearchInput) -> List[GraphSearchResult]:
    """
    Search the knowledge graph with enhanced error handling and fallbacks.
    
    Args:
        input_data: Search parameters
    
    Returns:
        List of graph search results
    """
    try:
        logger.info(f"Executing graph search for query: {input_data.query}")
        
        # Try primary graph search
        results = await search_knowledge_graph(
            query=input_data.query
        )
        
        logger.info(f"Graph search returned {len(results)} results")
        
        # Convert to GraphSearchResult models
        graph_results = []
        for r in results:
            try:
                graph_results.append(
                    GraphSearchResult(
                        fact=r.get("fact", ""),
                        uuid=r.get("uuid", ""),
                        valid_at=r.get("valid_at"),
                        invalid_at=r.get("invalid_at"),
                        source_node_uuid=r.get("source_node_uuid")
                    )
                )
            except Exception as conversion_error:
                logger.warning(f"Failed to convert graph result: {conversion_error}, result: {r}")
                continue
        
        # If no results, try fallback search strategies
        if not graph_results:
            logger.info("No graph results found, trying fallback strategies")
            graph_results = await _fallback_graph_search(input_data.query)
        
        return graph_results
        
    except Exception as e:
        logger.error(f"Graph search failed with error: {e}", exc_info=True)
        # Return fallback results instead of empty list
        return await _fallback_graph_search(input_data.query)


async def _fallback_graph_search(query: str) -> List[GraphSearchResult]:
    """
    Fallback graph search using simpler methods when main graph search fails.
    
    Args:
        query: Search query
        
    Returns:
        List of fallback graph search results
    """
    try:
        from .db_utils import db_pool
        
        # Simple fallback: search for any facts containing query terms
        async with db_pool.acquire() as conn:
            # Check if facts table exists and search it directly
            results = await conn.fetch("""
                SELECT 
                    f.id::text as fact_id,
                    f.content,
                    f.source,
                    f.valid_at,
                    f.invalid_at,
                    n.id::text as node_id,
                    n.name as node_name
                FROM facts f
                LEFT JOIN nodes n ON f.node_id = n.id
                WHERE f.content ILIKE $1
                ORDER BY f.created_at DESC
                LIMIT 10
            """, f"%{query}%")
            
            return [
                GraphSearchResult(
                    fact=r["content"] or "",
                    uuid=r["fact_id"] or "",
                    valid_at=r["valid_at"].isoformat() if r["valid_at"] else None,
                    invalid_at=r["invalid_at"].isoformat() if r["invalid_at"] else None,
                    source_node_uuid=r["node_id"] or ""
                )
                for r in results
            ]
            
    except Exception as e:
        logger.warning(f"Fallback graph search also failed: {e}")
        # Return empty list as final fallback
        return []


async def hybrid_search_tool(input_data: HybridSearchInput) -> List[ChunkResult]:
    """
    Perform hybrid search (vector + keyword + title matching).
    
    Args:
        input_data: Search parameters
    
    Returns:
        List of matching chunks
    """
    try:
        # First, try to find exact or fuzzy title matches
        title_results = await search_by_title(
            query=input_data.query,
            collection_ids=input_data.collection_ids,
            document_ids=input_data.document_ids
        )
        
        # Generate embedding for the query
        embedding = await generate_embedding(input_data.query)
        
        # Perform hybrid search
        hybrid_results = await hybrid_search(
            embedding=embedding,
            query_text=input_data.query,
            limit=input_data.limit,
            text_weight=input_data.text_weight,
            collection_ids=input_data.collection_ids,
            document_ids=input_data.document_ids,
        )
        
        # Combine results, prioritizing title matches
        combined_results = []
        
        # Add title matches first (boost their scores)
        for r in title_results[:5]:  # Top 5 title matches
            combined_results.append(
                ChunkResult(
                    chunk_id=str(r["chunk_id"]),
                    document_id=str(r["document_id"]),
                    content=r["content"],
                    score=min(0.98, r.get("similarity", 0.9) + 0.3),  # Boost title matches
                    metadata={**r["metadata"], "match_type": "title_match"},
                    document_title=r["document_title"],
                    document_source=r["document_source"]
                )
            )
        
        # Add hybrid results, avoiding duplicates
        title_chunk_ids = {r["chunk_id"] for r in title_results}
        for r in hybrid_results:
            if r["chunk_id"] not in title_chunk_ids:
                combined_results.append(
                    ChunkResult(
                        chunk_id=str(r["chunk_id"]),
                        document_id=str(r["document_id"]),
                        content=r["content"],
                        score=r["combined_score"],
                        metadata={**r["metadata"], "match_type": "hybrid"},
                        document_title=r["document_title"],
                        document_source=r["document_source"]
                    )
                )
        
        # Sort by score and return top results
        combined_results.sort(key=lambda x: x.score, reverse=True)
        return combined_results[:input_data.limit]
        
    except Exception as e:
        logger.error(f"Hybrid search failed: {e}")
        return []


async def get_document_tool(input_data: DocumentInput) -> Optional[Dict[str, Any]]:
    """
    Retrieve a complete document.
    
    Args:
        input_data: Document retrieval parameters
    
    Returns:
        Document data or None
    """
    try:
        document = await get_document(input_data.document_id)
        
        if document:
            # Also get all chunks for the document
            chunks = await get_document_chunks(input_data.document_id)
            document["chunks"] = chunks
        
        return document
        
    except Exception as e:
        logger.error(f"Document retrieval failed: {e}")
        return None


async def list_documents_tool(input_data: DocumentListInput) -> List[DocumentMetadata]:
    """
    List available documents.
    
    Args:
        input_data: Listing parameters
    
    Returns:
        List of document metadata
    """
    try:
        documents = await list_documents(
            limit=input_data.limit,
            offset=input_data.offset,
            collection_ids=input_data.collection_ids,
            document_ids=input_data.document_ids,
        )
        
        # Convert to DocumentMetadata models
        return [
            DocumentMetadata(
                id=d["id"],
                title=d["title"],
                source=d["source"],
                metadata=d["metadata"],
                created_at=datetime.fromisoformat(d["created_at"]),
                updated_at=datetime.fromisoformat(d["updated_at"]),
                chunk_count=d.get("chunk_count")
            )
            for d in documents
        ]
        
    except Exception as e:
        logger.error(f"Document listing failed: {e}")
        return []


async def get_entity_relationships_tool(input_data: EntityRelationshipInput) -> Dict[str, Any]:
    """
    Get relationships for an entity.
    
    Args:
        input_data: Entity relationship parameters
    
    Returns:
        Entity relationships
    """
    try:
        return await get_entity_relationships(
            entity=input_data.entity_name,
            depth=input_data.depth
        )
        
    except Exception as e:
        logger.error(f"Entity relationship query failed: {e}")
        return {
            "central_entity": input_data.entity_name,
            "related_entities": [],
            "relationships": [],
            "depth": input_data.depth,
            "error": str(e)
        }


async def get_entity_timeline_tool(input_data: EntityTimelineInput) -> List[Dict[str, Any]]:
    """
    Get timeline of facts for an entity.
    
    Args:
        input_data: Timeline query parameters
    
    Returns:
        Timeline of facts
    """
    try:
        # Parse dates if provided
        start_date = None
        end_date = None
        
        if input_data.start_date:
            start_date = datetime.fromisoformat(input_data.start_date)
        if input_data.end_date:
            end_date = datetime.fromisoformat(input_data.end_date)
        
        # Get timeline from graph
        timeline = await graph_client.get_entity_timeline(
            entity_name=input_data.entity_name,
            start_date=start_date,
            end_date=end_date
        )
        
        return timeline
        
    except Exception as e:
        logger.error(f"Entity timeline query failed: {e}")
        return []


# Combined search function for agent use
async def perform_comprehensive_search(
    query: str,
    use_vector: bool = True,
    use_graph: bool = True,
    limit: int = 10
) -> Dict[str, Any]:
    """
    Perform a comprehensive search using multiple methods.
    
    Args:
        query: Search query
        use_vector: Whether to use vector search
        use_graph: Whether to use graph search
        limit: Maximum results per search type (only applies to vector search)
    
    Returns:
        Combined search results
    """
    results = {
        "query": query,
        "vector_results": [],
        "graph_results": [],
        "total_results": 0
    }
    
    tasks = []
    
    if use_vector:
        tasks.append(vector_search_tool(VectorSearchInput(query=query, limit=limit)))
    
    if use_graph:
        tasks.append(graph_search_tool(GraphSearchInput(query=query)))
    
    if tasks:
        search_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        if use_vector and not isinstance(search_results[0], Exception):
            results["vector_results"] = search_results[0]
        
        if use_graph:
            graph_idx = 1 if use_vector else 0
            if not isinstance(search_results[graph_idx], Exception):
                results["graph_results"] = search_results[graph_idx]
    
    results["total_results"] = len(results["vector_results"]) + len(results["graph_results"])
    
    return results