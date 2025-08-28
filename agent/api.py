"""
FastAPI endpoints for the agentic RAG system.
"""

import os
import asyncio
import json
import logging
import tempfile
import shutil
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import uuid

from fastapi import FastAPI, HTTPException, Request, Depends, UploadFile, File
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import uvicorn
from dotenv import load_dotenv

from .agent import rag_agent, AgentDependencies

from .context import get_current_search_results, clear_search_results
from .db_utils import (
    initialize_database,
    close_database,
    create_session,
    get_session,
    add_message,
    get_session_messages,
    test_connection,
    delete_document
)
from .graph_utils import (
    initialize_graph,
    close_graph,
    test_graph_connection,
    get_entity_relationships as kg_get_entity_relationships,
    search_knowledge_graph as kg_search_knowledge_graph,
)
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
    RealTimeMetrics,
    ChatMetrics,
    DocumentUsageStats,
    UserEngagementMetrics,
    AnalyticsDashboardResponse
)
from .tools import (
    vector_search_tool,
    graph_search_tool,
    hybrid_search_tool,
    list_documents_tool,
    VectorSearchInput,
    GraphSearchInput,
    HybridSearchInput,
    DocumentListInput
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
        # Initialize database connections
        await initialize_database()
        logger.info("Database initialized")
        
        # Initialize graph database
        await initialize_graph()
        logger.info("Graph database initialized")
        
        # Test connections
        db_ok = await test_connection()
        graph_ok = await test_graph_connection()
        
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
        logger.error(f"Startup failed: {e}")
        raise
    
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Initialize question generator
question_generator = None


# Helper functions for agent execution
async def get_or_create_session(request: ChatRequest) -> str:
    """Get existing session or create new one."""
    if request.session_id:
        session = await get_session(request.session_id)
        if session:
            return request.session_id
    
    # Create new session
    return await create_session(
        user_id=request.user_id,
        metadata=request.metadata
    )


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
    save_conversation: bool = True
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
        
        # Create dependencies
        deps = AgentDependencies(
            session_id=session_id,
            user_id=user_id
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
        
        # Execute agent
        response, tools_used, sources = await execute_agent(
            message=request.message,
            session_id=session_id,
            user_id=request.user_id
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
    """Streaming chat endpoint using Server-Sent Events."""
    try:
        # Get or create session
        session_id = await get_or_create_session(request)
        
        async def generate_stream():
            """Generate streaming response using agent.iter() pattern."""
            try:
                yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"
                
                # Create dependencies
                deps = AgentDependencies(
                    session_id=session_id,
                    user_id=request.user_id
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
                
                # Save user message immediately
                await add_message(
                    session_id=session_id,
                    role="user",
                    content=request.message,
                    metadata={"user_id": request.user_id}
                )
                
                full_response = ""
                
                # Stream using agent.iter() pattern
                async with rag_agent.iter(full_prompt, deps=deps) as run:
                    async for node in run:
                        if rag_agent.is_model_request_node(node):
                            # Stream tokens from the model
                            async with node.stream(run.ctx) as request_stream:
                                async for event in request_stream:
                                    from pydantic_ai.messages import PartStartEvent, PartDeltaEvent, TextPartDelta
                                    
                                    if isinstance(event, PartStartEvent) and event.part.part_kind == 'text':
                                        delta_content = event.part.content
                                        yield f"data: {json.dumps({'type': 'text', 'content': delta_content})}\n\n"
                                        full_response += delta_content
                                        
                                    elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                                        delta_content = event.delta.content_delta
                                        yield f"data: {json.dumps({'type': 'text', 'content': delta_content})}\n\n"
                                        full_response += delta_content
                
                # Extract tools used from the final result
                result = run.result
                tools_used = extract_tool_calls(result)
                
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
                        full_response = safe_response
                    except Exception:
                        # Do not fail the stream due to message post-processing
                        pass
                
                # Save assistant response
                await add_message(
                    session_id=session_id,
                    role="assistant",
                    content=full_response,
                    metadata={
                        "streamed": True,
                        "tool_calls": len(tools_used),
                        **({"graph": live_graph} if graph_included and live_graph else {})
                    }
                )
                
                yield f"data: {json.dumps({'type': 'end'})}\n\n"
                
            except Exception as e:
                logger.error(f"Stream error: {e}")
                error_chunk = {
                    "type": "error",
                    "content": f"Stream error: {str(e)}"
                }
                yield f"data: {json.dumps(error_chunk)}\n\n"
        
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


@app.post("/search/vector")
async def search_vector(request: SearchRequest):
    """Vector search endpoint."""
    try:
        input_data = VectorSearchInput(
            query=request.query,
            limit=request.limit
        )
        
        start_time = datetime.now()
        results = await vector_search_tool(input_data)
        end_time = datetime.now()
        
        query_time = (end_time - start_time).total_seconds() * 1000
        
        return SearchResponse(
            results=results,
            total_results=len(results),
            search_type="vector",
            query_time_ms=query_time
        )
        
    except Exception as e:
        logger.error(f"Vector search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search/graph")
async def search_graph(request: SearchRequest):
    """Knowledge graph search endpoint."""
    try:
        input_data = GraphSearchInput(
            query=request.query
        )
        
        start_time = datetime.now()
        results = await graph_search_tool(input_data)
        end_time = datetime.now()
        
        query_time = (end_time - start_time).total_seconds() * 1000
        
        return SearchResponse(
            graph_results=results,
            total_results=len(results),
            search_type="graph",
            query_time_ms=query_time
        )
        
    except Exception as e:
        logger.error(f"Graph search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search/hybrid")
async def search_hybrid(request: SearchRequest):
    """Hybrid search endpoint."""
    try:
        input_data = HybridSearchInput(
            query=request.query,
            limit=request.limit
        )
        
        start_time = datetime.now()
        results = await hybrid_search_tool(input_data)
        end_time = datetime.now()
        
        query_time = (end_time - start_time).total_seconds() * 1000
        
        return SearchResponse(
            results=results,
            total_results=len(results),
            search_type="hybrid",
            query_time_ms=query_time
        )
        
    except Exception as e:
        logger.error(f"Hybrid search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/documents")
async def list_documents_endpoint(
    limit: int = 20,
    offset: int = 0
):
    """List documents endpoint."""
    try:
        input_data = DocumentListInput(limit=limit, offset=offset)
        documents = await list_documents_tool(input_data)
        
        return {
            "documents": documents,
            "total": len(documents),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        logger.error(f"Document listing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/documents/{document_id}")
async def delete_document_endpoint(document_id: str):
    """Delete document endpoint."""
    try:
        # Validate UUID format
        try:
            uuid.UUID(document_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid document ID format")
        
        success = await delete_document(document_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return {
            "success": True,
            "message": f"Document {document_id} deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document deletion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload and ingest document endpoint."""
    if not INGESTION_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Document ingestion pipeline is not available"
        )
    
    try:
        # Validate file type
        allowed_extensions = {'.txt', '.md', '.pdf', '.docx', '.doc'}
        file_extension = os.path.splitext(file.filename)[1].lower() if file.filename else ''
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=400, 
                detail=f"File type {file_extension} not supported. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Validate file size (10MB limit)
        max_size = 10 * 1024 * 1024  # 10MB
        file_content = await file.read()
        if len(file_content) > max_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is 10MB, got {len(file_content) / 1024 / 1024:.1f}MB"
            )
        
        # Create temporary directory for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_file_path = Path(temp_dir) / file.filename
            
            # Write uploaded file to temporary location
            with open(temp_file_path, 'wb') as temp_file:
                temp_file.write(file_content)
            
            # Create ingestion configuration
            config = IngestionConfig(
                chunk_size=int(os.getenv("CHUNK_SIZE", 800)),
                chunk_overlap=int(os.getenv("CHUNK_OVERLAP", 150)),
                max_chunk_size=int(os.getenv("MAX_CHUNK_SIZE", 1500)),
                embedding_model=os.getenv("EMBEDDING_MODEL", "text-embedding-004"),
                vector_dimension=int(os.getenv("VECTOR_DIMENSION", 768)),
                llm_choice=os.getenv("INGESTION_LLM_CHOICE", os.getenv("LLM_CHOICE", "gemini-1.5-flash")),
                enable_graph=True,
                clean_before_ingest=False
            )
            
            # Initialize ingestion pipeline
            pipeline = DocumentIngestionPipeline(
                config=config,
                documents_folder=str(temp_dir),
                clean_before_ingest=False
            )
            
            # Process the document
            results = await pipeline.ingest_documents()
            
            if not results or len(results) == 0:
                raise HTTPException(
                    status_code=500,
                    detail="Document processing failed: No results returned"
                )
            
            # Check if results were successful (successful if document_id is not empty and no errors)
            successful_results = [r for r in results if r.document_id and len(r.errors) == 0]
            failed_results = [r for r in results if not r.document_id or len(r.errors) > 0]
            
            if len(successful_results) == 0:
                error_messages = []
                for r in failed_results:
                    if r.errors:
                        error_messages.extend(r.errors)
                raise HTTPException(
                    status_code=500,
                    detail=f"Document processing failed: {'; '.join(error_messages) if error_messages else 'Unknown error'}"
                )
            
            # Aggregate statistics from all successful results
            total_chunks = sum(r.chunks_created for r in successful_results)
            total_entities = sum(r.entities_extracted for r in successful_results)
            total_relationships = sum(r.relationships_created for r in successful_results)
            total_processing_time = sum(r.processing_time_ms for r in successful_results)
            
            logger.info(f"Successfully ingested document: {file.filename}")
            
            return {
                "success": True,
                "message": f"File {file.filename} uploaded and processed successfully",
                "filename": file.filename,
                "size": len(file_content),
                "documents_processed": len(successful_results),
                "chunks_created": total_chunks,
                "embeddings_created": total_chunks,  # Each chunk gets an embedding
                "graph_entities": total_entities,
                "graph_relationships": total_relationships,
                "processing_time_ms": total_processing_time,
                "failed_documents": len(failed_results)
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload and ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.get("/sessions/{session_id}")
async def get_session_info(session_id: str):
    """Get session information."""
    try:
        session = await get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return session
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Session retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# 3rd Party Integration Endpoints
_integration_instances = {}  # Store active integration instances

@app.get("/integrations")
async def list_available_integrations():
    """List available 3rd party integrations."""
    if not INTEGRATIONS_AVAILABLE:
        return {"integrations": []}
    
    integrations = [
        {
            "name": "google_drive",
            "display_name": "Google Drive",
            "description": "Import documents from Google Drive",
            "auth_required": True,
            "supported_formats": [".txt", ".md", ".pdf", ".docx", ".doc"]
        },
        {
            "name": "dropbox", 
            "display_name": "Dropbox",
            "description": "Import documents from Dropbox",
            "auth_required": True,
            "supported_formats": [".txt", ".md", ".pdf", ".docx", ".doc"]
        },
        {
            "name": "onedrive",
            "display_name": "OneDrive",
            "description": "Import documents from OneDrive", 
            "auth_required": True,
            "supported_formats": [".txt", ".md", ".pdf", ".docx", ".doc"]
        }
    ]
    
    return {"integrations": integrations}


@app.get("/integrations/{service_name}/auth-config")
async def get_integration_auth_config(service_name: str):
    """Get OAuth configuration for client-side authentication."""
    if not INTEGRATIONS_AVAILABLE:
        raise HTTPException(status_code=503, detail="Integrations not available")
    
    # Return public OAuth configuration (no secrets)
    configs = {
        "google_drive": {
            "client_id": os.getenv("GOOGLE_DRIVE_CLIENT_ID", "your_google_client_id"),  # Public client ID
            "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
            "scope": "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.metadata.readonly",
            "redirect_uri": "http://localhost:3000/auth/callback/google_drive"
        },
        "dropbox": {
            "client_id": os.getenv("DROPBOX_CLIENT_ID", "your_dropbox_client_id"),  # Public client ID
            "auth_url": "https://www.dropbox.com/oauth2/authorize",
            "scope": "files.content.read files.metadata.read",
            "redirect_uri": "http://localhost:3000/auth/callback/dropbox"
        },
        "onedrive": {
            "client_id": os.getenv("ONEDRIVE_CLIENT_ID", "your_onedrive_client_id"),  # Public client ID
            "auth_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            "scope": "https://graph.microsoft.com/Files.Read https://graph.microsoft.com/Files.Read.All offline_access",
            "redirect_uri": "http://localhost:3000/auth/callback/onedrive"
        }
    }
    
    if service_name not in configs:
        raise HTTPException(status_code=400, detail=f"Unknown service: {service_name}")
    
    return configs[service_name]


@app.post("/integrations/{service_name}/store-token")
async def store_integration_token(service_name: str, request: Request):
    """Store user's OAuth token for integration."""
    if not INTEGRATIONS_AVAILABLE:
        raise HTTPException(status_code=503, detail="Integrations not available")
    
    try:
        body = await request.json()
        access_token = body.get('access_token')
        user_id = body.get('user_id', 'anonymous')  # Optional user identification
        
        if not access_token:
            raise HTTPException(status_code=400, detail="Missing access_token")
        
        # Create integration instance with user's token
        # No client secret needed for token-only operations
        if service_name == "google_drive":
            integration = GoogleDriveIntegration(IntegrationConfig(
                client_id="", client_secret="", redirect_uri="", 
                scopes=[], service_name=service_name
            ))
        elif service_name == "dropbox":
            integration = DropboxIntegration(IntegrationConfig(
                client_id="", client_secret="", redirect_uri="",
                scopes=[], service_name=service_name
            ))
        elif service_name == "onedrive":
            integration = OneDriveIntegration(IntegrationConfig(
                client_id="", client_secret="", redirect_uri="",
                scopes=[], service_name=service_name
            ))
        else:
            raise HTTPException(status_code=400, detail=f"Unknown service: {service_name}")
        
        # Set the user's token
        integration.set_tokens(access_token)
        
        # Store integration session
        session_id = str(uuid.uuid4())
        _integration_instances[session_id] = integration
        
        return {
            "success": True,
            "session_id": session_id,
            "service_name": service_name,
            "message": "Token stored successfully"
        }
        
    except Exception as e:
        logger.error(f"Token storage failed for {service_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/integrations/{service_name}/documents")
async def list_integration_documents(
    service_name: str,
    session_id: str,
    folder_id: Optional[str] = None
):
    """List documents from a 3rd party integration."""
    if not INTEGRATIONS_AVAILABLE:
        raise HTTPException(status_code=503, detail="Integrations not available")
    
    integration = _integration_instances.get(session_id)
    if not integration:
        raise HTTPException(status_code=401, detail="Not authenticated or session expired")
    
    try:
        documents = await integration.list_documents(folder_id)
        return {"documents": documents}
        
    except Exception as e:
        logger.error(f"Failed to list {service_name} documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/integrations/{service_name}/import")
async def import_documents_from_integration(
    service_name: str,
    request: Request
):
    """Import selected documents from a 3rd party integration."""
    if not INTEGRATIONS_AVAILABLE:
        raise HTTPException(status_code=503, detail="Integrations not available")
    
    if not INGESTION_AVAILABLE:
        raise HTTPException(status_code=503, detail="Document ingestion not available")
    
    try:
        body = await request.json()
        session_id = body.get('session_id')
        document_ids = body.get('document_ids', [])
        
        if not session_id or not document_ids:
            raise HTTPException(status_code=400, detail="Missing session_id or document_ids")
        
        integration = _integration_instances.get(session_id)
        if not integration:
            raise HTTPException(status_code=401, detail="Not authenticated or session expired")
        
        imported_documents = []
        failed_documents = []
        total_documents = len(document_ids)
        processed_count = 0
        
        logger.info(f"Starting sequential import of {total_documents} documents from {service_name}")
        
        # Import each document sequentially (one at a time for data integrity)
        async for document in integration.bulk_import_documents(document_ids):
            processed_count += 1
            logger.info(f"Processing document {processed_count}/{total_documents}: {document.name}")
            
            try:
                # Save to temporary file
                temp_file_path = await integration.save_temp_file(document)
                
                # Create ingestion configuration
                config = IngestionConfig(
                    chunk_size=int(os.getenv("CHUNK_SIZE", 800)),
                    chunk_overlap=int(os.getenv("CHUNK_OVERLAP", 150)),
                    max_chunk_size=int(os.getenv("MAX_CHUNK_SIZE", 1500)),
                    embedding_model=os.getenv("EMBEDDING_MODEL", "text-embedding-004"),
                    vector_dimension=int(os.getenv("VECTOR_DIMENSION", 768)),
                    llm_choice=os.getenv("INGESTION_LLM_CHOICE", os.getenv("LLM_CHOICE", "gemini-1.5-flash")),
                    enable_graph=True,
                    clean_before_ingest=False
                )
                
                # Process with ingestion pipeline (sequential processing ensures data integrity)
                temp_dir = os.path.dirname(temp_file_path)
                pipeline = DocumentIngestionPipeline(
                    config=config,
                    documents_folder=temp_dir,
                    clean_before_ingest=False
                )
                
                logger.info(f"Starting ingestion for: {document.name}")
                results = await pipeline.ingest_documents()
                
                # Clean up temp file
                try:
                    os.unlink(temp_file_path)
                except:
                    pass  # Ignore cleanup errors
                
                # Process results
                successful_results = [r for r in results if r.document_id and len(r.errors) == 0]
                
                if successful_results:
                    result = successful_results[0]  # Should only be one document
                    imported_documents.append({
                        "id": document.id,
                        "name": document.name,
                        "service": service_name,
                        "chunks_created": result.chunks_created,
                        "entities_extracted": result.entities_extracted,
                        "processing_time_ms": result.processing_time_ms,
                        "processed_at": processed_count,
                        "total_documents": total_documents
                    })
                    logger.info(f"Successfully imported: {document.name} ({result.chunks_created} chunks, {result.entities_extracted} entities)")
                else:
                    failed_documents.append({
                        "id": document.id,
                        "name": document.name,
                        "error": "Processing failed - no successful results",
                        "processed_at": processed_count,
                        "total_documents": total_documents
                    })
                    logger.warning(f"Failed to import: {document.name} - no successful results")
                    
            except Exception as e:
                logger.error(f"Failed to import document {document.id}: {e}")
                failed_documents.append({
                    "id": document.id if hasattr(document, 'id') else 'unknown',
                    "name": document.name if hasattr(document, 'name') else 'unknown',
                    "error": str(e),
                    "processed_at": processed_count,
                    "total_documents": total_documents
                })
        
        return {
            "success": True,
            "imported_count": len(imported_documents),
            "failed_count": len(failed_documents),
            "imported_documents": imported_documents,
            "failed_documents": failed_documents
        }
    except Exception as e:
        logger.error(f"Bulk import from {service_name} failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Analytics endpoints
@app.get("/api/analytics/real-time", response_model=RealTimeMetrics)
async def api_get_real_time_metrics():
    """Get real-time metrics."""
    metrics = await analytics_tracker.get_real_time_metrics()
    if metrics is None:
        metrics = RealTimeMetrics(
            active_sessions=0,
            messages_last_hour=0,
            new_users_last_hour=0,
            total_documents=0,
            documents_today=0,
            public_templates=0,
            total_collections=0,
        )
    return metrics


@app.get("/api/analytics/chat-metrics", response_model=ChatMetrics)
async def api_get_chat_metrics(days: int = 7):
    """Get aggregated chat metrics over the last N days."""
    metrics = await analytics_tracker.get_chat_activity_metrics(days=days)
    if metrics is None:
        metrics = ChatMetrics(
            total_messages=0,
            total_sessions=0,
            unique_users=0,
            avg_messages_per_session=0.0,
            total_tool_calls=0,
            avg_response_time_ms=0.0,
        )
    return metrics


@app.get("/api/analytics/document-usage", response_model=DocumentUsageStats)
async def api_get_document_usage():
    """Get document usage statistics."""
    stats = await analytics_tracker.get_document_usage_stats()
    if stats is None:
        stats = DocumentUsageStats(
            total_documents=0,
            documents_uploaded_today=0,
            most_referenced_document_id=None,
            most_referenced_document_title=None,
            avg_document_size=0,
        )
    return stats


@app.get("/api/analytics/trending-searches")
async def api_get_trending_searches(days: int = 7, limit: int = 10):
    """Get trending searches within the last N days."""
    searches = await analytics_tracker.get_trending_searches(days=days, limit=limit)
    return {"trending_searches": searches}


@app.get("/api/analytics/user-engagement", response_model=UserEngagementMetrics)
async def api_get_user_engagement(user_id: Optional[str] = None, days: int = 30):
    """Get user engagement metrics optionally filtered by user_id."""
    data = await analytics_tracker.get_user_engagement_metrics(user_id=user_id, days=days)
    # Provide safe defaults if empty
    return UserEngagementMetrics(
        total_sessions=int(data.get("total_sessions", 0) or 0),
        avg_messages_per_session=float(data.get("avg_messages_per_session", 0) or 0),
        total_messages=int(data.get("total_messages", 0) or 0),
        total_tool_calls=int(data.get("total_tool_calls", 0) or 0),
        total_searches=int(data.get("total_searches", 0) or 0),
        avg_response_time=float(data.get("avg_response_time", 0) or 0),
        high_satisfaction_count=int(data.get("high_satisfaction_count", 0) or 0),
        low_satisfaction_count=int(data.get("low_satisfaction_count", 0) or 0),
        avg_satisfaction_rating=float(data.get("avg_satisfaction_rating", 0) or 0),
    )


@app.get("/api/analytics/dashboard", response_model=AnalyticsDashboardResponse)
async def api_get_dashboard(days: int = 7, user_id: Optional[str] = None):
    """Get combined analytics dashboard data."""
    real_time = await analytics_tracker.get_real_time_metrics()
    if real_time is None:
        real_time = RealTimeMetrics(
            active_sessions=0,
            messages_last_hour=0,
            new_users_last_hour=0,
            total_documents=0,
            documents_today=0,
            public_templates=0,
            total_collections=0,
        )

    chat = await analytics_tracker.get_chat_activity_metrics(days=days)
    if chat is None:
        chat = ChatMetrics(
            total_messages=0,
            total_sessions=0,
            unique_users=0,
            avg_messages_per_session=0.0,
            total_tool_calls=0,
            avg_response_time_ms=0.0,
        )

    doc_stats = await analytics_tracker.get_document_usage_stats()
    if doc_stats is None:
        doc_stats = DocumentUsageStats(
            total_documents=0,
            documents_uploaded_today=0,
            most_referenced_document_id=None,
            most_referenced_document_title=None,
            avg_document_size=0,
        )

    trending = await analytics_tracker.get_trending_searches(days=days, limit=10)
    engagement_dict = await analytics_tracker.get_user_engagement_metrics(user_id=user_id, days=days)
    engagement = UserEngagementMetrics(
        total_sessions=int(engagement_dict.get("total_sessions", 0) or 0),
        avg_messages_per_session=float(engagement_dict.get("avg_messages_per_session", 0) or 0),
        total_messages=int(engagement_dict.get("total_messages", 0) or 0),
        total_tool_calls=int(engagement_dict.get("total_tool_calls", 0) or 0),
        total_searches=int(engagement_dict.get("total_searches", 0) or 0),
        avg_response_time=float(engagement_dict.get("avg_response_time", 0) or 0),
        high_satisfaction_count=int(engagement_dict.get("high_satisfaction_count", 0) or 0),
        low_satisfaction_count=int(engagement_dict.get("low_satisfaction_count", 0) or 0),
        avg_satisfaction_rating=float(engagement_dict.get("avg_satisfaction_rating", 0) or 0),
    )

    return AnalyticsDashboardResponse(
        real_time_metrics=real_time,
        chat_metrics=chat,
        document_stats=doc_stats,
        trending_searches=trending,
        user_engagement=engagement,
    )


# Question Generation Endpoints
@app.get("/api/questions/generate")
async def generate_questions(collection_id: Optional[str] = None, limit: int = 6):
    """Generate relevant questions based on document content."""
    logger.info(f"Question generation requested - collection_id: {collection_id}, limit: {limit}")
    
    if not question_generator:
        logger.warning("Question generator not initialized")
        return {"questions": [], "source": "fallback_no_generator", "error": "Question generator not initialized"}
    
    try:
        if collection_id:
            questions = await question_generator.generate_questions_for_collection(
                collection_id=collection_id, 
                limit=limit
            )
        else:
            questions = await question_generator.generate_questions_for_all_documents(
                limit=limit
            )
        
        logger.info(f"Generated {len(questions)} questions")
        return {"questions": questions, "source": "ai_generated"}
    
    except Exception as e:
        logger.error(f"Error generating questions: {e}")
        return {"questions": [], "source": "fallback_error", "error": str(e)}

@app.post("/api/questions/clear-cache")
async def clear_question_cache():
    """Clear the question generation cache."""
    if question_generator:
        question_generator.clear_cache()
        return {"message": "Question cache cleared"}
    return {"message": "Question generator not available"}

@app.get("/api/questions/debug")
async def debug_questions():
    """Debug endpoint to check document count and question generation."""
    try:
        from .db_utils import db_pool as pool
        
        if not pool:
            return {"error": "Database not connected"}
            
        async with pool.acquire() as conn:
            # Count total documents
            doc_count = await conn.fetchval("SELECT COUNT(*) FROM documents")
            
            # Count chunks
            chunk_count = await conn.fetchval("SELECT COUNT(*) FROM chunks")
            
            # Get sample document titles
            sample_docs = await conn.fetch("""
                SELECT title, source, LENGTH(content) as content_length 
                FROM documents 
                ORDER BY created_at DESC 
                LIMIT 5
            """)
            
            return {
                "document_count": doc_count,
                "chunk_count": chunk_count,
                "sample_documents": [
                    {
                        "title": doc["title"],
                        "source": doc["source"],
                        "content_length": doc["content_length"]
                    } for doc in sample_docs
                ],
                "question_generator_available": question_generator is not None
            }
    except Exception as e:
        logger.error(f"Debug endpoint error: {e}")
        return {"error": str(e)}


# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler."""
    logger.error(f"Unhandled exception: {exc}")
    
    return ErrorResponse(
        error=str(exc),
        error_type=type(exc).__name__,
        request_id=str(uuid.uuid4())
    )


# Development server
if __name__ == "__main__":
    uvicorn.run(
        app,
        host=APP_HOST,
        port=APP_PORT,
        reload=APP_ENV == "development",
        log_level=LOG_LEVEL.lower(),
    )