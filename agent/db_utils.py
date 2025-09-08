"""
Database utilities for PostgreSQL connection and operations.
"""

import os
import json
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager
from uuid import UUID
import logging

import asyncpg
from asyncpg.pool import Pool
from dotenv import load_dotenv
import time

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


class DatabasePool:
    """
    Manages the connection pool to the PostgreSQL database.

    This class handles the initialization, acquisition, and closing of database
    connections, ensuring efficient and reliable database access.
    """
    
    def __init__(self, database_url: Optional[str] = None):
        """
        Initializes the DatabasePool.

        Args:
            database_url: The connection URL for the PostgreSQL database. If not
                          provided, it will be read from the DATABASE_URL
                          environment variable.
        """
        self.database_url = database_url or os.getenv("DATABASE_URL")
        if not self.database_url:
            raise ValueError("DATABASE_URL environment variable not set")
        # Whether to require SSL when connecting (for providers like Neon/Supabase)
        # Accepts: 1/true/yes/on/require (case-insensitive)
        self.ssl_required = os.getenv("POSTGRES_SSL", "").lower() in ("1", "true", "yes", "on", "require")

        self.pool: Optional[Pool] = None
    
    async def initialize(self):
        """
        Creates and initializes the database connection pool.

        This method should be called at application startup to establish the
        database connections.
        """
        if not self.pool:
            # Ensure we don't hang indefinitely on unreachable DBs
            # Configure via POSTGRES_CONNECT_TIMEOUT (seconds), default 10s
            try:
                connect_timeout = float(os.getenv("POSTGRES_CONNECT_TIMEOUT", "10"))
            except Exception:
                connect_timeout = 10.0
            start = time.perf_counter()
            try:
                self.pool = await asyncpg.create_pool(
                    self.database_url,
                    min_size=5,
                    max_size=20,
                    max_inactive_connection_lifetime=300,
                    command_timeout=60,
                    statement_cache_size=0,
                    ssl=self.ssl_required,
                    timeout=connect_timeout
                )
                elapsed = time.perf_counter() - start
                logger.info(
                    f"Database connection pool initialized (ssl={self.ssl_required}) in {elapsed:.3f}s"
                )
            except Exception as e:
                elapsed = time.perf_counter() - start
                logger.error(
                    f"Failed to initialize DB connection pool after {elapsed:.3f}s (timeout={connect_timeout}s): {e}"
                )
                raise
    
    async def close(self):
        """
        Closes the database connection pool.

        This method should be called at application shutdown to gracefully
        terminate all database connections.
        """
        if self.pool:
            await self.pool.close()
            self.pool = None
            logger.info("Database connection pool closed")
    
    @asynccontextmanager
    async def acquire(self):
        """
        An asynchronous context manager to acquire a database connection from the pool.

        Yields:
            An `asyncpg.Connection` object.
        """
        if not self.pool:
            await self.initialize()
        
        # Apply timeout to acquisition to avoid indefinite waits when pool is exhausted
        try:
            acquire_timeout = float(os.getenv("POSTGRES_ACQUIRE_TIMEOUT", "15"))
        except Exception:
            acquire_timeout = 15.0

        start = time.perf_counter()
        try:
            async with self.pool.acquire(timeout=acquire_timeout) as connection:
                logger.debug(
                    f"DB connection acquired in {time.perf_counter() - start:.3f}s"
                )
                yield connection
        except Exception as e:
            elapsed = time.perf_counter() - start
            logger.error(
                f"Failed to acquire DB connection after {elapsed:.3f}s (timeout={acquire_timeout}s): {e}"
            )
            raise


# Global database pool instance (lazy initialization)
_db_pool_instance: Optional[DatabasePool] = None

def get_db_pool() -> DatabasePool:
    """
    Gets the global instance of the DatabasePool, initializing it if necessary.

    This function implements a singleton pattern for the database pool to ensure
    that only one pool is created per application instance.

    Returns:
        The singleton `DatabasePool` instance.
    """
    global _db_pool_instance
    if _db_pool_instance is None:
        _db_pool_instance = DatabasePool()
    return _db_pool_instance

# For backward compatibility, provide db_pool as a property
class _DBPoolProxy:
    def __getattr__(self, name):
        return getattr(get_db_pool(), name)

    async def __aenter__(self):
        return await get_db_pool().__aenter__()

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return await get_db_pool().__aexit__(exc_type, exc_val, exc_tb)

db_pool = _DBPoolProxy()


async def initialize_database():
    """
    Initializes the global database connection pool.

    This is a convenience function to be called at application startup.
    """
    await db_pool.initialize()


async def close_database():
    """
    Closes the global database connection pool.

    This is a convenience function to be called at application shutdown.
    """
    await db_pool.close()


# Session Management Functions
async def create_session(
    user_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    timeout_minutes: int = 60
) -> str:
    """
    Creates a new session in the database.

    Args:
        user_id: An optional identifier for the user creating the session.
        metadata: An optional dictionary of metadata to associate with the session.
        timeout_minutes: The duration in minutes before the session expires.

    Returns:
        The UUID of the newly created session as a string.
    """
    async with db_pool.acquire() as conn:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=timeout_minutes)
        
        result = await conn.fetchrow(
            """
            INSERT INTO sessions (user_id, metadata, expires_at)
            VALUES ($1, $2, $3)
            RETURNING id::text
            """,
            user_id,
            json.dumps(metadata or {}),
            expires_at
        )
        
        return result["id"]


async def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a session from the database by its ID.

    Args:
        session_id: The UUID of the session to retrieve.

    Returns:
        A dictionary containing the session data if found and not expired,
        otherwise None.
    """
    async with db_pool.acquire() as conn:
        result = await conn.fetchrow(
            """
            SELECT 
                id::text,
                user_id,
                metadata,
                created_at,
                updated_at,
                expires_at
            FROM sessions
            WHERE id = $1::uuid
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            """,
            session_id
        )
        
        if result:
            return {
                "id": result["id"],
                "user_id": result["user_id"],
                "metadata": json.loads(result["metadata"]),
                "created_at": result["created_at"].isoformat(),
                "updated_at": result["updated_at"].isoformat(),
                "expires_at": result["expires_at"].isoformat() if result["expires_at"] else None
            }
        
        return None


async def update_session(session_id: str, metadata: Dict[str, Any]) -> bool:
    """
    Updates the metadata of an existing session.

    The new metadata is merged with the existing metadata.

    Args:
        session_id: The UUID of the session to update.
        metadata: A dictionary of metadata to merge into the session's metadata.

    Returns:
        True if the session was updated successfully, False otherwise.
    """
    async with db_pool.acquire() as conn:
        result = await conn.execute(
            """
            UPDATE sessions
            SET metadata = metadata || $2::jsonb
            WHERE id = $1::uuid
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            """,
            session_id,
            json.dumps(metadata)
        )
        
        return result.split()[-1] != "0"


# Message Management Functions
async def add_message(
    session_id: str,
    role: str,
    content: str,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """
    Adds a new message to a session's conversation history.

    Args:
        session_id: The UUID of the session to add the message to.
        role: The role of the message sender (e.g., 'user', 'assistant').
        content: The text content of the message.
        metadata: An optional dictionary of metadata for the message.

    Returns:
        The UUID of the newly created message as a string.
    """
    async with db_pool.acquire() as conn:
        result = await conn.fetchrow(
            """
            INSERT INTO messages (session_id, role, content, metadata)
            VALUES ($1::uuid, $2, $3, $4)
            RETURNING id::text
            """,
            session_id,
            role,
            content,
            json.dumps(metadata or {})
        )
        
        return result["id"]


async def get_session_messages(
    session_id: str,
    limit: Optional[int] = None
) -> List[Dict[str, Any]]:
    """
    Retrieves the messages from a specific session.

    Args:
        session_id: The UUID of the session to get messages from.
        limit: An optional maximum number of messages to return.

    Returns:
        A list of messages, ordered by their creation time.
    """
    async with db_pool.acquire() as conn:
        query = """
            SELECT 
                id::text,
                role,
                content,
                metadata,
                created_at
            FROM messages
            WHERE session_id = $1::uuid
            ORDER BY created_at
        """
        
        if limit:
            query += f" LIMIT {limit}"
        
        results = await conn.fetch(query, session_id)
        
        return [
            {
                "id": row["id"],
                "role": row["role"],
                "content": row["content"],
                "metadata": json.loads(row["metadata"]),
                "created_at": row["created_at"].isoformat()
            }
            for row in results
        ]


# Document Management Functions
async def get_document(document_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a document from the database by its ID.

    Args:
        document_id: The UUID of the document to retrieve.

    Returns:
        A dictionary containing the document's data, or None if not found.
    """
    async with db_pool.acquire() as conn:
        result = await conn.fetchrow(
            """
            SELECT 
                id::text,
                title,
                source,
                content,
                metadata,
                created_at,
                updated_at
            FROM documents
            WHERE id = $1::uuid
            """,
            document_id
        )
        
        if result:
            return {
                "id": result["id"],
                "title": result["title"],
                "source": result["source"],
                "content": result["content"],
                "metadata": json.loads(result["metadata"]),
                "created_at": result["created_at"].isoformat(),
                "updated_at": result["updated_at"].isoformat()
            }
        
        return None


async def list_documents(
    limit: int = 100,
    offset: int = 0,
    metadata_filter: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Lists documents from the database with optional filtering and pagination.

    Args:
        limit: The maximum number of documents to return.
        offset: The number of documents to skip for pagination.
        metadata_filter: An optional dictionary to filter documents by their metadata.

    Returns:
        A list of documents, each as a dictionary.
    """
    async with db_pool.acquire() as conn:
        query = """
            SELECT 
                d.id::text,
                d.title,
                d.source,
                d.metadata,
                d.created_at,
                d.updated_at,
                COUNT(c.id) AS chunk_count
            FROM documents d
            LEFT JOIN chunks c ON d.id = c.document_id
        """
        
        params = []
        conditions = []
        
        if metadata_filter:
            conditions.append(f"d.metadata @> ${len(params) + 1}::jsonb")
            params.append(json.dumps(metadata_filter))
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        query += """
            GROUP BY d.id, d.title, d.source, d.metadata, d.created_at, d.updated_at
            ORDER BY d.created_at DESC
            LIMIT $%d OFFSET $%d
        """ % (len(params) + 1, len(params) + 2)
        results = await conn.fetch(query, *params, limit, offset)
        return [
            {
                "id": row["id"],
                "title": row["title"],
                "source": row["source"],
                "metadata": json.loads(row["metadata"]),
                "created_at": row["created_at"].isoformat(),
                "updated_at": row["updated_at"].isoformat(),
                "chunk_count": row["chunk_count"]
            }
            for row in results
        ]


async def list_collections_db(
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
    created_by: Optional[str] = None,
    workspace_id: Optional[str] = None,
    is_shared: Optional[bool] = None
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Lists collections from the database with filtering and pagination.

    Args:
        limit: The maximum number of collections to return.
        offset: The number of collections to skip for pagination.
        search: An optional search term to filter collections by name or description.
        created_by: An optional user ID to filter collections by their creator.
        workspace_id: An optional workspace ID to filter collections.
        is_shared: An optional boolean to filter for shared collections.

    Returns:
        A tuple containing a list of collections and the total count of collections
        that match the filter criteria.
    """
    async with db_pool.acquire() as conn:
        base_where = []
        params = []

        try:
            if search:
                base_where.append(f"(name ILIKE ${len(params)+1} OR description ILIKE ${len(params)+1})")
                params.append(f"%{search}%")
            if created_by:
                base_where.append(f"created_by = ${len(params)+1}")
                params.append(created_by)
            if workspace_id:
                # Validate UUID early to avoid opaque DB cast errors
                try:
                    _ = UUID(str(workspace_id))
                except Exception:
                    logger.warning("Invalid workspace_id provided to list_collections_db: %s", workspace_id)
                    raise
                base_where.append(f"workspace_id = ${len(params)+1}::uuid")
                params.append(workspace_id)
            if is_shared is not None:
                base_where.append(f"is_shared = ${len(params)+1}")
                params.append(is_shared)

            where_clause = f"WHERE {' AND '.join(base_where)}" if base_where else ""

            # Log the constructed query details
            logger.info(
                "Collections query: where='%s', params=%s, limit=%s, offset=%s",
                where_clause,
                params,
                limit,
                offset,
            )

            # Total count
            count_query = f"""
                SELECT COUNT(*)
                FROM collections
                {where_clause}
            """
            total: int = await conn.fetchval(count_query, *params)

            # Paged results
            list_query = f"""
                SELECT 
                    id::text as id,
                    name,
                    description,
                    color,
                    icon,
                    created_by,
                    is_shared,
                    workspace_id::text as workspace_id,
                    document_count,
                    total_size,
                    last_accessed,
                    metadata,
                    created_at,
                    updated_at
                FROM collections
                {where_clause}
                ORDER BY updated_at DESC
                LIMIT ${len(params)+1} OFFSET ${len(params)+2}
            """

            list_params = params + [limit, offset]
            rows = await conn.fetch(list_query, *list_params)

            logger.info("Collections fetched: %d rows (total=%d)", len(rows), total)

            collections = [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "description": r["description"],
                    "color": r["color"],
                    "icon": r["icon"],
                    "created_by": r["created_by"],
                    "is_shared": r["is_shared"],
                    "workspace_id": r["workspace_id"],
                    "document_count": r["document_count"],
                    "total_size": r["total_size"],
                    "last_accessed": r["last_accessed"].isoformat() if r["last_accessed"] else None,
                    "metadata": r["metadata"] if isinstance(r["metadata"], dict) else (json.loads(r["metadata"]) if r["metadata"] else {}),
                    "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                    "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
                }
                for r in rows
            ]

            return collections, total
        except Exception:
            # Log full traceback for diagnostics
            logger.exception(
                "Error in list_collections_db with where='%s', params=%s, limit=%s, offset=%s",
                ' AND '.join(base_where) if base_where else '',
                params,
                limit,
                offset,
            )
            raise


async def delete_document(document_id: str) -> bool:
    """
    Deletes a document and its associated chunks from the database.

    Args:
        document_id: The UUID of the document to delete.

    Returns:
        True if the document was deleted successfully, False otherwise.
    """
    async with db_pool.acquire() as conn:
        result = await conn.execute(
            """
            DELETE FROM documents 
            WHERE id = $1::uuid
            """,
            document_id
        )
        
        # Extract the number of rows affected from the result string
        rows_affected = int(result.split()[-1]) if result and result.startswith("DELETE") else 0
        return rows_affected > 0


async def create_collection_db(
    *,
    name: str,
    description: Optional[str] = None,
    color: str = "#6366f1",
    icon: str = "folder",
    is_shared: bool = False,
    created_by: Optional[str] = None,
    workspace_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Creates a new collection in the database.

    Args:
        name: The name of the collection.
        description: An optional description for the collection.
        color: A hex color string for the collection's icon.
        icon: The name of the icon for the collection.
        is_shared: A boolean indicating if the collection is shared.
        created_by: An optional identifier for the user who created the collection.
        workspace_id: An optional UUID for the workspace the collection belongs to.
        metadata: An optional dictionary of metadata for the collection.

    Returns:
        A dictionary representing the newly created collection.
    """
    async with db_pool.acquire() as conn:
        # Validate workspace_id format early if provided
        if workspace_id:
            try:
                _ = UUID(str(workspace_id))
            except Exception:
                logger.warning("Invalid workspace_id provided to create_collection_db: %s", workspace_id)
                raise

        row = await conn.fetchrow(
            """
            INSERT INTO collections (
                name,
                description,
                color,
                icon,
                created_by,
                is_shared,
                workspace_id,
                metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::uuid, $8::jsonb)
            RETURNING 
                id::text as id,
                name,
                description,
                color,
                icon,
                created_by,
                is_shared,
                workspace_id::text as workspace_id,
                document_count,
                total_size,
                last_accessed,
                metadata,
                created_at,
                updated_at
            """,
            name,
            description,
            color,
            icon,
            created_by,
            is_shared,
            workspace_id,
            json.dumps(metadata or {}),
        )

        if not row:
            raise RuntimeError("Failed to create collection")

        return {
            "id": row["id"],
            "name": row["name"],
            "description": row["description"],
            "color": row["color"],
            "icon": row["icon"],
            "created_by": row["created_by"],
            "is_shared": row["is_shared"],
            "workspace_id": row["workspace_id"],
            "document_count": row["document_count"],
            "total_size": row["total_size"],
            "last_accessed": row["last_accessed"].isoformat() if row["last_accessed"] else None,
            "metadata": row["metadata"] if isinstance(row["metadata"], dict) else (json.loads(row["metadata"]) if row["metadata"] else {}),
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
        }


# Vector Search Functions
async def vector_search(
    embedding: List[float],
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Performs a vector similarity search in the database.

    Args:
        embedding: The query vector to search for.
        limit: The maximum number of results to return.

    Returns:
        A list of matching chunks, ordered by similarity.
    """
    async with db_pool.acquire() as conn:
        # Convert embedding to PostgreSQL vector string format
        # PostgreSQL vector format: '[1.0,2.0,3.0]' (no spaces after commas)
        embedding_str = '[' + ','.join(map(str, embedding)) + ']'
        
        results = await conn.fetch(
            "SELECT * FROM match_chunks($1::vector, $2)",
            embedding_str,
            limit
        )
        
        return [
            {
                "chunk_id": row["chunk_id"],
                "document_id": row["document_id"],
                "content": row["content"],
                "similarity": row["similarity"],
                "metadata": json.loads(row["metadata"]),
                "document_title": row["document_title"],
                "document_source": row["document_source"]
            }
            for row in results
        ]


async def hybrid_search(
    embedding: List[float],
    query_text: str,
    limit: int = 10,
    text_weight: float = 0.3
) -> List[Dict[str, Any]]:
    """
    Performs a hybrid search, combining vector and full-text search.

    Args:
        embedding: The query vector for the similarity search.
        query_text: The text query for the full-text search.
        limit: The maximum number of results to return.
        text_weight: The weight to give to the text search score in the
                     final ranking, between 0.0 and 1.0.

    Returns:
        A list of matching chunks, ordered by a combined score.
    """
    async with db_pool.acquire() as conn:
        # Convert embedding to PostgreSQL vector string format
        # PostgreSQL vector format: '[1.0,2.0,3.0]' (no spaces after commas)
        embedding_str = '[' + ','.join(map(str, embedding)) + ']'
        
        results = await conn.fetch(
            "SELECT * FROM hybrid_search($1::vector, $2, $3, $4)",
            embedding_str,
            query_text,
            limit,
            text_weight
        )
        
        return [
            {
                "chunk_id": row["chunk_id"],
                "document_id": row["document_id"],
                "content": row["content"],
                "combined_score": row["combined_score"],
                "vector_similarity": row["vector_similarity"],
                "text_similarity": row["text_similarity"],
                "metadata": json.loads(row["metadata"]),
                "document_title": row["document_title"],
                "document_source": row["document_source"]
            }
            for row in results
        ]


# Chunk Management Functions
async def get_document_chunks(document_id: str) -> List[Dict[str, Any]]:
    """
    Retrieves all chunks associated with a specific document.

    Args:
        document_id: The UUID of the document to retrieve chunks for.

    Returns:
        A list of chunks, ordered by their index within the document.
    """
    async with db_pool.acquire() as conn:
        results = await conn.fetch(
            "SELECT * FROM get_document_chunks($1::uuid)",
            document_id
        )
        
        return [
            {
                "chunk_id": row["chunk_id"],
                "content": row["content"],
                "chunk_index": row["chunk_index"],
                "metadata": json.loads(row["metadata"])
            }
            for row in results
        ]


# Utility Functions
async def execute_query(query: str, *params) -> List[Dict[str, Any]]:
    """
    Executes a custom SQL query against the database.

    This function provides a way to run arbitrary SQL queries, but should be used
    with caution to avoid SQL injection vulnerabilities.

    Args:
        query: The SQL query string to execute.
        *params: A variable number of parameters to be used in the query.

    Returns:
        A list of dictionaries representing the query results.
    """
    async with db_pool.acquire() as conn:
        results = await conn.fetch(query, *params)
        return [dict(row) for row in results]


async def test_connection() -> bool:
    """
    Tests the connection to the database.

    Returns:
        True if the connection is successful, False otherwise.
    """
    try:
        async with db_pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return True
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        return False


# Knowledge Graph Functions

async def upsert_node(
    name: str,
    node_type: str,
    description: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """
    Inserts a new node into the knowledge graph, or updates it if it already exists.

    Args:
        name: The name of the node.
        node_type: The type of the node (e.g., 'person', 'company').
        description: An optional description for the node.
        metadata: An optional dictionary of metadata for the node.

    Returns:
        The UUID of the upserted node as a string.
    """
    async with db_pool.acquire() as conn:
        # Server-side timeouts
        try:
            st_ms = int(os.getenv("POSTGRES_STATEMENT_TIMEOUT_MS", "20000"))
        except Exception:
            st_ms = 20000
        try:
            lock_ms = int(os.getenv("POSTGRES_LOCK_TIMEOUT_MS", "5000"))
        except Exception:
            lock_ms = 5000

        start_total = time.perf_counter()
        async with conn.transaction():
            await conn.execute(f"SET LOCAL statement_timeout = {st_ms}")
            await conn.execute(f"SET LOCAL lock_timeout = {lock_ms}")

            start = time.perf_counter()
            result = await conn.fetchrow(
                """
                INSERT INTO nodes (name, type, description, metadata)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (name, type)
                DO UPDATE SET
                    description = EXCLUDED.description,
                    metadata = EXCLUDED.metadata,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id::text
                """,
                name,
                node_type,
                description,
                json.dumps(metadata or {})
            )
            logger.info(
                f"upsert_node(name='{name}', type='{node_type}') executed in {time.perf_counter() - start:.3f}s"
            )

        logger.debug(
            f"upsert_node total elapsed {time.perf_counter() - start_total:.3f}s (statement_timeout={st_ms}ms, lock_timeout={lock_ms}ms)"
        )
        return result["id"]


async def create_relationship(
    source_node_id: str,
    target_node_id: str,
    relationship_type: str,
    description: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """
    Creates a new relationship (an edge) between two nodes in the knowledge graph.

    Args:
        source_node_id: The UUID of the source node.
        target_node_id: The UUID of the target node.
        relationship_type: The type of the relationship.
        description: An optional description for the relationship.
        metadata: An optional dictionary of metadata for the relationship.

    Returns:
        The UUID of the newly created relationship as a string.
    """
    async with db_pool.acquire() as conn:
        # Server-side timeouts
        try:
            st_ms = int(os.getenv("POSTGRES_STATEMENT_TIMEOUT_MS", "20000"))
        except Exception:
            st_ms = 20000
        try:
            lock_ms = int(os.getenv("POSTGRES_LOCK_TIMEOUT_MS", "5000"))
        except Exception:
            lock_ms = 5000

        start_total = time.perf_counter()
        async with conn.transaction():
            await conn.execute(f"SET LOCAL statement_timeout = {st_ms}")
            await conn.execute(f"SET LOCAL lock_timeout = {lock_ms}")

            start = time.perf_counter()
            result = await conn.fetchrow(
                """
                INSERT INTO edges (source_node_id, target_node_id, relationship_type, description, metadata)
                VALUES ($1::uuid, $2::uuid, $3, $4, $5)
                ON CONFLICT (source_node_id, target_node_id, relationship_type)
                DO UPDATE SET
                    description = EXCLUDED.description,
                    metadata = EXCLUDED.metadata
                RETURNING id::text
                """,
                source_node_id,
                target_node_id,
                relationship_type,
                description,
                json.dumps(metadata or {})
            )
            logger.info(
                f"create_relationship(type='{relationship_type}') executed in {time.perf_counter() - start:.3f}s"
            )

        logger.debug(
            f"create_relationship total elapsed {time.perf_counter() - start_total:.3f}s (statement_timeout={st_ms}ms, lock_timeout={lock_ms}ms)"
        )
        return result["id"]


async def add_fact(
    node_id: str,
    content: str,
    source: str,
    valid_at: Optional[datetime] = None,
    invalid_at: Optional[datetime] = None,
    confidence: float = 1.0,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """
    Adds a new fact to a node in the knowledge graph.

    Args:
        node_id: The UUID of the node to which the fact belongs.
        content: The textual content of the fact.
        source: The source from which the fact was derived.
        valid_at: An optional timestamp for when the fact became valid.
        invalid_at: An optional timestamp for when the fact became invalid.
        confidence: A confidence score for the fact, between 0.0 and 1.0.
        metadata: An optional dictionary of metadata for the fact.

    Returns:
        The UUID of the newly created fact as a string.
    """
    async with db_pool.acquire() as conn:
        # Server-side timeouts
        try:
            st_ms = int(os.getenv("POSTGRES_STATEMENT_TIMEOUT_MS", "20000"))
        except Exception:
            st_ms = 20000
        try:
            lock_ms = int(os.getenv("POSTGRES_LOCK_TIMEOUT_MS", "5000"))
        except Exception:
            lock_ms = 5000

        start_total = time.perf_counter()
        async with conn.transaction():
            await conn.execute(f"SET LOCAL statement_timeout = {st_ms}")
            await conn.execute(f"SET LOCAL lock_timeout = {lock_ms}")

            start = time.perf_counter()
            result = await conn.fetchrow(
                """
                INSERT INTO facts (node_id, content, source, valid_at, invalid_at, confidence, metadata)
                VALUES ($1::uuid, $2, $3, $4, $5, $6, $7)
                RETURNING id::text
                """,
                node_id,
                content,
                source,
                valid_at or datetime.now(timezone.utc),
                invalid_at,
                confidence,
                json.dumps(metadata or {})
            )
            logger.info(
                f"add_fact(node_id={node_id}) executed in {time.perf_counter() - start:.3f}s"
            )

        logger.debug(
            f"add_fact total elapsed {time.perf_counter() - start_total:.3f}s (statement_timeout={st_ms}ms, lock_timeout={lock_ms}ms)"
        )
        return result["id"]


async def search_facts(
    query: str,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """
    Searches for facts using full-text search.

    Args:
        query: The search query string.
        limit: The maximum number of results to return.

    Returns:
        A list of matching facts, including information about their associated nodes.
    """
    async with db_pool.acquire() as conn:
        results = await conn.fetch(
            "SELECT * FROM search_facts($1, $2)",
            query,
            limit
        )

        return [
            {
                "fact_id": row["fact_id"],
                "node_id": row["node_id"],
                "node_name": row["node_name"],
                "node_type": row["node_type"],
                "content": row["content"],
                "source": row["source"],
                "valid_at": row["valid_at"].isoformat() if row["valid_at"] else None,
                "invalid_at": row["invalid_at"].isoformat() if row["invalid_at"] else None,
                "confidence": row["confidence"],
                "rank": row["rank"]
            }
            for row in results
        ]


async def get_entity_relationships(
    entity_name: str,
    depth: int = 2
) -> Dict[str, Any]:
    """
    Retrieves the relationships of a specific entity from the knowledge graph.

    Args:
        entity_name: The name of the entity to get relationships for.
        depth: The maximum depth to traverse for relationships.

    Returns:
        A dictionary containing the entity's relationships.
    """
    async with db_pool.acquire() as conn:
        results = await conn.fetch(
            "SELECT * FROM get_entity_relationships($1, $2)",
            entity_name,
            depth
        )

        relationships = [
            {
                "source_name": row["source_name"],
                "source_type": row["source_type"],
                "relationship_type": row["relationship_type"],
                "target_name": row["target_name"],
                "target_type": row["target_type"],
                "relationship_description": row["relationship_description"]
            }
            for row in results
        ]

        return {
            "central_entity": entity_name,
            "related_facts": [],  # We'll add this from facts table
            "relationships": relationships,
            "search_method": "postgresql_graph_search"
        }


async def get_entity_timeline(
    entity_name: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> List[Dict[str, Any]]:
    """
    Retrieves a chronological timeline of facts for a specific entity.

    Args:
        entity_name: The name of the entity to get the timeline for.
        start_date: An optional start date for the timeline.
        end_date: An optional end date for the timeline.

    Returns:
        A list of facts, ordered chronologically.
    """
    async with db_pool.acquire() as conn:
        results = await conn.fetch(
            "SELECT * FROM get_entity_timeline($1, $2, $3)",
            entity_name,
            start_date,
            end_date
        )

        return [
            {
                "fact_id": row["fact_id"],
                "content": row["content"],
                "source": row["source"],
                "valid_at": row["valid_at"].isoformat() if row["valid_at"] else None,
                "invalid_at": row["invalid_at"].isoformat() if row["invalid_at"] else None,
                "confidence": row["confidence"]
            }
            for row in results
        ]


async def get_graph_statistics() -> Dict[str, Any]:
    """
    Retrieves basic statistics about the knowledge graph.

    This function provides a high-level overview of the graph's size and composition.

    Returns:
        A dictionary containing graph statistics, such as the number of nodes and edges.
    """
    async with db_pool.acquire() as conn:
        # Server-side timeouts
        try:
            st_ms = int(os.getenv("POSTGRES_STATEMENT_TIMEOUT_MS", "20000"))
        except Exception:
            st_ms = 20000
        try:
            lock_ms = int(os.getenv("POSTGRES_LOCK_TIMEOUT_MS", "5000"))
        except Exception:
            lock_ms = 5000

        total_start = time.perf_counter()
        async with conn.transaction():
            await conn.execute(f"SET LOCAL statement_timeout = {st_ms}")
            await conn.execute(f"SET LOCAL lock_timeout = {lock_ms}")

            t = time.perf_counter()
            node_count = await conn.fetchval("SELECT COUNT(*) FROM nodes")
            logger.info(f"get_graph_statistics: nodes count in {time.perf_counter() - t:.3f}s")

            t = time.perf_counter()
            edge_count = await conn.fetchval("SELECT COUNT(*) FROM edges")
            logger.info(f"get_graph_statistics: edges count in {time.perf_counter() - t:.3f}s")

            t = time.perf_counter()
            fact_count = await conn.fetchval("SELECT COUNT(*) FROM facts")
            logger.info(f"get_graph_statistics: facts count in {time.perf_counter() - t:.3f}s")

            # Get nodes by type
            t = time.perf_counter()
            type_results = await conn.fetch(
                """
                SELECT type, COUNT(*) as count
                FROM nodes
                GROUP BY type
                ORDER BY count DESC
                """
            )
            logger.info(f"get_graph_statistics: nodes_by_type in {time.perf_counter() - t:.3f}s")

        logger.debug(
            f"get_graph_statistics total elapsed {time.perf_counter() - total_start:.3f}s (statement_timeout={st_ms}ms, lock_timeout={lock_ms}ms)"
        )

        nodes_by_type = {row["type"]: row["count"] for row in type_results}

        return {
            "total_nodes": node_count,
            "total_edges": edge_count,
            "total_facts": fact_count,
            "nodes_by_type": nodes_by_type,
            "graph_initialized": True
        }


async def get_node_by_name(name: str, node_type: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Retrieves a node from the knowledge graph by its name.

    Args:
        name: The name of the node to retrieve.
        node_type: An optional type to filter the node by.

    Returns:
        A dictionary containing the node's data, or None if not found.
    """
    async with db_pool.acquire() as conn:
        # Server-side timeouts
        try:
            st_ms = int(os.getenv("POSTGRES_STATEMENT_TIMEOUT_MS", "20000"))
        except Exception:
            st_ms = 20000
        try:
            lock_ms = int(os.getenv("POSTGRES_LOCK_TIMEOUT_MS", "5000"))
        except Exception:
            lock_ms = 5000

        start_total = time.perf_counter()
        async with conn.transaction():
            await conn.execute(f"SET LOCAL statement_timeout = {st_ms}")
            await conn.execute(f"SET LOCAL lock_timeout = {lock_ms}")

            start = time.perf_counter()
            if node_type:
                result = await conn.fetchrow(
                    """
                    SELECT id::text, name, type, description, metadata, created_at, updated_at
                    FROM nodes
                    WHERE name = $1 AND type = $2
                    """,
                    name,
                    node_type
                )
            else:
                result = await conn.fetchrow(
                    """
                    SELECT id::text, name, type, description, metadata, created_at, updated_at
                    FROM nodes
                    WHERE name = $1
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    name
                )
            logger.info(
                f"get_node_by_name(name='{name}') executed in {time.perf_counter() - start:.3f}s"
            )

        logger.debug(
            f"get_node_by_name total elapsed {time.perf_counter() - start_total:.3f}s (statement_timeout={st_ms}ms, lock_timeout={lock_ms}ms)"
        )
        if result:
            return {
                "id": result["id"],
                "name": result["name"],
                "type": result["type"],
                "description": result["description"],
                "metadata": json.loads(result["metadata"]),
                "created_at": result["created_at"].isoformat(),
                "updated_at": result["updated_at"].isoformat()
            }

        return None


async def add_episode_to_graph(
    episode_id: str,
    content: str,
    source: str,
    metadata: Optional[Dict[str, Any]] = None
) -> str:
    """
    Adds content as an 'episode' to the knowledge graph.

    In a more advanced implementation, this function would also extract entities
    and relationships from the content.

    Args:
        episode_id: A unique identifier for the episode.
        content: The content of the episode.
        source: The source of the episode's content.
        metadata: An optional dictionary of metadata for the episode.

    Returns:
        The ID of the episode that was added.
    """
    # For now, we'll create a simple episode node
    # In a more advanced implementation, you'd use LLM to extract entities
    episode_node_id = await upsert_node(
        name=f"Episode {episode_id}",
        node_type="event",
        description=f"Episode from {source}",
        metadata={"episode_id": episode_id, "source": source}
    )

    # Add the content as a fact
    await add_fact(
        node_id=episode_node_id,
        content=content,
        source=source,
        metadata=metadata
    )

    logger.info(f"Added episode {episode_id} to knowledge graph")
    return episode_id


async def clear_graph() -> bool:
    """
    Clears all data from the knowledge graph.

    This is a destructive operation and should be used with caution.

    Returns:
        True if the graph was cleared successfully, False otherwise.
    """
    try:
        async with db_pool.acquire() as conn:
            # Server-side timeouts
            try:
                st_ms = int(os.getenv("POSTGRES_STATEMENT_TIMEOUT_MS", "60000"))
            except Exception:
                st_ms = 60000
            try:
                lock_ms = int(os.getenv("POSTGRES_LOCK_TIMEOUT_MS", "10000"))
            except Exception:
                lock_ms = 10000

            total = time.perf_counter()
            async with conn.transaction():
                await conn.execute(f"SET LOCAL statement_timeout = {st_ms}")
                await conn.execute(f"SET LOCAL lock_timeout = {lock_ms}")

                t = time.perf_counter()
                await conn.execute("DELETE FROM facts")
                logger.info(f"clear_graph: deleted facts in {time.perf_counter() - t:.3f}s")

                t = time.perf_counter()
                await conn.execute("DELETE FROM edges")
                logger.info(f"clear_graph: deleted edges in {time.perf_counter() - t:.3f}s")

                t = time.perf_counter()
                await conn.execute("DELETE FROM nodes")
                logger.info(f"clear_graph: deleted nodes in {time.perf_counter() - t:.3f}s")

            logger.warning(
                f"Cleared all data from knowledge graph in {time.perf_counter() - total:.3f}s (statement_timeout={st_ms}ms, lock_timeout={lock_ms}ms)"
            )
        return True
    except Exception as e:
        logger.error(f"Failed to clear graph: {e}")
        return False