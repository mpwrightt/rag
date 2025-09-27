"""
FastAPI endpoints for the agentic RAG system.
"""

import os
import asyncio
import json
import logging
import tempfile
import shutil
import re
import glob
from pathlib import Path
from datetime import datetime
import uuid
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, HTTPException, Request, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse, Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import uvicorn
from dotenv import load_dotenv
from contextlib import asynccontextmanager

from .agent import rag_agent, AgentDependencies
from .enhanced_retrieval import EnhancedRetriever

from .context import get_current_search_results, clear_search_results, register_retrieval_listener, unregister_retrieval_listener, emit_retrieval_event
from .db_utils import (
    initialize_database,
    close_database,
    get_session,
    add_message,
    get_session_messages,
    test_connection,
    delete_document,
    list_documents,
    get_document,
    get_graph_statistics,
    search_facts,
    search_facts_websearch,
    # Collections
    list_collections_db,
    create_collection_db,
    update_collection_db,
    delete_collection_db,
    add_documents_to_collection_db,
    remove_document_from_collection_db,
    list_collection_documents_db,
    # Summary jobs
    create_summary_job,
    update_summary_job_status,
    set_summary_job_result,
    get_summary_job,
    cancel_summary_job,
    is_summary_job_cancelled,
    # Proposals
    create_proposal_db,
    get_proposal_db,
    list_proposals_db,
    create_proposal_version_db,
    get_latest_proposal_version_db,
    get_proposal_version_db,
    list_proposal_versions_db,
    update_proposal_db,
    update_document_metadata,
    list_proposal_documents_db,
    delete_document,
)
from .graph_utils import (
    initialize_graph,
    close_graph,
    test_graph_connection,
    get_entity_relationships as kg_get_entity_relationships,
    search_knowledge_graph as kg_search_knowledge_graph,
)
from .query_processor import QueryProcessor
from ingestion.converters import convert_to_markdown
from .proposal_analyzer import analyze_example_text
from .models import (
    ChatRequest,
    ChatResponse,
    SearchRequest,
    SearchResponse,
    StreamDelta,
    ErrorResponse,
    HealthStatus,
    ToolCall,
    SourceResult,
    ChunkResult,
    GraphSearchResult,
    RealTimeMetrics,
    ChatMetrics,
    DocumentUsageStats,
    UserEngagementMetrics,
    AnalyticsDashboardResponse,
    ProposalCreateRequest,
    ProposalGenerateRequest,
    PricingItem,
    PricingParseResponse,
    PricingRenderRequest,
    PricingRenderResponse,
)
from .tools import (
    vector_search_tool,
    graph_search_tool,
    hybrid_search_tool,
    list_documents_tool,
    get_document_tool,
    VectorSearchInput,
    GraphSearchInput,
    HybridSearchInput,
    DocumentListInput,
    DocumentInput
)

# Analytics tracker
from .analytics import analytics_tracker
from .question_generator import QuestionGenerator

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Import ingestion pipeline components
try:
    import sys
    import os
    # Add the parent directory to sys.path to allow imports
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from ingestion.ingest import DocumentIngestionPipeline
    from ingestion.chunker import ChunkingConfig, create_chunker
    from ingestion.embedder import create_embedder
    from ingestion.graph_builder import create_graph_builder
    from .models import IngestionConfig
    from ingestion.converters import convert_to_markdown
    INGESTION_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Ingestion pipeline not available: {e}")
    INGESTION_AVAILABLE = False

# Import 3rd party integrations
try:
    from integrations import (
        GoogleDriveIntegration, 
        DropboxIntegration, 
        OneDriveIntegration,
        IntegrationConfig,
        create_google_drive_integration,
        create_dropbox_integration, 
        create_onedrive_integration
    )
    INTEGRATIONS_AVAILABLE = True
except ImportError as e:
    logger.warning(f"3rd party integrations not available: {e}")
    INTEGRATIONS_AVAILABLE = False
    
    # Create dummy classes to prevent unbound variable errors
    class GoogleDriveIntegration:
        def __init__(self, *args, **kwargs): pass
    class DropboxIntegration:
        def __init__(self, *args, **kwargs): pass
    class OneDriveIntegration:
        def __init__(self, *args, **kwargs): pass
    class IntegrationConfig:
        def __init__(self, *args, **kwargs): pass
    
    def create_google_drive_integration(*args, **kwargs): return None
    def create_dropbox_integration(*args, **kwargs): return None
    def create_onedrive_integration(*args, **kwargs): return None

# WeasyPrint (PDF export)
try:
    from weasyprint import HTML, CSS  # type: ignore
    WEASYPRINT_AVAILABLE = True
except Exception as e:
    WEASYPRINT_AVAILABLE = False
    logger.warning(f"WeasyPrint not available: {e}")

# Optional: Pandas for CSV/XLSX pricing parsing
try:
    import pandas as pd  # type: ignore
    PANDAS_AVAILABLE = True
except Exception as e:
    PANDAS_AVAILABLE = False
    logger.warning(f"Pandas not available: {e}")

# Optional: python-docx for DOCX export
try:
    from docx import Document  # type: ignore
    DOCX_AVAILABLE = True
except Exception as e:
    DOCX_AVAILABLE = False
    logger.warning(f"python-docx not available: {e}")

# Application configuration
APP_ENV = os.getenv("APP_ENV", "development")
APP_HOST = os.getenv("APP_HOST", "0.0.0.0")
APP_PORT = int(os.getenv("APP_PORT", 8000))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# Configure logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper()),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# Set debug level for our module during development
if APP_ENV == "development":
    logger.setLevel(logging.DEBUG)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for FastAPI app."""
    # Startup
    logger.info("Starting up agentic RAG API...")
    
    try:
        # Initialize database connections (tolerate failure and continue in degraded mode)
        try:
            await initialize_database()
            logger.info("Database initialized")
        except Exception as e:
            logger.exception("Database initialization failed: %s", e)

        # Initialize graph database (tolerate failure)
        try:
            await initialize_graph()
            logger.info("Graph database initialized")
        except Exception as e:
            logger.exception("Graph initialization failed: %s", e)

        # Test connections (report status but don't block startup)
        try:
            db_ok = await test_connection()
        except Exception as e:
            logger.exception("Database test failed during startup: %s", e)
            db_ok = False
        try:
            graph_ok = await test_graph_connection()
        except Exception as e:
            logger.exception("Graph test failed during startup: %s", e)
            graph_ok = False

        if not db_ok:
            logger.error("Database connection failed")
        if not graph_ok:
            logger.error("Graph database connection failed")

        # Initialize question generator here (lifespan startup)
        global question_generator
        # Accept multiple env var names for compatibility with different configs
        gemini_api_key = (
            os.getenv("GEMINI_API_KEY")
            or os.getenv("GOOGLE_API_KEY")
            or os.getenv("LLM_API_KEY")
        )
        logger.info(
            "Looking for API keys - GEMINI_API_KEY: %s, GOOGLE_API_KEY: %s, LLM_API_KEY: %s",
            "found" if os.getenv("GEMINI_API_KEY") else "not found",
            "found" if os.getenv("GOOGLE_API_KEY") else "not found",
            "found" if os.getenv("LLM_API_KEY") else "not found",
        )
        if gemini_api_key:
            try:
                question_generator = QuestionGenerator(gemini_api_key)
                logger.info("Question generator initialized successfully with Gemini")
            except Exception as e:
                logger.error(f"Failed to initialize question generator: {e}")
                question_generator = None
        else:
            logger.warning("GEMINI_API_KEY / GOOGLE_API_KEY / LLM_API_KEY not found, question generation will be disabled")
        
        logger.info("Agentic RAG API startup complete")
        
    except Exception as e:
        # Never fail the app startup; continue in degraded mode so /health can report status
        logger.exception("Startup encountered unexpected error; continuing in degraded mode: %s", e)
    
    yield
    
    # Shutdown
    logger.info("Shutting down agentic RAG API...")
    
    try:
        await close_database()
        await close_graph()
        logger.info("Connections closed")
    except Exception as e:
        logger.error(f"Shutdown error: {e}")


# Create FastAPI app
app = FastAPI(
    title="Agentic RAG with Knowledge Graph",
    description="AI agent combining vector search and knowledge graph for tech company analysis",
    version="0.1.0",
    lifespan=lifespan
)

# Add middleware with flexible CORS
# Configure CORS with environment-driven origins. Using wildcard with credentials can be problematic on some hosts.
allowed_origins_env = os.getenv("ALLOWED_ORIGINS") or os.getenv("CORS_ALLOW_ORIGINS") or ""
allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

# In production, default to allowing datadiver.app domains via regex if no explicit origins are set
default_origin_regex = None
try:
    if os.getenv("APP_ENV", "development").lower() != "development" and not allowed_origins:
        default_origin_regex = r"https://(.+\.)?datadiver\.app$"
except Exception:
    default_origin_regex = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins or ([] if default_origin_regex else ["*"]),
    allow_origin_regex=os.getenv("CORS_ALLOW_ORIGIN_REGEX") or default_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Initialize question generator
question_generator = None

# In-memory store for multipart upload sessions (best-effort, non-persistent)
UPLOAD_SESSIONS: Dict[str, Dict[str, Any]] = {}

# In-memory ingest job tracker (ephemeral)
INGEST_JOBS: Dict[str, Dict[str, Any]] = {}


# Helper functions for agent execution
async def get_or_create_session(request: ChatRequest) -> str:
    """Get existing session or create new one."""
    # If client supplies a session_id, try to use/validate it but fall back gracefully
    if request.session_id:
        try:
            session = await get_session(request.session_id)
            if session:
                return request.session_id
        except Exception:
            pass
    # Create a new session (lazy import to avoid startup ImportError)
    try:
        from .db_utils import create_session as _create_session
        new_session_id = await _create_session(user_id=None, metadata={"source": "api"})
        return new_session_id
    except Exception as e:
        logger.warning("create_session unavailable, generating ephemeral session id: %s", e)
        return str(uuid.uuid4())


async def get_conversation_context(
    session_id: str,
    max_messages: int = 10
) -> List[Dict[str, str]]:
    """
    Get recent conversation context.
    
    Args:
        session_id: Session ID
        max_messages: Maximum number of messages to retrieve
    
    Returns:
        List of messages
    """
    messages = await get_session_messages(session_id, limit=max_messages)
    
    return [
        {
            "role": msg["role"],
            "content": msg["content"]
        }
        for msg in messages
    ]


def extract_tool_calls(result) -> List[ToolCall]:
    """
    Extract tool calls from Pydantic AI result.
    
    Args:
        result: Pydantic AI result object
    
    Returns:
        List of ToolCall objects
    """
    tools_used = []
    
    try:
        # Get all messages from the result
        messages = result.all_messages()
        
        for message in messages:
            if hasattr(message, 'parts'):
                for part in message.parts:
                    # Check if this is a tool call part
                    if part.__class__.__name__ == 'ToolCallPart':
                        try:
                            # Debug logging to understand structure
                            logger.debug(f"ToolCallPart attributes: {dir(part)}")
                            logger.debug(f"ToolCallPart content: tool_name={getattr(part, 'tool_name', None)}")
                            
                            # Extract tool information safely
                            tool_name = str(part.tool_name) if hasattr(part, 'tool_name') else 'unknown'
                            
                            # Get args - the args field is a JSON string in Pydantic AI
                            tool_args = {}
                            if hasattr(part, 'args') and part.args is not None:
                                if isinstance(part.args, str):
                                    # Args is a JSON string, parse it
                                    try:
                                        import json
                                        tool_args = json.loads(part.args)
                                        logger.debug(f"Parsed args from JSON string: {tool_args}")
                                    except json.JSONDecodeError as e:
                                        logger.debug(f"Failed to parse args JSON: {e}")
                                        tool_args = {}
                                elif isinstance(part.args, dict):
                                    tool_args = part.args
                                    logger.debug(f"Args already a dict: {tool_args}")
                            
                            # Alternative: use args_as_dict method if available
                            if hasattr(part, 'args_as_dict'):
                                try:
                                    tool_args = part.args_as_dict()
                                    logger.debug(f"Got args from args_as_dict(): {tool_args}")
                                except:
                                    pass
                            
                            # Get tool call ID
                            tool_call_id = None
                            if hasattr(part, 'tool_call_id'):
                                tool_call_id = str(part.tool_call_id) if part.tool_call_id else None
                            
                            # Create ToolCall with explicit field mapping
                            tool_call_data = {
                                "tool_name": tool_name,
                                "args": tool_args,
                                "tool_call_id": tool_call_id
                            }
                            logger.debug(f"Creating ToolCall with data: {tool_call_data}")
                            tools_used.append(ToolCall(**tool_call_data))
                        except Exception as e:
                            logger.debug(f"Failed to parse tool call part: {e}")
                            continue
    except Exception as e:
        logger.warning(f"Failed to extract tool calls: {e}")
    
    return tools_used


async def save_conversation_turn(
    session_id: str,
    user_message: str,
    assistant_message: str,
    metadata: Optional[Dict[str, Any]] = None
):
    """
    Save a conversation turn to the database.
    
    Args:
        session_id: Session ID
        user_message: User's message
        assistant_message: Assistant's response
        metadata: Optional metadata
    """
    # Save user message
    await add_message(
        session_id=session_id,
        role="user",
        content=user_message,
        metadata=metadata or {}
    )
    
    # Save assistant message
    await add_message(
        session_id=session_id,
        role="assistant",
        content=assistant_message,
        metadata=metadata or {}
    )


def convert_chunks_to_sources(chunks: List[ChunkResult]) -> List[SourceResult]:
    """Convert ChunkResult objects to SourceResult objects for frontend."""
    sources = []
    seen_combinations = set()
    
    for chunk in chunks:
        # Create unique identifier to avoid duplicates
        combo_id = f"{chunk.document_source}:{chunk.chunk_id}"
        if combo_id not in seen_combinations:
            seen_combinations.add(combo_id)
            sources.append(SourceResult(
                filename=chunk.document_source,
                chunk_id=chunk.chunk_id,
                relevance_score=chunk.score,
                document_title=chunk.document_title
            ))
    
    return sources


async def build_live_graph_payload(
    message: str,
    tools_used: List[ToolCall],
    max_expand_entities: int = 3,
    default_depth: int = 2,
) -> Optional[Dict[str, Any]]:
    """
    Build a live knowledge graph payload using the PostgreSQL graph layer.
    Prefers explicit get_entity_relationships tool args; falls back to graph_search.
    """
    try:
        # Prefer explicit entity from get_entity_relationships tool usage
        entity_name: Optional[str] = None
        entity_depth: int = default_depth
        graph_query: Optional[str] = None

        for t in tools_used or []:
            tool_name = (getattr(t, "tool_name", "") or "").lower()
            args = getattr(t, "args", {}) or {}
            if "get_entity_relationships" in tool_name:
                entity_name = args.get("entity_name") or args.get("entity")
                try:
                    if isinstance(args.get("depth"), int):
                        entity_depth = max(1, min(5, int(args["depth"])))
                except Exception:
                    pass
            elif "graph_search" in tool_name and not graph_query:
                graph_query = args.get("query")

        # If we have an explicit entity, build graph from relationships
        if entity_name:
            rel_result = await kg_get_entity_relationships(entity_name, depth=entity_depth)
            relationships = rel_result.get("relationships", []) if isinstance(rel_result, dict) else []

            nodes_map: Dict[str, Dict[str, Any]] = {}
            edges: List[Dict[str, Any]] = []
            for r in relationships:
                s_name = r.get("source_name")
                s_type = r.get("source_type")
                t_name = r.get("target_name")
                t_type = r.get("target_type")
                rel = r.get("relationship_type") or "related_to"
                if not (s_name and s_type and t_name and t_type):
                    continue
                s_id = f"{s_name}|{s_type}"
                t_id = f"{t_name}|{t_type}"
                if s_id not in nodes_map:
                    nodes_map[s_id] = {"id": s_id, "label": s_name, "type": s_type.capitalize() if isinstance(s_type, str) else s_type}
                if t_id not in nodes_map:
                    nodes_map[t_id] = {"id": t_id, "label": t_name, "type": t_type.capitalize() if isinstance(t_type, str) else t_type}
                edges.append({"source": s_id, "target": t_id, "relationship": rel})

            # Ensure the central node exists
            if entity_name and not any(entity_name == n.get("label") for n in nodes_map.values()):
                center_id = f"{entity_name}|Entity"
                nodes_map[center_id] = {"id": center_id, "label": entity_name, "type": "Entity"}

            return {"nodes": list(nodes_map.values()), "edges": edges}

        # Fallback: use graph search on the query or message to seed entities, then expand shallow relationships
        search_q = graph_query or (message or "").strip()
        if not search_q:
            return None

        facts = await kg_search_knowledge_graph(search_q)
        # Extract top unique node names/types from facts
        seen = set()
        seed_entities: List[Tuple[str, str]] = []
        for f in facts or []:
            name = f.get("node_name")
            ntype = f.get("node_type")
            key = (name, ntype)
            if name and ntype and key not in seen:
                seen.add(key)
                seed_entities.append(key)
            if len(seed_entities) >= max_expand_entities:
                break

        nodes_map: Dict[str, Dict[str, Any]] = {}
        edge_set = set()

        # Add seed nodes
        for name, ntype in seed_entities:
            nid = f"{name}|{ntype}"
            nodes_map[nid] = {"id": nid, "label": name, "type": ntype.capitalize() if isinstance(ntype, str) else ntype}

        # Expand relationships shallowly
        for name, _ntype in seed_entities:
            try:
                rels = await kg_get_entity_relationships(name, depth=1)
            except Exception:
                continue
            for r in (rels.get("relationships", []) if isinstance(rels, dict) else []):
                s_name = r.get("source_name")
                s_type = r.get("source_type")
                t_name = r.get("target_name")
                t_type = r.get("target_type")
                rel = r.get("relationship_type") or "related_to"
                if not (s_name and s_type and t_name and t_type):
                    continue
                s_id = f"{s_name}|{s_type}"
                t_id = f"{t_name}|{t_type}"
                if s_id not in nodes_map:
                    nodes_map[s_id] = {"id": s_id, "label": s_name, "type": s_type.capitalize() if isinstance(s_type, str) else s_type}
                if t_id not in nodes_map:
                    nodes_map[t_id] = {"id": t_id, "label": t_name, "type": t_type.capitalize() if isinstance(t_type, str) else t_type}
                edge_key = (s_id, rel, t_id)
                if edge_key not in edge_set:
                    edge_set.add(edge_key)

        edges = [
            {"source": s, "relationship": rel, "target": t}
            for (s, rel, t) in edge_set
        ]

        if nodes_map or edges:
            return {"nodes": list(nodes_map.values()), "edges": edges}

        return None
    except Exception as e:
        logger.debug(f"Failed to build live graph payload: {e}")
        return None


async def execute_agent(
    message: str,
    session_id: str,
    user_id: Optional[str] = None,
    save_conversation: bool = True,
    search_preferences: Optional[Dict[str, Any]] = None,
) -> tuple[str, List[ToolCall], List[SourceResult]]:
    """
    Execute the agent with a message.
    
    Args:
        message: User message
        session_id: Session ID
        user_id: Optional user ID
        save_conversation: Whether to save the conversation
    
    Returns:
        Tuple of (agent response, tools used, sources)
    """
    try:
        # Clear previous search results
        clear_search_results()
        
        # Create dependencies (include search scoping preferences if provided)
        deps = AgentDependencies(
            session_id=session_id,
            user_id=user_id,
            search_preferences=search_preferences or {},
        )
        
        # Get conversation context
        context = await get_conversation_context(session_id)
        
        # Build prompt with context
        full_prompt = message
        if context:
            context_str = "\n".join([
                f"{msg['role']}: {msg['content']}"
                for msg in context[-6:]  # Last 3 turns
            ])
            full_prompt = f"Previous conversation:\n{context_str}\n\nCurrent question: {message}"
        
        # Run the agent
        result = await rag_agent.run(full_prompt, deps=deps)
        
        response = result.data
        tools_used = extract_tool_calls(result)
        
        # Convert captured search results to sources
        sources = convert_chunks_to_sources(get_current_search_results())
        
        # Save conversation if requested
        if save_conversation:
            await save_conversation_turn(
                session_id=session_id,
                user_message=message,
                assistant_message=response,
                metadata={
                    "user_id": user_id,
                    "tool_calls": len(tools_used),
                    "sources_found": len(sources)
                }
            )
        
        return response, tools_used, sources
        
    except Exception as e:
        logger.error(f"Agent execution failed: {e}")
        error_response = f"I encountered an error while processing your request: {str(e)}"
        
        if save_conversation:
            await save_conversation_turn(
                session_id=session_id,
                user_message=message,
                assistant_message=error_response,
                metadata={"error": str(e)}
            )
        
        return error_response, [], []


# API Endpoints

@app.get("/collections")
async def api_list_collections(
    page: int = 1,
    per_page: int = 20,
    search: Optional[str] = None,
    created_by: Optional[str] = None,
    workspace_id: Optional[str] = None,
    is_shared: Optional[bool] = None,
):
    try:
        offset = (page - 1) * per_page
        collections, total = await list_collections_db(
            limit=per_page,
            offset=offset,
            search=search,
            created_by=created_by,
            workspace_id=workspace_id,
            is_shared=is_shared,
        )
        return {"collections": collections, "total": total, "page": page, "per_page": per_page}
    except Exception as e:
        logger.exception("Failed to list collections: %s", e)
        raise HTTPException(status_code=500, detail="Failed to list collections")


@app.post("/collections")
async def api_create_collection(request: Request):
    try:
        body = await request.json()
        created = await create_collection_db(
            name=body.get("name"),
            description=body.get("description"),
            color=body.get("color") or "#6366f1",
            icon=body.get("icon") or "folder",
            is_shared=bool(body.get("is_shared", False)),
            created_by=request.headers.get("x-user-id"),
            workspace_id=request.headers.get("x-workspace-id"),
            metadata=body.get("metadata") or {},
        )
        return created
    except Exception as e:
        logger.exception("Failed to create collection: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create collection")


@app.patch("/collections/{collection_id}")
async def api_update_collection(collection_id: str, request: Request):
    try:
        body = await request.json()
        updated = await update_collection_db(
            collection_id,
            name=body.get("name"),
            description=body.get("description"),
            color=body.get("color"),
            icon=body.get("icon"),
            is_shared=body.get("is_shared"),
            metadata=body.get("metadata"),
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Collection not found")
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update collection: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update collection")


@app.delete("/collections/{collection_id}")
async def api_delete_collection(collection_id: str):
    try:
        ok = await delete_collection_db(collection_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Collection not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to delete collection: %s", e)
        raise HTTPException(status_code=500, detail="Failed to delete collection")


@app.get("/collections/{collection_id}/documents")
async def api_list_collection_documents(collection_id: str, page: int = 1, per_page: int = 50):
    try:
        docs, total = await list_collection_documents_db(collection_id, limit=per_page, offset=(page - 1) * per_page)
        return {"documents": docs, "total": total, "page": page, "per_page": per_page}
    except Exception as e:
        logger.exception("Failed to list collection documents: %s", e)
        raise HTTPException(status_code=500, detail="Failed to list collection documents")


@app.post("/collections/{collection_id}/documents")
async def api_add_documents_to_collection(collection_id: str, request: Request):
    try:
        body = await request.json()
        ids = body.get("document_ids") or []
        if not isinstance(ids, list) or not ids:
            raise HTTPException(status_code=400, detail="document_ids array required")
        try:
            added = await add_documents_to_collection_db(collection_id, ids, added_by=request.headers.get("x-user-id"))
        except ValueError as ve:
            # Surface clearer API errors
            if str(ve) == "collection_not_found":
                raise HTTPException(status_code=404, detail="Collection not found")
            raise
        return {"added": added}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to add documents to collection: %s", e)
        # Surface underlying error for debugging during integration
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/proposals/{proposal_id}/regulatory")
async def list_proposal_regulatory(proposal_id: str):
    """List regulatory docs linked to this proposal."""
    try:
        prop = await get_proposal_db(proposal_id)
        if not prop:
            raise HTTPException(status_code=404, detail="Proposal not found")
        docs = await list_proposal_documents_db(proposal_id, source_type="regulatory")
        return {"proposal_id": proposal_id, "documents": docs}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"List proposal regulatory failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/proposals/{proposal_id}/regulatory/upload")
async def upload_proposal_regulatory(
    proposal_id: str,
    file: UploadFile = File(...),
    fast: bool = True,
):
    """Upload regulatory doc for a proposal and ingest it with proposal scoping."""
    if not INGESTION_AVAILABLE:
        raise HTTPException(status_code=503, detail="Document ingestion pipeline is not available")
    try:
        prop = await get_proposal_db(proposal_id)
        if not prop:
            raise HTTPException(status_code=404, detail="Proposal not found")

        allowed_extensions = {'.txt', '.md', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.tsv'}
        ext = os.path.splitext(file.filename or '')[1].lower()
        if ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

        with tempfile.TemporaryDirectory() as temp_dir:
            # Save upload
            src_path = Path(temp_dir) / (file.filename or 'upload')
            size_bytes = 0
            with open(src_path, 'wb') as f:
                while True:
                    chunk = await file.read(8 * 1024 * 1024)
                    if not chunk:
                        break
                    size_bytes += len(chunk)
                    f.write(chunk)

            # Convert to markdown
            md_text, conv_meta = convert_to_markdown(str(src_path))
            if not md_text or not md_text.strip():
                raise HTTPException(status_code=400, detail="No extractable text content found in the uploaded file")
            md_path = Path(temp_dir) / f"{Path(file.filename or 'upload').stem}.md"
            with open(md_path, 'w', encoding='utf-8') as f_md:
                f_md.write(md_text)

            # Ingest with proposal metadata
            config = IngestionConfig(
                chunk_size=int(os.getenv("CHUNK_SIZE", "800")),
                chunk_overlap=int(os.getenv("CHUNK_OVERLAP", "150")),
                max_chunk_size=int(os.getenv("MAX_CHUNK_SIZE", "1500")),
                use_semantic_splitting=False,
                # Skip knowledge graph building for faster uploads unless fast=false is provided
                skip_graph_building=bool(fast),
            )
            pipeline = DocumentIngestionPipeline(
                config=config,
                documents_folder=temp_dir,
                clean_before_ingest=False,
                default_metadata={"proposal_id": proposal_id, "proposal_source_type": "regulatory"},
            )
            results = await pipeline.ingest_documents()
            # Document and chunks are saved before graph building; return IDs regardless of graph errors.
            doc_ids = [r.document_id for r in results if getattr(r, 'document_id', '')]
            return {"success": True, "document_ids": doc_ids}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload proposal regulatory failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/proposals/{proposal_id}/regulatory/{document_id}")
async def delete_proposal_regulatory(proposal_id: str, document_id: str):
    """Delete a regulatory document from this proposal."""
    try:
        # Ensure doc belongs to proposal
        docs = await list_proposal_documents_db(proposal_id, source_type="regulatory")
        if not any(d.get("id") == document_id for d in docs):
            raise HTTPException(status_code=404, detail="Document not found for this proposal")
        ok = await delete_document(document_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Document not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete proposal regulatory failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/collections/{collection_id}/documents/{document_id}")
async def api_remove_document_from_collection(collection_id: str, document_id: str):
    try:
        ok = await remove_document_from_collection_db(collection_id, document_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Not found")
        return {"removed": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to remove document from collection: %s", e)
        raise HTTPException(status_code=500, detail="Failed to remove document from collection")


@app.get("/health", response_model=HealthStatus)
async def health_check():
    """Health check endpoint."""
    try:
        # Test database connections
        db_status = await test_connection()
        graph_status = await test_graph_connection()
        
        # Determine overall status
        if db_status and graph_status:
            status = "healthy"
        elif db_status or graph_status:
            status = "degraded"
        else:
            status = "unhealthy"
        
        return HealthStatus(
            status=status,
            database=db_status,
            graph_database=graph_status,
            llm_connection=True,  # Assume OK if we can respond
            version="0.1.0",
            timestamp=datetime.now()
        )
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail="Health check failed")


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Non-streaming chat endpoint."""
    try:
        # Get or create session
        session_id = await get_or_create_session(request)
        
        # Build search preferences from metadata
        prefs: Dict[str, Any] = {}
        meta = request.metadata or {}
        # Support multiple key styles from client
        if isinstance(meta.get("collection_ids"), list):
            prefs["collection_ids"] = meta.get("collection_ids")
        if isinstance(meta.get("selectedCollections"), list):
            prefs["collection_ids"] = meta.get("selectedCollections")
        if isinstance(meta.get("document_ids"), list):
            prefs["document_ids"] = meta.get("document_ids")
        if isinstance(meta.get("selectedDocuments"), list):
            prefs["document_ids"] = meta.get("selectedDocuments")
        # New: allow scoping to explicit chunk IDs
        if isinstance(meta.get("chunk_ids"), list):
            prefs["chunk_ids"] = meta.get("chunk_ids")
        if isinstance(meta.get("selectedChunks"), list):
            prefs["chunk_ids"] = meta.get("selectedChunks")

        # Execute agent
        response, tools_used, sources = await execute_agent(
            message=request.message,
            session_id=session_id,
            user_id=request.user_id,
            search_preferences=prefs,
        )
        
        # Build response metadata and attach a live graph payload when appropriate
        response_metadata: Dict[str, Any] = {"search_type": str(request.search_type)}

        graph_included = False
        try:
            wants_graph = "graph" in (request.message or "").lower()
            used_graph_tool = any(
                getattr(t, "tool_name", "").lower().find("graph") != -1 for t in tools_used
            )
            if wants_graph or used_graph_tool:
                live_graph = await build_live_graph_payload(request.message, tools_used)
                if live_graph and (live_graph.get("nodes") or live_graph.get("edges")):
                    response_metadata["graph"] = live_graph
                    graph_included = True
        except Exception:
            # Fallback: don't block the response if anything goes wrong building the graph payload
            pass

        # If we attached a graph, ensure the assistant message acknowledges it and remove contradictory phrasing
        if graph_included:
            try:
                safe_response = response or ""
                lower_resp = safe_response.lower()
                negative_phrases = [
                    "unable to generate a visual graph",
                    "cannot generate a visual graph",
                    "can not generate a visual graph",
                    "unable to generate a graph",
                    "cannot generate a graph",
                    "can not generate a graph",
                    "i am unable to generate a graph",
                    "i cannot generate a graph",
                    "i'm unable to generate a graph",
                ]
                for phrase in negative_phrases:
                    if phrase in lower_resp:
                        # Replace the first occurrence with a positive confirmation
                        idx = lower_resp.find(phrase)
                        safe_response = (
                            safe_response[:idx]
                            + "I've generated an interactive knowledge graph below."
                            + safe_response[idx + len(phrase):]
                        )
                        lower_resp = safe_response.lower()

                if "knowledge graph" not in lower_resp:
                    safe_response = (
                        "I've generated an interactive knowledge graph below.\n\n"
                        + safe_response
                    )
                response = safe_response
            except Exception:
                # Don't fail the request due to message post-processing
                pass

        return ChatResponse(
            message=response,
            session_id=session_id,
            sources=sources,
            tools_used=tools_used,
            metadata=response_metadata
        )
        
    except Exception as e:
        logger.error(f"Chat endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """Compatibility route for /chat/stream that forwards to the existing chat_stream_legacy."""
    return await chat_stream_legacy(request)


@app.post("/chat/stream/legacy")  # Renamed to avoid conflict with enhanced endpoint
async def chat_stream_legacy(request: ChatRequest):
    """Streaming chat endpoint using Server-Sent Events."""
    try:
        # Get or create session
        session_id = await get_or_create_session(request)
        
        async def generate_stream():
            """Generate streaming response using agent.iter() pattern."""
            try:
                yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"
                
                # Create dependencies
                # Build search preferences from metadata
                prefs: Dict[str, Any] = {}
                meta = request.metadata or {}
                if isinstance(meta.get("collection_ids"), list):
                    prefs["collection_ids"] = meta.get("collection_ids")
                if isinstance(meta.get("selectedCollections"), list):
                    prefs["collection_ids"] = meta.get("selectedCollections")
                if isinstance(meta.get("document_ids"), list):
                    prefs["document_ids"] = meta.get("document_ids")
                if isinstance(meta.get("selectedDocuments"), list):
                    prefs["document_ids"] = meta.get("selectedDocuments")
                # New: allow scoping to explicit chunk IDs
                if isinstance(meta.get("chunk_ids"), list):
                    prefs["chunk_ids"] = meta.get("chunk_ids")
                if isinstance(meta.get("selectedChunks"), list):
                    prefs["chunk_ids"] = meta.get("selectedChunks")

                deps = AgentDependencies(
                    session_id=session_id,
                    user_id=request.user_id,
                    search_preferences=prefs,
                )
                
                # Get conversation context
                context = await get_conversation_context(session_id)
                
                # Build input with context
                full_prompt = request.message
                if context:
                    context_str = "\n".join([
                        f"{msg['role']}: {msg['content']}"
                        for msg in context[-6:]
                    ])
                    full_prompt = f"Previous conversation:\n{context_str}\n\nCurrent question: {request.message}"
                
                # Save user message immediately (best-effort)
                try:
                    await add_message(
                        session_id=session_id,
                        role="user",
                        content=request.message,
                        metadata={"user_id": request.user_id}
                    )
                except Exception as e:
                    logger.warning("Failed to persist user message; continuing stream: %s", e)
                
                full_response = ""
                # Register live retrieval events listener for this session (graceful fallback)
                retrieval_queue = None
                guided_task = None
                try:
                    retrieval_queue = register_retrieval_listener(session_id)
                    logger.info(f"Registered retrieval listener for session {session_id}, queue={retrieval_queue}")
                except Exception as e:
                    logger.error(f"Failed to register retrieval listener: {e}")
                    retrieval_queue = None
                
                # Determine if mock streaming mode is enabled
                use_mock = False
                try:
                    use_mock = bool(
                        (getattr(request, "metadata", {}) or {}).get("mock_stream")
                        or (getattr(request, "metadata", {}) or {}).get("mock")
                        or os.getenv("MOCK_STREAM") == "1"
                    )
                except Exception:
                    use_mock = False

                # Optionally force Enhanced Graph → Vector retrieval to run and emit retrieval_step events
                force_guided = False
                try:
                    force_guided = bool(
                        ((getattr(request, "metadata", {}) or {}).get("force_guided"))
                        or os.getenv("FORCE_GUIDED_RETRIEVAL") == "1"
                    )
                except Exception:
                    force_guided = os.getenv("FORCE_GUIDED_RETRIEVAL") == "1"

                if force_guided and not use_mock:
                    async def _run_enhanced_retrieval():
                        try:
                            retriever = EnhancedRetriever()
                            config = {
                                "use_graph": True,
                                "use_vector": True,
                                "use_query_expansion": True,
                                "vector_limit": 20,
                                "collection_ids": prefs.get("collection_ids"),
                                "document_ids": prefs.get("document_ids"),
                                "chunk_ids": prefs.get("chunk_ids"),
                            }
                            # This will emit granular retrieval_step events via emit_retrieval_event
                            await retriever.retrieve(
                                query=request.message,
                                session_id=session_id,
                                config=config,
                            )
                        except Exception as e:
                            logger.warning(f"Forced guided retrieval failed: {e}")

                    try:
                        guided_task = asyncio.create_task(_run_enhanced_retrieval())
                    except Exception:
                        guided_task = None

                if use_mock:
                    # Emit mock staged retrieval events (guided_retrieval: graph → vector)
                    async def _emit_mock_retrieval_events():
                        try:
                            # Orchestrator start
                            await emit_retrieval_event(session_id, {
                                "type": "retrieval",
                                "event": "start",
                                "tool": "guided_retrieval",
                                "args": {"query": request.message, "limit": 5}
                            })

                            # Graph stage
                            await emit_retrieval_event(session_id, {
                                "type": "retrieval",
                                "event": "start",
                                "tool": "guided_retrieval",
                                "stage": "graph"
                            })
                            await asyncio.sleep(0.05)
                            mock_graph = [
                                {"fact": "Company X acquired Startup Y in 2023", "uuid": "g-1"},
                                {"fact": "Startup Y builds vector databases", "uuid": "g-2"}
                            ]
                            await emit_retrieval_event(session_id, {
                                "type": "retrieval",
                                "event": "results",
                                "tool": "guided_retrieval",
                                "stage": "graph",
                                "results": mock_graph
                            })
                            await emit_retrieval_event(session_id, {
                                "type": "retrieval",
                                "event": "end",
                                "tool": "guided_retrieval",
                                "stage": "graph",
                                "count": len(mock_graph),
                                "elapsed_ms": 60
                            })

                            # Vector stage
                            await emit_retrieval_event(session_id, {
                                "type": "retrieval",
                                "event": "start",
                                "tool": "guided_retrieval",
                                "stage": "vector",
                                "args": {"limit": 5}
                            })
                            await asyncio.sleep(0.05)
                            mock_vector = [
                                {"content": "Mock result A", "score": 0.91, "document_title": "Doc A", "document_source": "mock", "chunk_id": "mock-a"},
                                {"content": "Mock result B", "score": 0.83, "document_title": "Doc B", "document_source": "mock", "chunk_id": "mock-b"}
                            ]
                            await emit_retrieval_event(session_id, {
                                "type": "retrieval",
                                "event": "results",
                                "tool": "guided_retrieval",
                                "stage": "vector",
                                "results": mock_vector
                            })
                            await emit_retrieval_event(session_id, {
                                "type": "retrieval",
                                "event": "end",
                                "tool": "guided_retrieval",
                                "stage": "vector",
                                "count": len(mock_vector),
                                "elapsed_ms": 70
                            })

                            # Orchestrator end
                            await emit_retrieval_event(session_id, {
                                "type": "retrieval",
                                "event": "end",
                                "tool": "guided_retrieval",
                                "count": len(mock_graph) + len(mock_vector),
                                "elapsed_ms": 140
                            })
                        except Exception:
                            # Never let mock emissions break streaming
                            pass

                    try:
                        asyncio.create_task(_emit_mock_retrieval_events())
                    except Exception:
                        pass

                    # Stream mock token chunks
                    for chunk in ["This ", "is ", "a ", "mock ", "stream ", "response."]:
                        await asyncio.sleep(0.05)
                        yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
                        full_response += chunk
                        # Drain any pending retrieval events and stream them
                        if retrieval_queue is not None:
                            try:
                                while True:
                                    ev = retrieval_queue.get_nowait()
                                    yield f"data: {json.dumps({'type': 'retrieval', 'session_id': session_id, 'data': ev})}\n\n"
                            except asyncio.QueueEmpty:
                                pass

                    # No tool calls when in mock mode
                    tools_used = []
                else:
                    # Stream using agent.iter() pattern
                    async with rag_agent.iter(full_prompt, deps=deps) as run:
                        async for node in run:
                            if rag_agent.is_model_request_node(node):
                                # Stream tokens from the model
                                async with node.stream(run.ctx) as request_stream:
                                    async for event in request_stream:
                                        from pydantic_ai.messages import PartStartEvent, PartDeltaEvent, TextPartDelta
                                        
                                        if isinstance(event, PartStartEvent) and event.part.part_kind == 'text':
                                            delta_content = _sanitize_generated_text(event.part.content)
                                            yield f"data: {json.dumps({'type': 'text', 'content': delta_content})}\n\n"
                                            full_response += delta_content
                                            
                                            # Drain any pending retrieval events and stream them
                                            if retrieval_queue is not None:
                                                try:
                                                    while True:
                                                        ev = retrieval_queue.get_nowait()
                                                        yield f"data: {json.dumps({'type': 'retrieval', 'session_id': session_id, 'data': ev})}\n\n"
                                                except asyncio.QueueEmpty:
                                                    pass
                                            
                                        elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                                            delta_content = _sanitize_generated_text(event.delta.content_delta)
                                            yield f"data: {json.dumps({'type': 'text', 'content': delta_content})}\n\n"
                                            full_response += delta_content
                                            
                                            # Drain any pending retrieval events and stream them
                                            if retrieval_queue is not None:
                                                try:
                                                    while True:
                                                        ev = retrieval_queue.get_nowait()
                                                        yield f"data: {json.dumps({'type': 'retrieval', 'session_id': session_id, 'data': ev})}\n\n"
                                                except asyncio.QueueEmpty:
                                                    pass
                    
                    # Extract tools used from the final result
                    result = run.result
                    
                    # Fallback: if no token chunks were streamed but we have a final result,
                    # emit it as a single text event so the client gets an answer.
                    try:
                        final_text = getattr(result, "data", None)
                        if (not full_response.strip()) and isinstance(final_text, str) and final_text.strip():
                            yield f"data: {json.dumps({'type': 'text', 'content': final_text})}\n\n"
                            full_response += final_text
                    except Exception:
                        pass

                    tools_used = extract_tool_calls(result)

                    # If we launched guided retrieval, give it a brief moment to finish and flush events
                    if guided_task is not None:
                        try:
                            await asyncio.wait_for(guided_task, timeout=1.0)
                        except Exception:
                            pass

                    # Final drain of retrieval events to ensure 'complete' and 'summary' reach the client
                    if retrieval_queue is not None:
                        try:
                            while True:
                                ev = retrieval_queue.get_nowait()
                                yield f"data: {json.dumps({'type': 'retrieval', 'session_id': session_id, 'data': ev})}\n\n"
                        except asyncio.QueueEmpty:
                            pass
                
                # Final drain of retrieval events after model finished
                if retrieval_queue is not None:
                    try:
                        while True:
                            ev = retrieval_queue.get_nowait()
                            yield f"data: {json.dumps({'type': 'retrieval', 'session_id': session_id, 'data': ev})}\n\n"
                    except asyncio.QueueEmpty:
                        pass

                # Send tools used information
                if tools_used:
                    tools_data = [
                        {
                            "tool_name": tool.tool_name,
                            "args": tool.args,
                            "tool_call_id": tool.tool_call_id
                        }
                        for tool in tools_used
                    ]
                    yield f"data: {json.dumps({'type': 'tools', 'tools': tools_data})}\n\n"
                
                # Optionally build and stream a live knowledge graph payload
                graph_included = False
                live_graph = None
                try:
                    wants_graph = "graph" in (request.message or "").lower()
                    used_graph_tool = any(
                        getattr(t, "tool_name", "").lower().find("graph") != -1 for t in tools_used
                    )
                    if wants_graph or used_graph_tool:
                        live_graph = await build_live_graph_payload(request.message, tools_used)
                        if live_graph and (live_graph.get("nodes") or live_graph.get("edges")):
                            # Stream the graph payload as its own SSE event
                            yield f"data: {json.dumps({'type': 'graph', 'graph': live_graph})}\n\n"
                            graph_included = True
                except Exception:
                    # Never block streaming on graph construction issues
                    pass
                
                # If we attached a graph, adjust the assistant message to acknowledge it
                if graph_included:
                    try:
                        safe_response = full_response or ""
                        lower_resp = safe_response.lower()
                        negative_phrases = [
                            "unable to generate a visual graph",
                            "cannot generate a visual graph",
                            "can not generate a visual graph",
                            "unable to generate a graph",
                            "cannot generate a graph",
                            "can not generate a graph",
                            "i am unable to generate a graph",
                            "i cannot generate a graph",
                            "i'm unable to generate a graph",
                        ]
                        for phrase in negative_phrases:
                            if phrase in lower_resp:
                                idx = lower_resp.find(phrase)
                                safe_response = (
                                    safe_response[:idx]
                                    + "I've generated an interactive knowledge graph below."
                                    + safe_response[idx + len(phrase):]
                                )
                                lower_resp = safe_response.lower()
                        if "knowledge graph" not in lower_resp:
                            safe_response = (
                                "I've generated an interactive knowledge graph below.\n\n"
                                + safe_response
                            )
                        response_for_save = safe_response
                    except Exception:
                        # Do not fail the stream due to message post-processing
                        pass
                else:
                    response_for_save = full_response

                # Save assistant message after streaming completes (best-effort)
                try:
                    await add_message(
                        session_id=session_id,
                        role="assistant",
                        content=response_for_save,
                        metadata={"user_id": request.user_id}
                    )
                except Exception as e:
                    logger.warning("Failed to persist assistant message; continuing: %s", e)

                # Final end event
                yield f"data: {json.dumps({'type': 'end'})}\n\n"
            except Exception as e:
                # Stream error event and end
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
                yield f"data: {json.dumps({'type': 'end'})}\n\n"
            finally:
                # Ensure we always unregister the retrieval listener
                try:
                    if retrieval_queue is not None:
                        unregister_retrieval_listener(session_id, retrieval_queue)
                except Exception:
                    pass
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream"
            }
        )
        
    except Exception as e:
        logger.error(f"Streaming chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat/stream/legacy")  # Renamed to avoid conflict with enhanced endpoint
async def chat_stream_legacy(request: ChatRequest):
    """Streaming chat endpoint using Server-Sent Events."""
    try:
        # Get or create session
        session_id = await get_or_create_session(request)
        
        async def generate_stream():
            """Generate streaming response using agent.iter() pattern."""
            try:
                yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"
                
                # Create dependencies
                # Build search preferences from metadata
                prefs: Dict[str, Any] = {}
                meta = request.metadata or {}
                if isinstance(meta.get("collection_ids"), list):
                    prefs["collection_ids"] = meta.get("collection_ids")
                if isinstance(meta.get("selectedCollections"), list):
                    prefs["collection_ids"] = meta.get("selectedCollections")
                if isinstance(meta.get("document_ids"), list):
                    prefs["document_ids"] = meta.get("document_ids")
                if isinstance(meta.get("selectedDocuments"), list):
                    prefs["document_ids"] = meta.get("selectedDocuments")
                # New: allow scoping to explicit chunk IDs
                if isinstance(meta.get("chunk_ids"), list):
                    prefs["chunk_ids"] = meta.get("chunk_ids")
                if isinstance(meta.get("selectedChunks"), list):
                    prefs["chunk_ids"] = meta.get("selectedChunks")

                deps = AgentDependencies(
                    session_id=session_id,
                    user_id=request.user_id,
                    search_preferences=prefs,
                )
                
                # Get conversation context
                context = await get_conversation_context(session_id)
                
                # Build input with context
                full_prompt = request.message
                if context:
                    context_str = "\n".join([
                        f"{msg['role']}: {msg['content']}"
                        for msg in context[-6:]
                    ])
                    full_prompt = f"Previous conversation:\n{context_str}\n\nCurrent question: {request.message}"
                
                # Save user message immediately (best-effort)
                try:
                    await add_message(
                        session_id=session_id,
                        role="user",
                        content=request.message,
                        metadata={"user_id": request.user_id}
                    )
                except Exception as e:
                    logger.warning("Failed to persist user message; continuing stream: %s", e)
                
                full_response = ""
                # Register live retrieval events listener for this session (graceful fallback)
                retrieval_queue = None
                guided_task = None
                try:
                    retrieval_queue = register_retrieval_listener(session_id)
                    logger.info(f"Registered retrieval listener for session {session_id}, queue={retrieval_queue}")
                except Exception as e:
                    logger.error(f"Failed to register retrieval listener: {e}")
                    retrieval_queue = None
                
                # Determine if mock streaming mode is enabled
                use_mock = False
                try:
                    use_mock = bool(
                        (getattr(request, "metadata", {}) or {}).get("mock_stream")
                        or (getattr(request, "metadata", {}) or {}).get("mock")
                        or os.getenv("MOCK_STREAM") == "1"
                    )
                except Exception:
                    use_mock = False

                # Optionally force Enhanced Graph → Vector retrieval to run and emit retrieval_step events
                force_guided = False
                try:
                    force_guided = bool(
                        ((getattr(request, "metadata", {}) or {}).get("force_guided"))
                        or os.getenv("FORCE_GUIDED_RETRIEVAL") == "1"
                    )
                except Exception:
                    force_guided = os.getenv("FORCE_GUIDED_RETRIEVAL") == "1"

                if force_guided and not use_mock:
                    async def _run_enhanced_retrieval():
                        try:
                            retriever = EnhancedRetriever()
                            config = {
                                "use_graph": True,
                                "use_vector": True,
                                "use_query_expansion": True,
                                "vector_limit": 20,
                                "collection_ids": prefs.get("collection_ids"),
                                "document_ids": prefs.get("document_ids"),
                                "chunk_ids": prefs.get("chunk_ids"),
                            }
                            # This will emit granular retrieval_step events via emit_retrieval_event
                            await retriever.retrieve(
                                query=request.message,
                                session_id=session_id,
                                config=config,
                            )
                        except Exception as e:
                            logger.warning(f"Forced guided retrieval failed: {e}")

                    try:
                        guided_task = asyncio.create_task(_run_enhanced_retrieval())
                    except Exception:
                        guided_task = None

                if use_mock:
                    # Emit mock staged retrieval events (guided_retrieval: graph → vector)
                    async def _emit_mock_retrieval_events():
                        try:
                            # Orchestrator start
                            await emit_retrieval_event(session_id, {
                                "type": "retrieval",
                                "event": "start",
                                "tool": "guided_retrieval",
                                "args": {"query": request.message, "limit": 5}
                            })

                            # Graph stage
                            await emit_retrieval_event(session_id, {
                                "type": "retrieval",
                                "event": "start",
                                "tool": "guided_retrieval",
                                "stage": "graph"
                            })
                            await asyncio.sleep(0.05)
                            mock_graph = [
                                {"fact": "Company X acquired Startup Y in 2023", "uuid": "g-1"},
                                {"fact": "Startup Y builds vector databases", "uuid": "g-2"}
                            ]
                            await emit_retrieval_event(session_id, {
                                "type": "retrieval",
                                "event": "results",
                                "tool": "guided_retrieval",
                                "stage": "graph",
                                "results": mock_graph
                            })
                            await emit_retrieval_event(session_id, {
                                "type": "retrieval",
                                "event": "end",
                                "tool": "guided_retrieval",
                                "stage": "graph",
                                "count": len(mock_graph),
                                "elapsed_ms": 60
                            })

                            # Vector stage
                            await emit_retrieval_event(session_id, {
                                "type": "retrieval",
                                "event": "start",
                                "tool": "guided_retrieval",
                                "stage": "vector",
                                "args": {"limit": 5}
                            })
                            await asyncio.sleep(0.05)
                            mock_vector = [
                                {"content": "Mock result A", "score": 0.91, "document_title": "Doc A", "document_source": "mock", "chunk_id": "mock-a"},
                                {"content": "Mock result B", "score": 0.83, "document_title": "Doc B", "document_source": "mock", "chunk_id": "mock-b"}
                            ]
                            await emit_retrieval_event(session_id, {
                                "type": "retrieval",
                                "event": "results",
                                "tool": "guided_retrieval",
                                "stage": "vector",
                                "results": mock_vector
                            })
                            await emit_retrieval_event(session_id, {
                                "type": "retrieval",
                                "event": "end",
                                "tool": "guided_retrieval",
                                "stage": "vector",
                                "count": len(mock_vector),
                                "elapsed_ms": 70
                            })

                            # Orchestrator end
                            await emit_retrieval_event(session_id, {
                                "type": "retrieval",
                                "event": "end",
                                "tool": "guided_retrieval",
                                "count": len(mock_graph) + len(mock_vector),
                                "elapsed_ms": 140
                            })
                        except Exception:
                            # Never let mock emissions break streaming
                            pass

                    try:
                        asyncio.create_task(_emit_mock_retrieval_events())
                    except Exception:
                        pass

                    # Stream mock token chunks
                    for chunk in ["This ", "is ", "a ", "mock ", "stream ", "response."]:
                        await asyncio.sleep(0.05)
                        yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
                        full_response += chunk
                        # Drain any pending retrieval events and stream them
                        if retrieval_queue is not None:
                            try:
                                while True:
                                    ev = retrieval_queue.get_nowait()
                                    yield f"data: {json.dumps({'type': 'retrieval', 'session_id': session_id, 'data': ev})}\n\n"
                            except asyncio.QueueEmpty:
                                pass

                    # No tool calls when in mock mode
                    tools_used = []
                else:
                    # Stream using agent.iter() pattern
                    async with rag_agent.iter(full_prompt, deps=deps) as run:
                        async for node in run:
                            if rag_agent.is_model_request_node(node):
                                # Stream tokens from the model
                                async with node.stream(run.ctx) as request_stream:
                                    async for event in request_stream:
                                        from pydantic_ai.messages import PartStartEvent, PartDeltaEvent, TextPartDelta
                                        
                                        if isinstance(event, PartStartEvent) and event.part.part_kind == 'text':
                                            delta_content = _sanitize_generated_text(event.part.content)
                                            yield f"data: {json.dumps({'type': 'text', 'content': delta_content})}\n\n"
                                            full_response += delta_content
                                            
                                            # Drain any pending retrieval events and stream them
                                            if retrieval_queue is not None:
                                                try:
                                                    while True:
                                                        ev = retrieval_queue.get_nowait()
                                                        yield f"data: {json.dumps({'type': 'retrieval', 'session_id': session_id, 'data': ev})}\n\n"
                                                except asyncio.QueueEmpty:
                                                    pass
                                            
                                        elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                                            delta_content = _sanitize_generated_text(event.delta.content_delta)
                                            yield f"data: {json.dumps({'type': 'text', 'content': delta_content})}\n\n"
                                            full_response += delta_content
                                            
                                            # Drain any pending retrieval events and stream them
                                            if retrieval_queue is not None:
                                                try:
                                                    while True:
                                                        ev = retrieval_queue.get_nowait()
                                                        yield f"data: {json.dumps({'type': 'retrieval', 'session_id': session_id, 'data': ev})}\n\n"
                                                except asyncio.QueueEmpty:
                                                    pass
                    
                    # Extract tools used from the final result
                    result = run.result
                    
                    # Fallback: if no token chunks were streamed but we have a final result,
                    # emit it as a single text event so the client gets an answer.
                    try:
                        final_text = getattr(result, "data", None)
                        if (not full_response.strip()) and isinstance(final_text, str) and final_text.strip():
                            yield f"data: {json.dumps({'type': 'text', 'content': final_text})}\n\n"
                            full_response += final_text
                    except Exception:
                        pass

                    tools_used = extract_tool_calls(result)

                    # If we launched guided retrieval, give it a brief moment to finish and flush events
                    if guided_task is not None:
                        try:
                            await asyncio.wait_for(guided_task, timeout=1.0)
                        except Exception:
                            pass

                    # Final drain of retrieval events to ensure 'complete' and 'summary' reach the client
                    if retrieval_queue is not None:
                        try:
                            while True:
                                ev = retrieval_queue.get_nowait()
                                yield f"data: {json.dumps({'type': 'retrieval', 'session_id': session_id, 'data': ev})}\n\n"
                        except asyncio.QueueEmpty:
                            pass
                
                # Final drain of retrieval events after model finished
                if retrieval_queue is not None:
                    try:
                        while True:
                            ev = retrieval_queue.get_nowait()
                            yield f"data: {json.dumps({'type': 'retrieval', 'session_id': session_id, 'data': ev})}\n\n"
                    except asyncio.QueueEmpty:
                        pass

                # Send tools used information
                if tools_used:
                    tools_data = [
                        {
                            "tool_name": tool.tool_name,
                            "args": tool.args,
                            "tool_call_id": tool.tool_call_id
                        }
                        for tool in tools_used
                    ]
                    yield f"data: {json.dumps({'type': 'tools', 'tools': tools_data})}\n\n"
                
                # Optionally build and stream a live knowledge graph payload
                graph_included = False
                live_graph = None
                try:
                    wants_graph = "graph" in (request.message or "").lower()
                    used_graph_tool = any(
                        getattr(t, "tool_name", "").lower().find("graph") != -1 for t in tools_used
                    )
                    if wants_graph or used_graph_tool:
                        live_graph = await build_live_graph_payload(request.message, tools_used)
                        if live_graph and (live_graph.get("nodes") or live_graph.get("edges")):
                            # Stream the graph payload as its own SSE event
                            yield f"data: {json.dumps({'type': 'graph', 'graph': live_graph})}\n\n"
                            graph_included = True
                except Exception:
                    # Never block streaming on graph construction issues
                    pass
                
                # If we attached a graph, adjust the assistant message to acknowledge it
                if graph_included:
                    try:
                        safe_response = full_response or ""
                        lower_resp = safe_response.lower()
                        negative_phrases = [
                            "unable to generate a visual graph",
                            "cannot generate a visual graph",
                            "can not generate a visual graph",
                            "unable to generate a graph",
                            "cannot generate a graph",
                            "can not generate a graph",
                            "i am unable to generate a graph",
                            "i cannot generate a graph",
                            "i'm unable to generate a graph",
                        ]
                        for phrase in negative_phrases:
                            if phrase in lower_resp:
                                idx = lower_resp.find(phrase)
                                safe_response = (
                                    safe_response[:idx]
                                    + "I've generated an interactive knowledge graph below."
                                    + safe_response[idx + len(phrase):]
                                )
                                lower_resp = safe_response.lower()
                        if "knowledge graph" not in lower_resp:
                            safe_response = (
                                "I've generated an interactive knowledge graph below.\n\n"
                                + safe_response
                            )
                        response_for_save = safe_response
                    except Exception:
                        # Do not fail the stream due to message post-processing
                        pass
                else:
                    response_for_save = full_response

                # Save assistant message after streaming completes (best-effort)
                try:
                    await add_message(
                        session_id=session_id,
                        role="assistant",
                        content=response_for_save,
                        metadata={"user_id": request.user_id}
                    )
                except Exception as e:
                    logger.warning("Failed to persist assistant message; continuing: %s", e)

                # Final end event
                yield f"data: {json.dumps({'type': 'end'})}\n\n"
            except Exception as e:
                # Stream error event and end
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
                yield f"data: {json.dumps({'type': 'end'})}\n\n"
            finally:
                # Ensure we always unregister the retrieval listener
                try:
                    if retrieval_queue is not None:
                        unregister_retrieval_listener(session_id, retrieval_queue)
                except Exception:
                    pass
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream"
            }
        )
        
    except Exception as e:
        logger.error(f"Streaming chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/proposals/{proposal_id}/generate/stream")
async def proposal_generate_stream(proposal_id: str, request: ProposalGenerateRequest):
    """Stream generation of a proposal section with retrieval SSE events."""
    try:
        # Ensure proposal exists and fetch context
        proposal = await get_proposal_db(proposal_id)
        if not proposal:
            raise HTTPException(status_code=404, detail="Proposal not found")

        # Build a context-rich prompt for the section (include example style + draft excerpt if available)
        meta = request.metadata or {}
        import json as _json
        pmeta = proposal.get("metadata", {}) or {}
        example = pmeta.get("example_analysis") or {}
        style_prompt = example.get("style_prompt") or ""
        phrase_bank = example.get("phrase_bank") or []
        example_outline = [s.get("title") for s in (example.get("sections") or []) if isinstance(s, dict) and s.get("title")]
        draft_text = pmeta.get("draft_text") or ""
        draft_excerpt_chars = int(os.getenv("DRAFT_EXCERPT_CHARS", "1500"))
        
        # Local helpers to guard against binary/gibberish content leaking into prompts/outputs
        import re as _re
        def _looks_like_binary_text(text: str) -> bool:
            if not text:
                return False
            t = str(text).strip()
            if any(m in t[:300] for m in ("%PDF-", "startxref", "endobj", "/XRef", "FlateDecode")):
                return True
            allowed = _re.compile(r"[\w\s\.,;:'\-\(\)\[\]/&%]", _re.UNICODE)
            total = len(t)
            if total >= 24:
                allowed_count = sum(1 for ch in t if allowed.match(ch))
                if allowed_count / max(1, total) < 0.7:
                    return True
            if any(len(tok) > 120 for tok in t.split()):
                return True
            return False

        def _sanitize_generated_text(s: str) -> str:
            if not s:
                return s
            # Drop typical PDF markers/objects and compressed-looking segments
            patterns = [r"%PDF-[^\n]*\n", r"\bstartxref\b.*", r"\bendobj\b", r"/XRef", r"FlateDecode", r"\bobj\b <<[^>]*>>", r"\bxref\b[\s\S]*?\bendstream\b"]
            out = s
            for pat in patterns:
                out = _re.sub(pat, "", out, flags=_re.IGNORECASE)
            return out

        draft_excerpt = (draft_text[:draft_excerpt_chars] + ("…" if len(draft_text) > draft_excerpt_chars else "")) if draft_text else ""
        if _looks_like_binary_text(draft_excerpt):
            draft_excerpt = ""

        context_lines = [
            f"You are drafting the '{request.section_title}' section of a professional proposal.",
            "STRICT SCOPE: Only use information found in the retrieved sources that are in-scope for this proposal (selected documents/collections). Do not use outside knowledge or prior training. If retrieval yields nothing relevant, respond with: 'No relevant regulatory content found for this section.'",
            "Use the client/project context below. Cite regulatory claims with inline markers like [1], [2] and ground them in retrieved sources.",
            "If evidence is insufficient for any claim, clearly mark it with 'REQUIRES REVIEW' and do not invent content.",
            "Never output any PDF/binary markers (e.g., %PDF-, endobj, startxref, FlateDecode).",
            "Write clear, structured prose suitable for export.",
            "",
            "Client fields:",
            _json.dumps(proposal.get("client_fields", {}), indent=2),
            "",
            "Project fields:",
            _json.dumps(proposal.get("project_fields", {}), indent=2),
        ]
        if style_prompt:
            context_lines += ["", style_prompt]
        if phrase_bank:
            context_lines += ["", f"Preferred phrases (from example): {', '.join(phrase_bank[:12])}"]
        if example_outline:
            context_lines += ["", "Example outline titles:", " - " + "\n - ".join(example_outline[:15])]
        if draft_excerpt:
            context_lines += ["", "Draft excerpt:", draft_excerpt]
        if request.section_instructions:
            context_lines += ["", "Section instructions:", request.section_instructions]
        full_prompt = "\n".join(context_lines)

        # Reuse chat session utilities
        # Default to proposal-scoped regulatory docs if caller didn't specify
        try:
            if not (isinstance(meta.get("selectedDocuments"), list) and meta.get("selectedDocuments")):
                try:
                    regs = await list_proposal_documents_db(proposal_id, source_type="regulatory")
                except Exception:
                    regs = []
                doc_ids = [d.get("id") for d in regs if isinstance(d, dict) and d.get("id")]
                if doc_ids:
                    meta["selectedDocuments"] = doc_ids
                    meta["contextMode"] = "documents"
        except Exception:
            pass

        chat_like = ChatRequest(
            message=full_prompt,
            session_id=None,
            user_id=None,
            metadata=meta,
            search_type=request.search_type,
        )
        session_id = await get_or_create_session(chat_like)

        async def generate_stream():
            retrieval_queue = None
            guided_task = None
            full_response = ""
            try:
                yield f"data: {json.dumps({'type': 'session', 'session_id': session_id, 'proposal_id': proposal_id, 'section_title': request.section_title})}\n\n"

                # Build search preferences from metadata (collections/documents scoping)
                prefs: Dict[str, Any] = {}
                if isinstance(meta.get("collection_ids"), list):
                    prefs["collection_ids"] = meta.get("collection_ids")
                if isinstance(meta.get("selectedCollections"), list):
                    prefs["collection_ids"] = meta.get("selectedCollections")
                if isinstance(meta.get("document_ids"), list):
                    prefs["document_ids"] = meta.get("document_ids")
                if isinstance(meta.get("selectedDocuments"), list):
                    prefs["document_ids"] = meta.get("selectedDocuments")
                # New: allow scoping to explicit chunk IDs
                if isinstance(meta.get("chunk_ids"), list):
                    prefs["chunk_ids"] = meta.get("chunk_ids")
                if isinstance(meta.get("selectedChunks"), list):
                    prefs["chunk_ids"] = meta.get("selectedChunks")

                deps = AgentDependencies(
                    session_id=session_id,
                    user_id=None,
                    search_preferences=prefs,
                )

                # Listen for retrieval events for this session
                try:
                    retrieval_queue = register_retrieval_listener(session_id)
                except Exception:
                    retrieval_queue = None

                # Determine mock and force-guided flags
                use_mock = False
                try:
                    use_mock = bool(meta.get("mock_stream") or meta.get("mock") or os.getenv("MOCK_STREAM") == "1")
                except Exception:
                    use_mock = False

                force_guided = False
                try:
                    force_guided = bool(meta.get("force_guided") or os.getenv("FORCE_GUIDED_RETRIEVAL") == "1")
                except Exception:
                    force_guided = os.getenv("FORCE_GUIDED_RETRIEVAL") == "1"

                pre_results = None
                if force_guided and not use_mock:
                    try:
                        retriever = EnhancedRetriever()
                        # Honor proposal-level scoping for retrieval visibility
                        cfg_collection_ids = prefs.get("collection_ids") if isinstance(prefs, dict) else None
                        cfg_document_ids = prefs.get("document_ids") if isinstance(prefs, dict) else None
                        cfg_chunk_ids = prefs.get("chunk_ids") if isinstance(prefs, dict) else None
                        # If scoped to specific docs/collections, avoid unscoped graph facts
                        config = {
                            "use_graph": False if (cfg_collection_ids or cfg_document_ids) else True,
                            "use_vector": True,
                            "use_query_expansion": True,
                            "vector_limit": 20,
                            "collection_ids": cfg_collection_ids,
                            "document_ids": cfg_document_ids,
                            "chunk_ids": cfg_chunk_ids,
                        }
                        pre_results, pre_ctx = await retriever.retrieve(
                            query=request.section_title + ": " + (request.section_instructions or ""),
                            session_id=session_id,
                            config=config,
                        )
                        # If no valid vector chunks found, short-circuit with scoped-empty message
                        def _is_valid_chunk(r: dict) -> bool:
                            try:
                                c = r.get("content", "")
                                if not c or _looks_like_binary_text(c):
                                    return False
                                t = r.get("type", "")
                                # Accept vector types and seeded readable chunks
                                return t.startswith("vector_") or t in ("vector_chunk", "seed_chunk")
                            except Exception:
                                return False
                        has_valid = any(_is_valid_chunk(r) for r in (pre_results or []))
                        if not has_valid:
                            msg = "No relevant regulatory content found for this section. Please attach or select the appropriate documents and try again."
                            yield f"data: {json.dumps({'type': 'text', 'content': msg})}\n\n"
                            # Drain any pending retrieval events for completeness
                            if retrieval_queue is not None:
                                try:
                                    while True:
                                        ev = retrieval_queue.get_nowait()
                                        yield f"data: {json.dumps({'type': 'retrieval', 'session_id': session_id, 'data': ev})}\n\n"
                                except asyncio.QueueEmpty:
                                    pass
                            yield f"data: {json.dumps({'type': 'end'})}\n\n"
                            return
                    except Exception as e:
                        logger.warning(f"Forced guided retrieval failed: {e}")

                if use_mock:
                    # Emit staged mock retrieval events
                    async def _emit_mock():
                        try:
                            await emit_retrieval_event(session_id, {"type": "retrieval", "event": "start", "tool": "guided_retrieval"})
                            await asyncio.sleep(0.05)
                            await emit_retrieval_event(session_id, {"type": "retrieval", "event": "results", "tool": "guided_retrieval", "stage": "vector", "results": [{"content": "Mock regulation chunk", "chunk_id": "mock-1", "score": 0.9}]})
                            await emit_retrieval_event(session_id, {"type": "retrieval", "event": "end", "tool": "guided_retrieval"})
                        except Exception:
                            pass
                    try:
                        asyncio.create_task(_emit_mock())
                    except Exception:
                        pass

                    for chunk in ["Generating ", "mock ", "section ", "content ", "for ", f"{request.section_title}."]:
                        await asyncio.sleep(0.05)
                        yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
                        full_response += chunk
                        if retrieval_queue is not None:
                            try:
                                while True:
                                    ev = retrieval_queue.get_nowait()
                                    yield f"data: {json.dumps({'type': 'retrieval', 'session_id': session_id, 'data': ev})}\n\n"
                            except asyncio.QueueEmpty:
                                pass
                    tools_used = []
                else:
                    # Stream via rag_agent
                    async with rag_agent.iter(full_prompt, deps=deps) as run:
                        async for node in run:
                            if rag_agent.is_model_request_node(node):
                                async with node.stream(run.ctx) as request_stream:
                                    async for event in request_stream:
                                        from pydantic_ai.messages import PartStartEvent, PartDeltaEvent, TextPartDelta
                                        if isinstance(event, PartStartEvent) and event.part.part_kind == 'text':
                                            delta_content = _sanitize_generated_text(event.part.content)
                                            yield f"data: {json.dumps({'type': 'text', 'content': delta_content})}\n\n"
                                            full_response += delta_content
                                            if retrieval_queue is not None:
                                                try:
                                                    while True:
                                                        ev = retrieval_queue.get_nowait()
                                                        yield f"data: {json.dumps({'type': 'retrieval', 'session_id': session_id, 'data': ev})}\n\n"
                                                except asyncio.QueueEmpty:
                                                    pass
                                        elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                                            delta_content = _sanitize_generated_text(event.delta.content_delta)
                                            yield f"data: {json.dumps({'type': 'text', 'content': delta_content})}\n\n"
                                            full_response += delta_content
                                            if retrieval_queue is not None:
                                                try:
                                                    while True:
                                                        ev = retrieval_queue.get_nowait()
                                                        yield f"data: {json.dumps({'type': 'retrieval', 'session_id': session_id, 'data': ev})}\n\n"
                                                except asyncio.QueueEmpty:
                                                    pass
                    result = run.result
                    tools_used = extract_tool_calls(result)
                    if retrieval_queue is not None:
                        try:
                            while True:
                                ev = retrieval_queue.get_nowait()
                                yield f"data: {json.dumps({'type': 'retrieval', 'session_id': session_id, 'data': ev})}\n\n"
                        except asyncio.QueueEmpty:
                            pass
                    if tools_used:
                        tools_data = [
                            {"tool_name": t.tool_name, "args": t.args, "tool_call_id": t.tool_call_id}
                            for t in tools_used
                        ]
                        yield f"data: {json.dumps({'type': 'tools', 'tools': tools_data})}\n\n"

                # End event
                yield f"data: {json.dumps({'type': 'end'})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
                yield f"data: {json.dumps({'type': 'end'})}\n\n"
            finally:
                try:
                    if retrieval_queue is not None:
                        unregister_retrieval_listener(session_id, retrieval_queue)
                except Exception:
                    pass

        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Proposal generate stream failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/proposals/{proposal_id}/versions")
async def list_proposal_versions(proposal_id: str, limit: int = 20, offset: int = 0):
    try:
        versions = await list_proposal_versions_db(proposal_id, limit=limit, offset=offset)
        return {"proposal_id": proposal_id, "versions": versions, "limit": limit, "offset": offset}
    except Exception as e:
        logger.error(f"List proposal versions failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/proposals/{proposal_id}/example/upload")
async def upload_example_proposal(proposal_id: str, file: UploadFile = File(...)):
    """Upload an example proposal (pdf/docx/txt/md) and store extracted style/structure in proposal.metadata.example_analysis."""
    try:
        # Ensure proposal exists
        prop = await get_proposal_db(proposal_id)
        if not prop:
            raise HTTPException(status_code=404, detail="Proposal not found")

        # Persist temp file
        filename = file.filename or "example"
        _, ext = os.path.splitext(filename)
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext or "") as tmp:
            content = await file.read()
            tmp.write(content)
            temp_path = tmp.name
        try:
            text, meta = convert_to_markdown(temp_path)
        finally:
            try:
                os.remove(temp_path)
            except Exception:
                pass

        analysis = analyze_example_text(text or "")
        # Merge into metadata
        meta0 = (prop.get("metadata") or {}).copy()
        meta0["example_analysis"] = analysis
        meta0["example_file"] = {"name": filename, "ext": ext, "source_meta": meta}
        updated = await update_proposal_db(proposal_id, metadata=meta0)
        return {"success": True, "analysis": analysis, "proposal": updated}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload example failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/proposals/{proposal_id}/draft/upload")
async def upload_draft(proposal_id: str, file: UploadFile = File(...)):
    """Upload a draft (pdf/docx/txt/md); store plaintext into proposal.metadata.draft_text."""
    try:
        prop = await get_proposal_db(proposal_id)
        if not prop:
            raise HTTPException(status_code=404, detail="Proposal not found")

        filename = file.filename or "draft"
        _, ext = os.path.splitext(filename)
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext or "") as tmp:
            content = await file.read()
            tmp.write(content)
            temp_path = tmp.name
        try:
            text, meta = convert_to_markdown(temp_path)
        finally:
            try:
                os.remove(temp_path)
            except Exception:
                pass

        # Merge into metadata
        meta0 = (prop.get("metadata") or {}).copy()
        meta0["draft_text"] = text or ""
        meta0["draft_file"] = {"name": filename, "ext": ext, "source_meta": meta}
        updated = await update_proposal_db(proposal_id, metadata=meta0)
        return {"success": True, "characters": len(text or ""), "proposal": updated}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload draft failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/proposals/{proposal_id}/validate")
async def validate_proposal(proposal_id: str, request: Request):
    """Lightweight validation: ensure sections exist, warn if citations are missing in key sections, and basic structure checks.
    Body can include {"version_id": "..."}. If omitted, validates latest version.
    """
    try:
        body = {}
        try:
            body = await request.json()
        except Exception:
            body = {}
        version_id = body.get("version_id")

        if version_id:
            version = await get_proposal_version_db(version_id)
        else:
            version = await get_latest_proposal_version_db(proposal_id)
        if not version:
            raise HTTPException(status_code=404, detail="Proposal version not found")

        sections = version.get("sections") or []
        citations = version.get("citations") or []
        html = version.get("html") or ""

        warnings: List[str] = []
        errors: List[str] = []

        # Required sections by convention
        required_sections = [
            "Executive Summary",
            "Scope of Work",
            "Methodology",
            "Regulatory Compliance",
            "Deliverables",
            "Timeline",
            "Pricing",
            "Team & Qualifications",
            "Assumptions & Exclusions",
            "Terms & Conditions",
        ]

        titles = { (s.get("title") or s.get("key") or "").strip() for s in sections if isinstance(s, dict) }
        missing = [s for s in required_sections if s not in titles]
        if missing:
            warnings.append(f"Missing recommended sections: {', '.join(missing)}")

        # Check citations presence in Regulatory Compliance
        reg_sections = [s for s in sections if (s.get("title") or "").strip().lower() == "regulatory compliance"]
        if reg_sections:
            has_cites = any((s.get("citations") or []) for s in reg_sections)
            if not has_cites:
                warnings.append("No citations found in 'Regulatory Compliance' section")
        else:
            warnings.append("'Regulatory Compliance' section not present for validation")

        # Basic citation structure check
        bad_cites = []
        for idx, c in enumerate(citations):
            if not isinstance(c, dict):
                bad_cites.append(idx)
                continue
            if not (c.get("chunk_id") or c.get("source") or c.get("document_id")):
                bad_cites.append(idx)
        if bad_cites:
            warnings.append(f"{len(bad_cites)} citations missing identifiers (chunk_id/source/document_id)")

        # HTML presence check
        if not html and not sections:
            errors.append("No content to validate: both html and sections are empty")

        status = "ok" if not errors and not warnings else ("warnings" if not errors else "errors")
        return {"proposal_id": proposal_id, "version_id": version.get("id"), "status": status, "warnings": warnings, "errors": errors}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Validate proposal failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/proposals/{proposal_id}/export")
async def export_proposal_pdf(proposal_id: str, version_id: Optional[str] = None, download: bool = True):
    """Export a proposal version to PDF. If version_id not provided, exports latest version.
    Returns application/pdf. If WeasyPrint unavailable, returns 503 with guidance.
    """
    try:
        if version_id:
            version = await get_proposal_version_db(version_id)
        else:
            version = await get_latest_proposal_version_db(proposal_id)
        if not version:
            raise HTTPException(status_code=404, detail="Proposal version not found")

        # Build HTML if not provided
        sections = version.get("sections") or []
        citations = version.get("citations") or []
        title = (await get_proposal_db(proposal_id) or {}).get("title", "Proposal")
        html = version.get("html")
        if not html:
            # Assemble from sections and citations
            def esc(s: Any) -> str:
                try:
                    return (s or "").replace("<&>", "")
                except Exception:
                    return str(s)
            parts = [
                "<html>",
                "<head>",
                "<meta charset='utf-8' />",
                "<style>",
                "body{font-family:Inter,Segoe UI,Arial, sans-serif;color:#111827;padding:48px;}",
                "h1{font-size:28px;margin:0 0 16px 0;color:#111827;}",
                "h2{font-size:20px;margin:24px 0 8px 0;color:#111827;}",
                "p{line-height:1.6;margin:8px 0;}",
                ".header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #e5e7eb;padding-bottom:12px;margin-bottom:24px;}",
                ".brand{font-weight:700;color:#0ea5e9;}",
                ".footer{position:fixed;bottom:24px;left:48px;right:48px;color:#6b7280;font-size:12px;}",
                ".citation{font-size:12px;color:#6b7280;margin-top:4px;}",
                "</style>",
                "</head>",
                "<body>",
                f"<div class='header'><div class='brand'>&nbsp;</div><div>{datetime.utcnow().strftime('%Y-%m-%d')}</div></div>",
                f"<h1>{esc(title)}</h1>",
            ]
            for s in sections:
                stitle = esc((s or {}).get("title") or (s or {}).get("key") or "Section")
                scontent = (s or {}).get("content") or ""
                parts.append(f"<h2>{stitle}</h2>")
                parts.append(f"<div>{scontent}</div>")
                scites = (s or {}).get("citations") or []
                if scites:
                    parts.append("<div class='citation'>")
                    for i, c in enumerate(scites, start=1):
                        src = (c or {}).get("source") or (c or {}).get("document_title") or "Source"
                        parts.append(f"[{i}] {esc(src)}<br/>")
                    parts.append("</div>")
            if citations:
                parts.append("<h2>References</h2><div class='citation'>")
                for i, c in enumerate(citations, start=1):
                    src = (c or {}).get("source") or (c or {}).get("document_title") or "Source"
                    parts.append(f"[{i}] {esc(src)}<br/>")
                parts.append("</div>")
            parts.append("<div class='footer'>Generated by Proposal Generator</div>")
            parts.append("</body></html>")
            html = "".join(parts)

        if not WEASYPRINT_AVAILABLE:
            raise HTTPException(status_code=503, detail="PDF export unavailable: WeasyPrint not installed. Install 'weasyprint' and system dependencies (Cairo/Pango).")

        # Render PDF
        pdf_bytes = HTML(string=html).write_pdf()
        headers = {"Content-Type": "application/pdf"}
        if download:
            headers["Content-Disposition"] = f"attachment; filename=proposal_{proposal_id}.pdf"
        return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export proposal failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/proposals/{proposal_id}/export/docx")
async def export_proposal_docx(proposal_id: str, version_id: Optional[str] = None, download: bool = True):
    """Export a proposal version to DOCX for client editing off-app."""
    try:
        if not DOCX_AVAILABLE:
            raise HTTPException(status_code=503, detail="DOCX export unavailable: python-docx not installed.")

        if version_id:
            version = await get_proposal_version_db(version_id)
        else:
            version = await get_latest_proposal_version_db(proposal_id)
        if not version:
            raise HTTPException(status_code=404, detail="Proposal version not found")

        sections = version.get("sections") or []
        citations = version.get("citations") or []
        title = (await get_proposal_db(proposal_id) or {}).get("title", "Proposal")

        # Build DOCX
        from io import BytesIO
        doc = Document()
        doc.add_heading(title, level=0)

        def strip_html(html: str) -> str:
            try:
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(html, "html.parser")
                return soup.get_text("\n")
            except Exception:
                # Fallback: naive tag removal
                import re as _re
                return _re.sub(r"<[^>]+>", "", html)

        if sections:
            for s in sections:
                stitle = (s or {}).get("title") or (s or {}).get("key") or "Section"
                scontent = (s or {}).get("content") or ""
                doc.add_heading(stitle, level=1)
                text = strip_html(scontent)
                # split into paragraphs
                for para in [p for p in text.split("\n\n") if p.strip()]:
                    doc.add_paragraph(para)
        else:
            # Fallback: if html exists, strip and include
            html = version.get("html") or ""
            text = strip_html(html)
            for para in [p for p in text.split("\n\n") if p.strip()]:
                doc.add_paragraph(para)

        if citations:
            doc.add_heading("References", level=1)
            for i, c in enumerate(citations, start=1):
                src = (c or {}).get("source") or (c or {}).get("document_title") or "Source"
                doc.add_paragraph(f"[{i}] {src}")

        buf = BytesIO()
        doc.save(buf)
        data = buf.getvalue()
        headers = {"Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
        if download:
            headers["Content-Disposition"] = f"attachment; filename=proposal_{proposal_id}.docx"
        return Response(content=data, media_type=headers["Content-Type"], headers=headers)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export DOCX failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pricing/parse", response_model=PricingParseResponse)
async def parse_pricing_file(file: UploadFile = File(...)):
    """Parse a CSV or XLSX file of pricing items with columns like: service, unit_price (or price), quantity, description.
    Returns items and computed totals.
    """
    try:
        if not PANDAS_AVAILABLE:
            raise HTTPException(status_code=503, detail="Pandas not available for parsing. Please install 'pandas'.")

        filename = (file.filename or '').lower()
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty file")

        import io
        buf = io.BytesIO(content)

        if filename.endswith('.csv'):
            df = pd.read_csv(buf)
        elif filename.endswith('.xlsx') or filename.endswith('.xls'):
            df = pd.read_excel(buf)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Please upload .csv or .xlsx")

        # Normalize columns
        df.columns = [str(c).strip().lower() for c in df.columns]

        def find_col(names):
            for n in names:
                if n in df.columns:
                    return n
            return None

        service_col = find_col(["service", "item", "name", "description", "title"])
        price_col = find_col(["unit_price", "price", "rate", "unit price"])  # spaces after lower()
        qty_col = find_col(["quantity", "qty", "count", "units"])   
        desc_col = find_col(["description", "notes", "detail"]) if service_col not in ("description",) else None

        if not service_col or not price_col:
            raise HTTPException(status_code=400, detail="Missing required columns. Include at least 'service' and 'price' (or 'unit_price').")

        def to_float(x):
            try:
                if isinstance(x, str):
                    x = x.replace('$', '').replace(',', '').strip()
                return float(x)
            except Exception:
                return 0.0

        items: List[Dict[str, Any]] = []
        for _, row in df.iterrows():
            service = str(row.get(service_col) or "").strip()
            if not service:
                continue
            unit_price = to_float(row.get(price_col))
            quantity = to_float(row.get(qty_col)) if qty_col else 1.0
            description = None
            if desc_col:
                description = str(row.get(desc_col) or "").strip() or None
            items.append({
                "service": service,
                "unit_price": unit_price,
                "quantity": quantity,
                "description": description,
                "currency_symbol": "$",
            })

        subtotal = sum((it["unit_price"] or 0.0) * (it["quantity"] or 0.0) for it in items)
        total = subtotal
        return {
            "items": items,
            "subtotal": round(subtotal, 2),
            "total": round(total, 2),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Parse pricing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pricing/render", response_model=PricingRenderResponse)
async def render_pricing_table(req: PricingRenderRequest):
    """Render pricing items into an HTML table with totals. Suitable for embedding into a Proposal section."""
    try:
        items = req.items or []

        def money(v: float, sym: str = "$") -> str:
            try:
                return f"{sym}{float(v):,.2f}"
            except Exception:
                return f"{sym}{v}"

        rows_html = []
        subtotal = 0.0
        currency = items[0].currency_symbol if items else "$"
        for it in items:
            amount = (it.unit_price or 0.0) * (it.quantity or 0.0)
            subtotal += amount
            rows_html.append(
                f"<tr><td>{it.service}</td><td class='num'>{it.quantity:g}</td><td class='num'>{money(it.unit_price, it.currency_symbol)}</td><td class='num'>{money(amount, it.currency_symbol)}</td></tr>"
            )

        tax = subtotal * (req.tax_rate_percent / 100.0)
        total_before_discount = subtotal + tax
        total = max(0.0, total_before_discount - req.discount_amount)

        html = "".join([
            "<style>",
            "table.pricing{width:100%;border-collapse:collapse;margin:12px 0;}",
            "table.pricing th,table.pricing td{border:1px solid #e5e7eb;padding:8px;font-size:14px;}",
            "table.pricing th{background:#f8fafc;text-align:left;}",
            "table.pricing td.num{text-align:right;}",
            "table.pricing tfoot td{font-weight:600;}",
            "</style>",
            "<table class='pricing'>",
            "<thead><tr><th>Service</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead>",
            "<tbody>",
            *rows_html,
            "</tbody>",
            "<tfoot>",
            f"<tr><td colspan='3'>Subtotal</td><td class='num'>{money(subtotal, currency)}</td></tr>",
            f"<tr><td colspan='3'>Tax ({req.tax_rate_percent:.2f}%)</td><td class='num'>{money(tax, currency)}</td></tr>",
            f"<tr><td colspan='3'>Discount</td><td class='num'>-{money(req.discount_amount, currency)}</td></tr>",
            f"<tr><td colspan='3'>Total</td><td class='num'>{money(total, currency)}</td></tr>",
            "</tfoot>",
            "</table>",
        ])

        return {
            "html": html,
            "totals": {
                "subtotal": round(subtotal, 2),
                "tax": round(tax, 2),
                "discount": round(req.discount_amount, 2),
                "total": round(total, 2),
            }
        }
    except Exception as e:
        logger.error(f"Render pricing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))