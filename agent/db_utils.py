from __future__ import annotations

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
    # Ensure auxiliary tables exist
    try:
        await ensure_summary_jobs_table()
    except Exception as e:
        logger.warning(f"Failed to ensure summary_jobs table: {e}")


async def close_database():
    """Close database connection pool."""
    await db_pool.close()


# -------------------------
# Session Management Functions (restored)
# -------------------------
async def create_session(
    user_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    timeout_minutes: int = 60,
) -> str:
    """Create a new session and return its ID."""
    async with db_pool.acquire() as conn:
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=timeout_minutes)
        row = await conn.fetchrow(
            """
            INSERT INTO sessions (user_id, metadata, expires_at)
            VALUES ($1, $2::jsonb, $3)
            RETURNING id::text
            """,
            user_id,
            json.dumps(metadata or {}),
            expires_at,
        )
        return row["id"]

# -------------------------
# Summary Jobs (Async Tasks)
# -------------------------

async def ensure_summary_jobs_table():
    """Create summary_jobs table if it doesn't exist."""
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS summary_jobs (
                id UUID PRIMARY KEY,
                document_id UUID NOT NULL,
                summary_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                error TEXT,
                result JSONB,
                progress INTEGER,
                total INTEGER,
                cancelled BOOLEAN NOT NULL DEFAULT FALSE,
                started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_summary_jobs_document ON summary_jobs(document_id);
            """
        )

async def create_summary_job(document_id: str, summary_type: str) -> str:
    import uuid as _uuid
    job_id = str(_uuid.uuid4())
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO summary_jobs (id, document_id, summary_type, status)
            VALUES ($1::uuid, $2::uuid, $3, 'queued')
            """,
            job_id, document_id, summary_type,
        )
    return job_id

async def update_summary_job_status(
    job_id: str,
    status: str,
    *,
    progress: Optional[int] = None,
    total: Optional[int] = None,
    error: Optional[str] = None,
):
    fields = ["status = $2", "updated_at = NOW()"]
    params: List[Any] = [job_id, status]
    idx = 3
    if progress is not None:
        fields.append(f"progress = ${idx}")
        params.append(progress)
        idx += 1
    if total is not None:
        fields.append(f"total = ${idx}")
        params.append(total)
        idx += 1
    if error is not None:
        fields.append(f"error = ${idx}")
        params.append(error)
        idx += 1
    set_clause = ", ".join(fields)
    async with db_pool.acquire() as conn:
        await conn.execute(
            f"UPDATE summary_jobs SET {set_clause} WHERE id = $1::uuid",
            *params,
        )

async def set_summary_job_result(job_id: str, result: Dict[str, Any]):
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE summary_jobs
            SET result = $2::jsonb, status = 'done', updated_at = NOW()
            WHERE id = $1::uuid
            """,
            job_id, json.dumps(result),
        )

async def get_summary_job(job_id: str) -> Optional[Dict[str, Any]]:
    async with db_pool.acquire() as conn:
        rec = await conn.fetchrow(
            """
            SELECT id::text, document_id::text, summary_type, status, error, result,
                   progress, total, cancelled, started_at, updated_at
            FROM summary_jobs
            WHERE id = $1::uuid
            """,
            job_id,
        )
        if not rec:
            return None
        return {
            "id": rec["id"],
            "document_id": rec["document_id"],
            "summary_type": rec["summary_type"],
            "status": rec["status"],
            "error": rec["error"],
            "result": rec["result"],
            "progress": rec["progress"],
            "total": rec["total"],
            "cancelled": rec["cancelled"],
            "started_at": rec["started_at"].isoformat() if rec["started_at"] else None,
            "updated_at": rec["updated_at"].isoformat() if rec["updated_at"] else None,
        }

async def cancel_summary_job(job_id: str) -> bool:
    async with db_pool.acquire() as conn:
        res = await conn.execute(
            """
            UPDATE summary_jobs
            SET cancelled = TRUE, status = 'cancelled', updated_at = NOW()
            WHERE id = $1::uuid
            """,
            job_id,
        )
        return res and res.upper().startswith("UPDATE")

async def is_summary_job_cancelled(job_id: Optional[str]) -> bool:
    if not job_id:
        return False
    async with db_pool.acquire() as conn:
        rec = await conn.fetchrow(
            "SELECT cancelled FROM summary_jobs WHERE id = $1::uuid",
            job_id,
        )
        return bool(rec and rec["cancelled"]) 


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
    metadata_filter: Optional[Dict[str, Any]] = None,
    collection_ids: Optional[List[str]] = None,
    document_ids: Optional[List[str]] = None,
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

        params: List[Any] = []
        conditions: List[str] = []

        if metadata_filter:
            conditions.append(f"d.metadata @> ${len(params) + 1}::jsonb")
            params.append(json.dumps(metadata_filter))

        if document_ids:
            conditions.append(f"d.id = ANY(${len(params) + 1}::uuid[])")
            params.append(document_ids)

        if collection_ids:
            conditions.append(
                f"d.id IN (SELECT document_id FROM collection_documents WHERE collection_id = ANY(${len(params) + 1}::uuid[]))"
            )
            params.append(collection_ids)

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


async def update_collection_db(
    collection_id: str,
    *,
    name: Optional[str] = None,
    description: Optional[str] = None,
    color: Optional[str] = None,
    icon: Optional[str] = None,
    is_shared: Optional[bool] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Update an existing collection with provided fields.

    Returns the updated collection dict, or None if not found.
    """
    async with db_pool.acquire() as conn:
        sets = []
        params = []
        if name is not None:
            sets.append(f"name = ${len(params)+1}")
            params.append(name)
        if description is not None:
            sets.append(f"description = ${len(params)+1}")
            params.append(description)
        if color is not None:
            sets.append(f"color = ${len(params)+1}")
            params.append(color)
        if icon is not None:
            sets.append(f"icon = ${len(params)+1}")
            params.append(icon)
        if is_shared is not None:
            sets.append(f"is_shared = ${len(params)+1}")
            params.append(is_shared)
        if metadata is not None:
            sets.append(f"metadata = ${len(params)+1}::jsonb")
            params.append(json.dumps(metadata))

        if not sets:
            # Nothing to update; return current row
            row = await conn.fetchrow(
                """
                SELECT 
                    id::text as id, name, description, color, icon, created_by, is_shared,
                    workspace_id::text as workspace_id, document_count, total_size, last_accessed,
                    metadata, created_at, updated_at
                FROM collections WHERE id = $1::uuid
                """,
                collection_id,
            )
            if not row:
                return None
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

        sets.append("updated_at = CURRENT_TIMESTAMP")
        update_sql = f"UPDATE collections SET {', '.join(sets)} WHERE id = ${len(params)+1}::uuid RETURNING \
            id::text as id, name, description, color, icon, created_by, is_shared, \
            workspace_id::text as workspace_id, document_count, total_size, last_accessed, \
            metadata, created_at, updated_at"
        row = await conn.fetchrow(update_sql, *params, collection_id)
        if not row:
            return None
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


async def delete_collection_db(collection_id: str) -> bool:
    """Delete a collection by ID (cascades to membership)."""
    async with db_pool.acquire() as conn:
        result = await conn.execute("DELETE FROM collections WHERE id = $1::uuid", collection_id)
        rows_affected = int(result.split()[-1]) if result and result.startswith("DELETE") else 0
        return rows_affected > 0


async def add_documents_to_collection_db(
    collection_id: str,
    document_ids: List[str],
    added_by: Optional[str] = None,
) -> int:
    """Add documents to a collection.
    Returns number of rows actually inserted (ignores existing membership).
    Defensive against invalid UUIDs and non-existent documents to avoid aborting the transaction.
    """
    if not document_ids:
        return 0

    # Sanitize and validate UUIDs client-side to prevent transaction aborts
    valid_doc_ids: List[str] = []
    for did in document_ids:
        try:
            valid_doc_ids.append(str(UUID(str(did))))
        except Exception:
            # Skip invalid UUID formats
            continue

    if not valid_doc_ids:
        return 0

    async with db_pool.acquire() as conn:
        async with conn.transaction():
            # Ensure the collection exists (avoid fk violation on collection_id)
            col_exists = await conn.fetchval(
                "SELECT 1 FROM collections WHERE id = $1::uuid",
                collection_id,
            )
            if not col_exists:
                # Collection not found; raise to surface a 404 at API layer
                raise ValueError("collection_not_found")

            # Insert in bulk using UNNEST with conflict handling.
            # Filter to only existing documents via JOIN to avoid FK violations.
            inserted = await conn.fetchval(
                """
                WITH ids AS (
                    SELECT d::uuid AS document_id
                    FROM UNNEST($2::text[]) AS t(d)
                ),
                ins AS (
                    INSERT INTO collection_documents (collection_id, document_id, added_by)
                    SELECT $1::uuid, docs.id, $3
                    FROM ids
                    JOIN documents AS docs ON docs.id = ids.document_id
                    ON CONFLICT (collection_id, document_id) DO NOTHING
                    RETURNING 1
                )
                SELECT COALESCE(COUNT(*), 0)::int FROM ins
                """,
                collection_id,
                valid_doc_ids,
                added_by,
            )

            # Sync document_count for the collection
            await conn.execute(
                """
                UPDATE collections c
                SET document_count = (
                    SELECT COUNT(*) FROM collection_documents cd WHERE cd.collection_id = c.id
                ), updated_at = CURRENT_TIMESTAMP
                WHERE c.id = $1::uuid
                """,
                collection_id,
            )

            return int(inserted or 0)


async def remove_document_from_collection_db(collection_id: str, document_id: str) -> bool:
    """Remove a single document from a collection."""
    async with db_pool.acquire() as conn:
        async with conn.transaction():
            result = await conn.execute(
                "DELETE FROM collection_documents WHERE collection_id = $1::uuid AND document_id = $2::uuid",
                collection_id,
                document_id,
            )
            rows = int(result.split()[-1]) if result and result.startswith("DELETE") else 0
            await conn.execute(
                """
                UPDATE collections c
                SET document_count = (
                    SELECT COUNT(*) FROM collection_documents cd WHERE cd.collection_id = c.id
                ), updated_at = CURRENT_TIMESTAMP
                WHERE c.id = $1::uuid
                """,
                collection_id,
            )
            return rows > 0


async def list_collection_documents_db(
    collection_id: str,
    *,
    limit: int = 100,
    offset: int = 0,
) -> Tuple[List[Dict[str, Any]], int]:
    """List documents that belong to a collection (with chunk_count)."""
    async with db_pool.acquire() as conn:
        total = await conn.fetchval(
            "SELECT COUNT(*) FROM collection_documents WHERE collection_id = $1::uuid",
            collection_id,
        )
        rows = await conn.fetch(
            """
            SELECT d.id::text as id, d.title, d.source, d.metadata, d.created_at, d.updated_at,
                   COUNT(c.id) AS chunk_count
            FROM collection_documents cd
            JOIN documents d ON cd.document_id = d.id
            LEFT JOIN chunks c ON c.document_id = d.id
            WHERE cd.collection_id = $1::uuid
            GROUP BY d.id, d.title, d.source, d.metadata, d.created_at, d.updated_at
            ORDER BY d.created_at DESC
            LIMIT $2 OFFSET $3
            """,
            collection_id,
            limit,
            offset,
        )
        docs = [
            {
                "id": r["id"],
                "title": r["title"],
                "source": r["source"],
                "metadata": r["metadata"] if isinstance(r["metadata"], dict) else (json.loads(r["metadata"]) if r["metadata"] else {}),
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                "updated_at": r["updated_at"].isoformat() if r["updated_at"] else None,
                "chunk_count": r["chunk_count"],
            }
            for r in rows
        ]
        return docs, int(total or 0)


# Vector Search Functions
async def vector_search(
    embedding: List[float],
    limit: int = 10,
    collection_ids: Optional[List[str]] = None,
    document_ids: Optional[List[str]] = None,
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

        # If no filters provided, use optimized SQL function
        if not collection_ids and not document_ids:
            results = await conn.fetch(
                "SELECT * FROM match_chunks($1::vector, $2)",
                embedding_str,
                limit
            )
        else:
            # Inline the function with additional filters
            # Build dynamic WHERE fragments
            where_clauses = ["c.embedding IS NOT NULL"]
            params = [embedding_str]
            if document_ids:
                where_clauses.append(f"d.id = ANY(${len(params) + 1}::uuid[])")
                params.append(document_ids)
            if collection_ids:
                where_clauses.append(
                    f"d.id IN (SELECT document_id FROM collection_documents WHERE collection_id = ANY(${len(params) + 1}::uuid[]))"
                )
                params.append(collection_ids)

            query = f"""
                SELECT
                    c.id AS chunk_id,
                    c.document_id,
                    c.content,
                    (1 - (c.embedding <=> $1::vector))::double precision AS similarity,
                    c.metadata,
                    d.title AS document_title,
                    d.source AS document_source
                FROM chunks c
                JOIN documents d ON c.document_id = d.id
                WHERE {' AND '.join(where_clauses)}
                ORDER BY c.embedding <=> $1::vector
                LIMIT {limit}
            """
            results = await conn.fetch(query, *params)

        return [
            {
                "chunk_id": row["chunk_id"],
                "document_id": row["document_id"],
                "content": row["content"],
                "similarity": row["similarity"],
                "metadata": json.loads(row["metadata"]) if isinstance(row["metadata"], str) else (row["metadata"] or {}),
                "document_title": row["document_title"],
                "document_source": row["document_source"]
            }
            for row in results
        ]


async def hybrid_search(
    embedding: List[float],
    query_text: str,
    limit: int = 10,
    text_weight: float = 0.3,
    collection_ids: Optional[List[str]] = None,
    document_ids: Optional[List[str]] = None,
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

        if not collection_ids and not document_ids:
            results = await conn.fetch(
                "SELECT * FROM hybrid_search($1::vector, $2, $3, $4)",
                embedding_str,
                query_text,
                limit,
                text_weight
            )
        else:
            # Inline hybrid query with filters
            params = [embedding_str, query_text]
            vector_where = ["c.embedding IS NOT NULL"]
            text_where = ["to_tsvector('english', c.content) @@ plainto_tsquery('english', $2)"]
            if document_ids:
                vector_where.append(f"d.id = ANY(${len(params) + 1}::uuid[])")
                text_where.append(f"d.id = ANY(${len(params) + 1}::uuid[])")
                params.append(document_ids)
            if collection_ids:
                vector_where.append(
                    f"d.id IN (SELECT document_id FROM collection_documents WHERE collection_id = ANY(${len(params) + 1}::uuid[]))"
                )
                text_where.append(
                    f"d.id IN (SELECT document_id FROM collection_documents WHERE collection_id = ANY(${len(params) + 1}::uuid[]))"
                )
                params.append(collection_ids)

            query = f"""
                WITH vector_results AS (
                    SELECT
                        c.id AS chunk_id,
                        c.document_id,
                        c.content,
                        (1 - (c.embedding <=> $1::vector))::double precision AS vector_sim,
                        c.metadata,
                        d.title AS doc_title,
                        d.source AS doc_source
                    FROM chunks c
                    JOIN documents d ON c.document_id = d.id
                    WHERE {' AND '.join(vector_where)}
                ),
                text_results AS (
                    SELECT
                        c.id AS chunk_id,
                        c.document_id,
                        c.content,
                        ts_rank_cd(to_tsvector('english', c.content), plainto_tsquery('english', $2))::double precision AS text_sim,
                        c.metadata,
                        d.title AS doc_title,
                        d.source AS doc_source
                    FROM chunks c
                    JOIN documents d ON c.document_id = d.id
                    WHERE {' AND '.join(text_where)}
                )
                SELECT
                    COALESCE(v.chunk_id, t.chunk_id) AS chunk_id,
                    COALESCE(v.document_id, t.document_id) AS document_id,
                    COALESCE(v.content, t.content) AS content,
                    (COALESCE(v.vector_sim, 0::double precision) * (1 - $4) + COALESCE(t.text_sim, 0::double precision) * $4) AS combined_score,
                    COALESCE(v.vector_sim, 0::double precision) AS vector_similarity,
                    COALESCE(t.text_sim, 0::double precision) AS text_similarity,
                    COALESCE(v.metadata, t.metadata) AS metadata,
                    COALESCE(v.doc_title, t.doc_title) AS document_title,
                    COALESCE(v.doc_source, t.doc_source) AS document_source
                FROM vector_results v
                FULL OUTER JOIN text_results t ON v.chunk_id = t.chunk_id
                ORDER BY combined_score DESC
                LIMIT {limit}
            """
            # Append text_weight as $4
            # Ensure params align: $1 embedding, $2 query_text, optional arrays, $4 text_weight
            # If we added filters, $3 may be arrays; but in the constructed query we embed limit, not params index.
            # We pass text_weight at the end to occupy $4.
            results = await conn.fetch(query, *params, text_weight)

        return [
            {
                "chunk_id": row["chunk_id"],
                "document_id": row["document_id"],
                "content": row["content"],
                "combined_score": row["combined_score"],
                "vector_similarity": row["vector_similarity"],
                "text_similarity": row["text_similarity"],
                "metadata": json.loads(row["metadata"]) if isinstance(row["metadata"], str) else (row["metadata"] or {}),
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
            "SELECT * FROM public.get_document_chunks($1::uuid)",
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
            "SELECT * FROM public.search_facts($1, $2)",
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
            "SELECT * FROM public.get_entity_relationships($1, $2)",
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


# Document Summary Storage Functions

async def get_cached_summary(
    document_id: str,
    summary_type: str
) -> Optional[Dict[str, Any]]:
    """
    Retrieve a cached summary from the database.
    
    Args:
        document_id: UUID of the document
        summary_type: Type of summary ('comprehensive', 'executive', 'financial', 'operational')
    
    Returns:
        Cached summary data or None if not found
    """
    if not db_pool:
        logger.error("Database pool not initialized")
        return None
    
    try:
        async with db_pool.acquire() as conn:
            result = await conn.fetchrow(
                """
                SELECT 
                    id::text,
                    document_id::text,
                    summary_type,
                    domain_classification,
                    summary_content,
                    context_info,
                    metadata,
                    created_at,
                    updated_at
                FROM document_summaries 
                WHERE document_id = $1 AND summary_type = $2
                """,
                document_id,
                summary_type
            )
            
            if result:
                return {
                    "id": result["id"],
                    "document_id": result["document_id"],
                    "summary_type": result["summary_type"],
                    "domain_classification": json.loads(result["domain_classification"]),
                    "summary_content": json.loads(result["summary_content"]),
                    "context_info": json.loads(result["context_info"]),
                    "metadata": json.loads(result["metadata"]),
                    "created_at": result["created_at"].isoformat(),
                    "updated_at": result["updated_at"].isoformat(),
                    "cached": True
                }
            return None
            
    except Exception as e:
        logger.error(f"Failed to retrieve cached summary: {e}")
        return None


async def store_summary(
    document_id: str,
    summary_type: str,
    domain_classification: Dict[str, Any],
    summary_content: Dict[str, Any],
    context_info: Dict[str, Any],
    metadata: Dict[str, Any]
) -> bool:
    """
    Store a generated summary in the database cache.
    
    Args:
        document_id: UUID of the document
        summary_type: Type of summary
        domain_classification: Domain classification information
        summary_content: The generated summary content
        context_info: Context information used in generation
        metadata: Additional metadata
    
    Returns:
        True if stored successfully, False otherwise
    """
    if not db_pool:
        logger.error("Database pool not initialized")
        return False
    
    try:
        async with db_pool.acquire() as conn:
            # Use INSERT ... ON CONFLICT to handle updates
            await conn.execute(
                """
                INSERT INTO document_summaries (
                    document_id,
                    summary_type,
                    domain_classification,
                    summary_content,
                    context_info,
                    metadata
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (document_id, summary_type)
                DO UPDATE SET
                    domain_classification = EXCLUDED.domain_classification,
                    summary_content = EXCLUDED.summary_content,
                    context_info = EXCLUDED.context_info,
                    metadata = EXCLUDED.metadata,
                    updated_at = CURRENT_TIMESTAMP
                """,
                document_id,
                summary_type,
                json.dumps(domain_classification),
                json.dumps(summary_content),
                json.dumps(context_info),
                json.dumps(metadata)
            )
            
            logger.info(f"Stored summary for document {document_id} (type: {summary_type})")
            return True
            
    except Exception as e:
        logger.error(f"Failed to store summary: {e}")
        return False


async def list_document_summaries(document_id: str) -> List[Dict[str, Any]]:
    """
    List all cached summaries for a document.
    
    Args:
        document_id: UUID of the document
    
    Returns:
        List of summary metadata
    """
    if not db_pool:
        logger.error("Database pool not initialized")
        return []
    
    try:
        async with db_pool.acquire() as conn:
            results = await conn.fetch(
                """
                SELECT 
                    id::text,
                    summary_type,
                    domain_classification,
                    metadata,
                    created_at,
                    updated_at
                FROM document_summaries 
                WHERE document_id = $1
                ORDER BY created_at DESC
                """,
                document_id
            )
            
            return [
                {
                    "id": row["id"],
                    "summary_type": row["summary_type"],
                    "domain_classification": json.loads(row["domain_classification"]),
                    "metadata": json.loads(row["metadata"]),
                    "created_at": row["created_at"].isoformat(),
                    "updated_at": row["updated_at"].isoformat()
                }
                for row in results
            ]
            
    except Exception as e:
        logger.error(f"Failed to list document summaries: {e}")
        return []


async def delete_summary(document_id: str, summary_type: str = None) -> bool:
    """
    Delete cached summary/summaries for a document.
    
    Args:
        document_id: UUID of the document
        summary_type: Specific summary type to delete, or None to delete all
    
    Returns:
        True if deleted successfully, False otherwise
    """
    if not db_pool:
        logger.error("Database pool not initialized")
        return False
    
    try:
        async with db_pool.acquire() as conn:
            if summary_type:
                # Delete specific summary type
                result = await conn.execute(
                    "DELETE FROM document_summaries WHERE document_id = $1 AND summary_type = $2",
                    document_id,
                    summary_type
                )
            else:
                # Delete all summaries for document
                result = await conn.execute(
                    "DELETE FROM document_summaries WHERE document_id = $1",
                    document_id
                )
            
            logger.info(f"Deleted summaries for document {document_id}")
            return True
            
    except Exception as e:
        logger.error(f"Failed to delete summary: {e}")
        return False


async def get_summary_statistics() -> Dict[str, Any]:
    """
    Get statistics about cached summaries.
    
    Returns:
        Statistics about the summary cache
    """
    if not db_pool:
        logger.error("Database pool not initialized")
        return {}
    
    try:
        async with db_pool.acquire() as conn:
            # Total summaries
            total_count = await conn.fetchval(
                "SELECT COUNT(*) FROM document_summaries"
            )
            
            # Summaries by type
            type_counts = await conn.fetch(
                """
                SELECT summary_type, COUNT(*) as count
                FROM document_summaries
                GROUP BY summary_type
                ORDER BY count DESC
                """
            )
            
            # Recent summaries (last 24 hours)
            recent_count = await conn.fetchval(
                """
                SELECT COUNT(*) FROM document_summaries
                WHERE created_at >= NOW() - INTERVAL '24 hours'
                """
            )
            
            # Domain distribution
            domain_stats = await conn.fetch(
                """
                SELECT 
                    domain_classification->>'domain' as domain,
                    COUNT(*) as count
                FROM document_summaries
                WHERE domain_classification->>'domain' IS NOT NULL
                GROUP BY domain_classification->>'domain'
                ORDER BY count DESC
                """
            )
            
            return {
                "total_summaries": total_count,
                "summaries_by_type": {row["summary_type"]: row["count"] for row in type_counts},
                "recent_summaries_24h": recent_count,
                "domain_distribution": {row["domain"]: row["count"] for row in domain_stats}
            }
            
    except Exception as e:
        logger.error(f"Failed to get summary statistics: {e}")
        return {}