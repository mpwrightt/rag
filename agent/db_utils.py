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
import ssl

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


class DatabasePool:
    """Manages PostgreSQL connection pool."""
    
    def __init__(self, database_url: Optional[str] = None):
        """
        Initialize database pool.
        
        Args:
            database_url: PostgreSQL connection URL
        """
        self.database_url = database_url or os.getenv("DATABASE_URL")
        if not self.database_url:
            raise ValueError("DATABASE_URL environment variable not set")
        # Whether to require SSL when connecting (for providers like Neon/Supabase)
        # Accepts: 1/true/yes/on/require (case-insensitive)
        self.ssl_required = os.getenv("POSTGRES_SSL", "").lower() in ("1", "true", "yes", "on", "require")
        # SSL behavior: disable | require (encrypt without verify) | verify-full (default)
        # In some hosts (e.g., minimal containers), root CAs may be missing which can cause
        # CERTIFICATE_VERIFY_FAILED. Use POSTGRES_SSL_MODE=require to skip verification but keep TLS.
        self.ssl_mode = os.getenv("POSTGRES_SSL_MODE", "verify-full").lower() if self.ssl_required else os.getenv("POSTGRES_SSL_MODE", "disable").lower()
        self.ssl_root_cert = os.getenv("POSTGRES_SSL_ROOT_CERT")  # Optional path to CA bundle

        self.pool: Optional[Pool] = None
    
    async def initialize(self):
        """Create connection pool."""
        if not self.pool:
            # Ensure we don't hang indefinitely on unreachable DBs
            # Configure via POSTGRES_CONNECT_TIMEOUT (seconds), default 10s
            try:
                connect_timeout = float(os.getenv("POSTGRES_CONNECT_TIMEOUT", "10"))
            except Exception:
                connect_timeout = 10.0
            start = time.perf_counter()
            try:
                # Build SSL parameter for asyncpg
                ssl_param: Optional[ssl.SSLContext | bool] = False
                if self.ssl_mode != "disable":
                    if self.ssl_mode in ("require", "allow", "prefer"):
                        # Encrypt traffic but skip certificate verification (similar to libpq sslmode=require)
                        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
                        ctx.check_hostname = False
                        ctx.verify_mode = ssl.CERT_NONE
                        ssl_param = ctx
                    elif self.ssl_mode in ("verify-full", "verify_ca"):
                        if self.ssl_root_cert:
                            ctx = ssl.create_default_context(cafile=self.ssl_root_cert)
                        else:
                            ctx = ssl.create_default_context()
                        # Default context verifies hostname and certificate
                        ssl_param = ctx
                    else:
                        # Backwards-compat: if unknown mode but ssl_required flag set, use default verification
                        if self.ssl_required:
                            ssl_param = True
                        else:
                            ssl_param = False
                else:
                    ssl_param = False

                self.pool = await asyncpg.create_pool(
                    self.database_url,
                    min_size=5,
                    max_size=20,
                    max_inactive_connection_lifetime=300,
                    command_timeout=60,
                    statement_cache_size=0,
                    ssl=ssl_param,
                    timeout=connect_timeout
                )
                elapsed = time.perf_counter() - start
                logger.info(
                    f"Database connection pool initialized (ssl_mode={self.ssl_mode}) in {elapsed:.3f}s"
                )
            except Exception as e:
                elapsed = time.perf_counter() - start
                logger.error(
                    f"Failed to initialize DB connection pool after {elapsed:.3f}s (timeout={connect_timeout}s, ssl_mode={self.ssl_mode}): {e}"
                )
                raise
    
    async def close(self):
        """Close connection pool."""
        if self.pool:
            await self.pool.close()
            self.pool = None
            logger.info("Database connection pool closed")
    
    @asynccontextmanager
    async def acquire(self):
        """Acquire a connection from the pool."""
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
    """Get the global database pool instance (lazy initialization)."""
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
    """Initialize database connection pool."""
    await db_pool.initialize()


async def close_database():
    """Close database connection pool."""
    await db_pool.close()


# Session Management Functions
async def create_session(
    user_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    timeout_minutes: int = 60
) -> str:
    """
    Create a new session.
    
    Args:
        user_id: Optional user identifier
        metadata: Optional session metadata
        timeout_minutes: Session timeout in minutes
    
    Returns:
        Session ID
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
    Get session by ID.
    
    Args:
        session_id: Session UUID
    
    Returns:
        Session data or None if not found/expired
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
    Update session metadata.
    
    Args:
        session_id: Session UUID
        metadata: New metadata to merge
    
    Returns:
        True if updated, False if not found
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
    Add a message to a session.
    
    Args:
        session_id: Session UUID
        role: Message role (user/assistant/system)
        content: Message content
        metadata: Optional message metadata
    
    Returns:
        Message ID
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
    Get messages for a session.
    
    Args:
        session_id: Session UUID
        limit: Maximum number of messages to return
    
    Returns:
        List of messages ordered by creation time
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
    Get document by ID.
    
    Args:
        document_id: Document UUID
    
    Returns:
        Document data or None if not found
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
    List documents with optional filtering.
    
    Args:
        limit: Maximum number of documents to return
        offset: Number of documents to skip
        metadata_filter: Optional metadata filter
    
    Returns:
        List of documents
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
    List collections with optional filtering and pagination.

    Args:
        limit: Max number of collections to return
        offset: Number of collections to skip
        search: Optional ILIKE search over name/description
        created_by: Filter by creator
        workspace_id: Filter by workspace UUID
        is_shared: Filter by shared status

    Returns:
        (collections, total_count)
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
    Delete document by ID. This will cascade delete all associated chunks.
    
    Args:
        document_id: Document UUID
        
    Returns:
        True if document was deleted, False if not found
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
    Create a new collection.

    Args:
        name: Collection name
        description: Optional description
        color: Hex color string
        icon: Icon name
        is_shared: Whether the collection is shared
        created_by: Creator identifier (email/user id)
        workspace_id: Workspace UUID as string
        metadata: Optional metadata dict

    Returns:
        Created collection as a dict with fields matching list_collections_db
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
    Perform vector similarity search.
    
    Args:
        embedding: Query embedding vector
        limit: Maximum number of results
    
    Returns:
        List of matching chunks ordered by similarity (best first)
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
    Perform hybrid search (vector + keyword).
    
    Args:
        embedding: Query embedding vector
        query_text: Query text for keyword search
        limit: Maximum number of results
        text_weight: Weight for text similarity (0-1)
    
    Returns:
        List of matching chunks ordered by combined score (best first)
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
    Get all chunks for a document.
    
    Args:
        document_id: Document UUID
    
    Returns:
        List of chunks ordered by chunk index
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
    Execute a custom query.
    
    Args:
        query: SQL query
        *params: Query parameters
    
    Returns:
        Query results
    """
    async with db_pool.acquire() as conn:
        results = await conn.fetch(query, *params)
        return [dict(row) for row in results]


async def test_connection() -> bool:
    """
    Test database connection.

    Returns:
        True if connection successful
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
    Insert or update a knowledge graph node.

    Args:
        name: Node name
        node_type: Node type (person, company, technology, event, location, other)
        description: Optional node description
        metadata: Optional metadata

    Returns:
        Node ID
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
    Create a relationship between two nodes.

    Args:
        source_node_id: Source node UUID
        target_node_id: Target node UUID
        relationship_type: Type of relationship
        description: Optional relationship description
        metadata: Optional metadata

    Returns:
        Relationship ID
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
    Add a fact to a node.

    Args:
        node_id: Node UUID
        content: Fact content
        source: Source of the fact
        valid_at: When the fact became valid
        invalid_at: When the fact became invalid
        confidence: Confidence score (0-1)
        metadata: Optional metadata

    Returns:
        Fact ID
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
    Search facts using full-text search.

    Args:
        query: Search query
        limit: Maximum number of results

    Returns:
        List of matching facts with node information
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


async def search_facts_websearch(
    query: str,
    limit: int = 20
) -> List[Dict[str, Any]]:
    """
    Broader full-text search using websearch_to_tsquery which supports user-like queries (OR/phrases).

    Args:
        query: Search query
        limit: Maximum number of results

    Returns:
        List of matching facts with node information
    """
    async with db_pool.acquire() as conn:
        results = await conn.fetch(
            """
            SELECT
                f.id AS fact_id,
                f.node_id,
                n.name AS node_name,
                n.type AS node_type,
                f.content,
                f.source,
                f.valid_at,
                f.invalid_at,
                f.confidence,
                ts_rank_cd(to_tsvector('english', f.content), websearch_to_tsquery('english', $1))::double precision AS rank
            FROM facts f
            JOIN nodes n ON f.node_id = n.id
            WHERE
                to_tsvector('english', f.content) @@ websearch_to_tsquery('english', $1)
                AND (f.invalid_at IS NULL OR f.invalid_at > CURRENT_TIMESTAMP)
            ORDER BY rank DESC
            LIMIT $2
            """,
            query,
            limit,
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
                "rank": row["rank"],
            }
            for row in results
        ]


async def get_entity_relationships(
    entity_name: str,
    depth: int = 2
) -> Dict[str, Any]:
    """
    Get relationships for an entity.

    Args:
        entity_name: Name of the entity
        depth: Maximum traversal depth

    Returns:
        Entity relationships
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
    Get timeline of facts for an entity.

    Args:
        entity_name: Name of the entity
        start_date: Start of time range
        end_date: End of time range

    Returns:
        Timeline of facts
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
    Get basic statistics about the knowledge graph.

    Returns:
        Graph statistics
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
    Get a node by name and optionally type.

    Args:
        name: Node name
        node_type: Optional node type filter

    Returns:
        Node data or None if not found
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
    Add content as an episode to the knowledge graph.
    This will extract entities and create relationships.

    Args:
        episode_id: Unique episode identifier
        content: Episode content
        source: Source of the content
        metadata: Optional metadata

    Returns:
        Episode ID
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
    Clear all data from the knowledge graph (USE WITH CAUTION).

    Returns:
        True if successful
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