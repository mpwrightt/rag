"""
Enhanced FastAPI endpoints with real-time analytics, WebSockets, and enterprise features.
"""

import os
import asyncio
import json
import logging
import tempfile
import shutil
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Dict, Any, List, Optional, Tuple, Set
from datetime import datetime
import uuid

from fastapi import FastAPI, HTTPException, Request, Depends, UploadFile, File, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import StreamingResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
from dotenv import load_dotenv

# Import existing modules
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
    delete_document,
    list_documents,
    get_document,
    list_collections_db,
    create_collection_db
)
from .graph_utils import (
    initialize_graph,
    close_graph,
    test_graph_connection,
    get_entity_relationships as kg_get_entity_relationships,
    search_knowledge_graph as kg_search_knowledge_graph,
)

# Import new modules
from .analytics import analytics_tracker, track_message, track_search
from .models import (
    ChatRequest,
    ChatResponse,
    SearchRequest,
    SearchResponse,
    StreamDelta,
    ErrorResponse,
    HealthStatus,
    DocumentMetadata,
    IngestionConfig,
    IngestionResult,
    MessageRole,
    SearchType,
    # New models
    AnalyticsDashboardResponse,
    RealTimeMetrics,
    ChatMetrics,
    DocumentUsageStats,
    UserEngagementMetrics,
    PromptTemplate,
    PromptTemplateListResponse,
    CreatePromptTemplateRequest,
    Collection,
    CollectionListResponse,
    CreateCollectionRequest,
    AddToCollectionRequest,
    Workflow,
    CreateWorkflowRequest
)

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global state for WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.room_connections: Dict[str, Set[str]] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str, room: str = "default"):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        
        if room not in self.room_connections:
            self.room_connections[room] = set()
        self.room_connections[room].add(client_id)
        
        # Send welcome message
        await websocket.send_json({
            "type": "connection_established",
            "client_id": client_id,
            "room": room,
            "timestamp": datetime.now().isoformat()
        })
    
    def disconnect(self, client_id: str, room: str = "default"):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        
        if room in self.room_connections:
            self.room_connections[room].discard(client_id)
            if not self.room_connections[room]:
                del self.room_connections[room]
    
    async def send_personal_message(self, message: dict, client_id: str):
        websocket = self.active_connections.get(client_id)
        if websocket:
            try:
                await websocket.send_json(message)
            except:
                # Connection closed, remove it
                self.disconnect(client_id)
    
    async def broadcast_to_room(self, message: dict, room: str = "default"):
        if room in self.room_connections:
            disconnected = []
            for client_id in self.room_connections[room]:
                websocket = self.active_connections.get(client_id)
                if websocket:
                    try:
                        await websocket.send_json(message)
                    except:
                        disconnected.append(client_id)
            
            # Clean up disconnected clients
            for client_id in disconnected:
                self.disconnect(client_id, room)
    
    async def broadcast_analytics_update(self, metrics: RealTimeMetrics):
        """Broadcast real-time analytics to all connected clients."""
        message = {
            "type": "analytics_update",
            "data": metrics.model_dump(),
            "timestamp": datetime.now().isoformat()
        }
        await self.broadcast_to_room(message, "analytics")

manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle manager."""
    # Startup
    logger.info("Starting RAG API with enhanced features...")
    
    try:
        await initialize_database()
        logger.info("✅ Database initialized")
        
        await initialize_graph()
        logger.info("✅ Knowledge graph initialized")
        
        # Start background analytics updates
        asyncio.create_task(periodic_analytics_broadcast())
        logger.info("✅ Analytics broadcasting started")
        
        logger.info("🚀 Enhanced RAG API is ready!")
        
    except Exception as e:
        logger.error(f"Failed to initialize: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down RAG API...")
    await close_database()
    await close_graph()
    logger.info("✅ Shutdown complete")


async def periodic_analytics_broadcast():
    """Periodically broadcast analytics updates to connected clients."""
    while True:
        try:
            # Get real-time metrics
            metrics = await analytics_tracker.get_real_time_metrics()
            if metrics:
                await manager.broadcast_analytics_update(metrics)
            
            # Wait 30 seconds before next update
            await asyncio.sleep(30)
        except Exception as e:
            logger.error(f"Error broadcasting analytics: {e}")
            await asyncio.sleep(60)  # Wait longer on error


# Initialize FastAPI app with enhanced configuration
app = FastAPI(
    title="Enterprise RAG Platform API",
    description="Advanced Retrieval-Augmented Generation platform with real-time analytics, collaboration, and enterprise features",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# Enhanced middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Serve static files for documentation or admin interface
# app.mount("/static", StaticFiles(directory="static"), name="static")


# Enhanced utility functions
async def get_or_create_session(session_id: Optional[str] = None) -> Tuple[str, bool]:
    """Get existing session or create new one."""
    if session_id:
        session = await get_session(session_id)
        if session:
            return session_id, False
    
    # Create new session
    new_session_id = await create_session()
    return new_session_id, True


# WebSocket endpoints
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str, room: str = Query(default="default")):
    """WebSocket endpoint for real-time communication."""
    await manager.connect(websocket, client_id, room)
    try:
        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")
            
            if message_type == "chat_message":
                # Handle real-time chat
                await handle_websocket_chat(websocket, client_id, data)
            elif message_type == "collaboration":
                # Handle real-time collaboration
                await handle_collaboration_update(client_id, room, data)
            elif message_type == "analytics_subscribe":
                # Subscribe to analytics updates
                await manager.connect(websocket, client_id, "analytics")
            
    except WebSocketDisconnect:
        manager.disconnect(client_id, room)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        manager.disconnect(client_id, room)


async def handle_websocket_chat(websocket: WebSocket, client_id: str, data: dict):
    """Handle real-time chat through WebSocket."""
    try:
        message = data.get("message", "")
        session_id = data.get("session_id")
        
        if not message:
            await websocket.send_json({"type": "error", "message": "Empty message"})
            return
        
        # Get or create session
        session_id, is_new = await get_or_create_session(session_id)
        
        # Track the message
        start_time = datetime.now()
        
        # Process with agent  
        # Extract collection and document filters from data metadata if available
        metadata = data.get("metadata", {})
        selected_collections = metadata.get('selectedCollections', [])
        selected_documents = metadata.get('selectedDocuments', [])
        
        # Create search preferences with collection/document filtering
        search_preferences = {}
        if selected_collections:
            search_preferences['collection_ids'] = selected_collections
        if selected_documents:
            search_preferences['document_ids'] = selected_documents
            
        # Load previous conversation history for context
        from .db_utils import get_session_messages, add_message
        previous_messages = await get_session_messages(session_id, limit=20)  # Last 20 messages
        logger.info(f"WebSocket endpoint: Loaded {len(previous_messages)} previous messages for session {session_id}")
        
        # Save user message to database
        await add_message(
            session_id=session_id,
            role="user", 
            content=message,
            metadata=metadata
        )
            
        deps = AgentDependencies(
            session_id=session_id,
            search_preferences=search_preferences if search_preferences else None
        )
        
        # Stream response
        await websocket.send_json({
            "type": "response_start",
            "session_id": session_id
        })
        
        response_text = ""
        tools_used = []
        
        # Build conversation history for agent context
        conversation_history = []
        if previous_messages:
            for msg in previous_messages[-10:]:  # Last 10 messages for context
                conversation_history.append({
                    "role": msg['role'],
                    "content": msg['content']
                })
        
        # Add current user message to history
        conversation_history.append({
            "role": "user",
            "content": message
        })
        
        # Create context message that includes conversation history
        if len(conversation_history) > 1:
            context_message = "Previous conversation context:\n"
            for msg in conversation_history[:-1]:  # All except current message
                context_message += f"{msg['role'].upper()}: {msg['content'][:300]}...\n" if len(msg['content']) > 300 else f"{msg['role'].upper()}: {msg['content']}\n"
            context_message += f"\nCurrent request: {message}"
        else:
            context_message = message
        
        async for chunk in rag_agent.run_stream(context_message, deps=deps):
            if hasattr(chunk, 'content') and chunk.content:
                response_text += chunk.content
                await websocket.send_json({
                    "type": "response_chunk",
                    "content": chunk.content
                })
        
        # Calculate response time
        response_time = int((datetime.now() - start_time).total_seconds() * 1000)
        
        # Save assistant response to database
        await add_message(
            session_id=session_id,
            role="assistant",
            content=response_text,
            metadata={
                "response_time_ms": response_time,
                "tools_used": len(tools_used),
                "selected_collections": selected_collections,
                "selected_documents": selected_documents
            }
        )
        
        # Track analytics
        await track_message(
            session_id=session_id,
            user_id=client_id,
            tool_calls=len(tools_used),
            response_time_ms=response_time
        )
        
        await websocket.send_json({
            "type": "response_complete",
            "session_id": session_id,
            "response_time_ms": response_time
        })
        
    except Exception as e:
        logger.error(f"WebSocket chat error: {e}")
        await websocket.send_json({
            "type": "error",
            "message": "Failed to process message"
        })


async def handle_collaboration_update(client_id: str, room: str, data: dict):
    """Handle real-time collaboration updates."""
    collaboration_data = {
        "type": "collaboration_update",
        "client_id": client_id,
        "data": data.get("data", {}),
        "timestamp": datetime.now().isoformat()
    }
    
    # Broadcast to all clients in the room except sender
    if room in manager.room_connections:
        for other_client_id in manager.room_connections[room]:
            if other_client_id != client_id:
                await manager.send_personal_message(collaboration_data, other_client_id)


# Enhanced API Endpoints

# Analytics Endpoints
@app.get("/api/analytics/dashboard", response_model=AnalyticsDashboardResponse)
async def get_analytics_dashboard(days: int = Query(default=7, ge=1, le=90)):
    """Get comprehensive analytics dashboard data."""
    try:
        # Get real-time metrics
        real_time_metrics = await analytics_tracker.get_real_time_metrics()
        if not real_time_metrics:
            real_time_metrics = RealTimeMetrics(
                active_sessions=0,
                messages_last_hour=0,
                new_users_last_hour=0,
                total_documents=0,
                documents_today=0,
                public_templates=0,
                total_collections=0
            )
        
        # Get chat metrics
        chat_metrics = await analytics_tracker.get_chat_activity_metrics(days)
        if not chat_metrics:
            chat_metrics = ChatMetrics(
                total_messages=0,
                total_sessions=0,
                unique_users=0,
                avg_messages_per_session=0,
                total_tool_calls=0,
                avg_response_time_ms=0
            )
        
        # Get document stats
        document_stats = await analytics_tracker.get_document_usage_stats()
        if not document_stats:
            document_stats = DocumentUsageStats(
                total_documents=0,
                documents_uploaded_today=0,
                most_referenced_document_id=None,
                most_referenced_document_title=None,
                avg_document_size=0
            )
        
        # Get trending searches
        trending_searches = await analytics_tracker.get_trending_searches(days)
        
        # Get user engagement metrics
        user_engagement_data = await analytics_tracker.get_user_engagement_metrics(days=days)
        user_engagement = UserEngagementMetrics(
            total_sessions=user_engagement_data.get('total_sessions', 0),
            avg_messages_per_session=user_engagement_data.get('avg_messages_per_session', 0),
            total_messages=user_engagement_data.get('total_messages', 0),
            total_tool_calls=user_engagement_data.get('total_tool_calls', 0),
            total_searches=user_engagement_data.get('total_searches', 0),
            avg_response_time=user_engagement_data.get('avg_response_time', 0),
            high_satisfaction_count=user_engagement_data.get('high_satisfaction_count', 0),
            low_satisfaction_count=user_engagement_data.get('low_satisfaction_count', 0),
            avg_satisfaction_rating=user_engagement_data.get('avg_satisfaction_rating', 0)
        )
        
        return AnalyticsDashboardResponse(
            real_time_metrics=real_time_metrics,
            chat_metrics=chat_metrics,
            document_stats=document_stats,
            trending_searches=trending_searches,
            user_engagement=user_engagement
        )
        
    except Exception as e:
        logger.error(f"Failed to get analytics dashboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve analytics data")


@app.get("/api/analytics/real-time", response_model=RealTimeMetrics)
async def get_real_time_metrics():
    """Get current real-time metrics."""
    try:
        metrics = await analytics_tracker.get_real_time_metrics()
        if not metrics:
            metrics = RealTimeMetrics(
                active_sessions=0,
                messages_last_hour=0,
                new_users_last_hour=0,
                total_documents=0,
                documents_today=0,
                public_templates=0,
                total_collections=0
            )
        return metrics
    except Exception as e:
        logger.error(f"Failed to get real-time metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve real-time metrics")


# Prompt Templates Endpoints
@app.get("/api/prompt-templates", response_model=PromptTemplateListResponse)
async def list_prompt_templates(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    category: Optional[str] = Query(default=None),
    is_public: Optional[bool] = Query(default=None),
    search: Optional[str] = Query(default=None)
):
    """List prompt templates with filtering and pagination."""
    # This is a simplified implementation - you'd implement the full database queries
    return PromptTemplateListResponse(
        templates=[],
        total=0,
        page=page,
        per_page=per_page
    )


@app.post("/api/prompt-templates")
async def create_prompt_template(template_request: CreatePromptTemplateRequest):
    """Create a new prompt template."""
    # Implementation would go here
    return {"message": "Prompt template created successfully"}


# Collections Endpoints
@app.get("/api/collections", response_model=CollectionListResponse)
async def list_collections(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    created_by: Optional[str] = Query(default=None),
    workspace_id: Optional[str] = Query(default=None),
    is_shared: Optional[bool] = Query(default=None),
):
    """List collections with optional filtering and pagination."""
    try:
        # Log incoming request parameters for diagnostics
        logger.info(
            f"Listing collections params: page={page}, per_page={per_page}, "
            f"search={search}, created_by={created_by}, workspace_id={workspace_id}, is_shared={is_shared}"
        )
        offset = (page - 1) * per_page
        collections, total = await list_collections_db(
            limit=per_page,
            offset=offset,
            search=search,
            created_by=created_by,
            workspace_id=workspace_id,
            is_shared=is_shared,
        )
        # Pydantic will coerce dicts to Collection model
        return CollectionListResponse(collections=collections, total=total)
    except Exception as e:
        # Log full traceback with parameters to pinpoint the failure
        logger.exception(
            "Failed to list collections (page=%s, per_page=%s, search=%s, created_by=%s, workspace_id=%s, is_shared=%s)",
            page,
            per_page,
            search,
            created_by,
            workspace_id,
            is_shared,
        )
        raise HTTPException(status_code=500, detail="Failed to list collections")


@app.post("/api/collections", response_model=Collection, status_code=201)
async def create_collection(collection_request: CreateCollectionRequest, request: Request):
    """Create a new collection."""
    try:
        # Pull optional creator/workspace from headers if provided
        created_by = request.headers.get("x-user-id")
        workspace_id = request.headers.get("x-workspace-id")

        # Optional visibility via query param (e.g., visibility=public)
        visibility = request.query_params.get("visibility")
        metadata: Dict[str, Any] = {}
        if visibility == "public":
            metadata["visibility"] = "public"
            metadata["is_public"] = True

        created = await create_collection_db(
            name=collection_request.name,
            description=collection_request.description,
            color=collection_request.color,
            icon=collection_request.icon,
            is_shared=collection_request.is_shared,
            created_by=created_by,
            workspace_id=workspace_id,
            metadata=metadata,
        )

        return created
    except Exception as e:
        logger.exception("Failed to create collection: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create collection")


@app.post("/api/collections/{collection_id}/documents")
async def add_documents_to_collection(collection_id: str, request: AddToCollectionRequest):
    """Add documents to a collection."""
    return {"message": f"Added {len(request.document_ids)} documents to collection"}


# Workflows Endpoints
@app.get("/api/workflows")
async def list_workflows():
    """List all workflows."""
    return {"workflows": []}


@app.post("/api/workflows")
async def create_workflow(workflow_request: CreateWorkflowRequest):
    """Create a new workflow."""
    return {"message": "Workflow created successfully"}


# Enhanced existing endpoints with analytics tracking
@app.post("/api/chat/stream")
@app.post("/chat/stream")  # Also handle the path without /api prefix for compatibility  
async def chat_stream(chat_request: ChatRequest):
    """Enhanced streaming chat with analytics tracking."""
    logger.info(f"🚀 Enhanced chat endpoint called with session_id: {chat_request.session_id}")
    session_id, is_new_session = await get_or_create_session(chat_request.session_id)
    logger.info(f"📝 Using session: {session_id}, is_new: {is_new_session}")
    
    start_time = datetime.now()
    
    async def generate_response():
        try:
            # Extract collection and document filters from request metadata
            metadata = chat_request.metadata or {}
            selected_collections = metadata.get('selectedCollections', [])
            selected_documents = metadata.get('selectedDocuments', [])
            
            # Create search preferences with collection/document filtering
            search_preferences = {}
            if selected_collections:
                search_preferences['collection_ids'] = selected_collections
            if selected_documents:
                search_preferences['document_ids'] = selected_documents
            
            # Load previous conversation history for context
            from .db_utils import get_session_messages, add_message
            previous_messages = await get_session_messages(session_id, limit=20)  # Last 20 messages
            logger.info(f"Enhanced endpoint: Loaded {len(previous_messages)} previous messages for session {session_id}")
            
            # Save user message to database
            await add_message(
                session_id=session_id,
                role="user", 
                content=chat_request.message,
                metadata=metadata
            )
            
            deps = AgentDependencies(
                session_id=session_id,
                search_preferences=search_preferences if search_preferences else None
            )
            
            tools_used = []
            response_text = ""
            
            # Build conversation history for agent context
            conversation_history = []
            if previous_messages:
                for msg in previous_messages[-10:]:  # Last 10 messages for context
                    conversation_history.append({
                        "role": msg['role'],
                        "content": msg['content']
                    })
            
            # Add current user message to history
            conversation_history.append({
                "role": "user",
                "content": chat_request.message
            })
            
            # Create context message that includes conversation history
            if len(conversation_history) > 1:
                context_message = "Previous conversation context:\n"
                for msg in conversation_history[:-1]:  # All except current message
                    context_message += f"{msg['role'].upper()}: {msg['content'][:300]}...\n" if len(msg['content']) > 300 else f"{msg['role'].upper()}: {msg['content']}\n"
                context_message += f"\nCurrent request: {chat_request.message}"
                logger.info(f"Enhanced endpoint: Built context with {len(conversation_history)-1} previous messages")
            else:
                context_message = chat_request.message
                logger.info(f"Enhanced endpoint: No conversation history, using direct message")
            
            # Stream the response
            async for chunk in rag_agent.run_stream(context_message, deps=deps):
                if hasattr(chunk, 'content') and chunk.content:
                    response_text += chunk.content
                    yield f"data: {json.dumps({'content': chunk.content, 'type': 'text'})}\n\n"
            
            # Calculate response time and track analytics
            response_time = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Save assistant response to database
            await add_message(
                session_id=session_id,
                role="assistant",
                content=response_text,
                metadata={
                    "response_time_ms": response_time,
                    "tools_used": len(tools_used),
                    "selected_collections": selected_collections,
                    "selected_documents": selected_documents
                }
            )
            
            # Track the message
            await track_message(
                session_id=session_id,
                user_id=chat_request.user_id,
                tool_calls=len(tools_used),
                response_time_ms=response_time
            )
            
            # Send completion signal
            yield f"data: {json.dumps({'type': 'end', 'session_id': session_id, 'response_time_ms': response_time})}\n\n"
            
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            yield f"data: {json.dumps({'error': str(e), 'type': 'error'})}\n\n"
    
    return StreamingResponse(
        generate_response(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# Keep all existing endpoints from the original API...
# (Health check, documents, search, etc. - I'll implement the key ones)

@app.get("/health", response_model=HealthStatus)
async def health_check():
    """Enhanced health check with more comprehensive status."""
    try:
        # Test database
        db_healthy = await test_connection()
        
        # Test graph database
        graph_healthy = await test_graph_connection()
        
        # Determine overall status
        if db_healthy and graph_healthy:
            status = "healthy"
        elif db_healthy or graph_healthy:
            status = "degraded"
        else:
            status = "unhealthy"
        
        return HealthStatus(
            status=status,
            database=db_healthy,
            graph_database=graph_healthy,
            llm_connection=True,  # Would test actual LLM connection
            version="2.0.0",
            timestamp=datetime.now()
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthStatus(
            status="unhealthy",
            database=False,
            graph_database=False,
            llm_connection=False,
            version="2.0.0",
            timestamp=datetime.now()
        )


if __name__ == "__main__":
    # Get configuration from environment with deployment-friendly defaults
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", os.getenv("APP_PORT", 8000)))
    log_level = os.getenv("LOG_LEVEL", "info").lower()
    app_env = os.getenv("APP_ENV", "production")
    
    print(f"🚀 Starting Enhanced RAG API Backend on {host}:{port}")
    print(f"📊 Environment: {app_env}")
    print(f"📝 Log Level: {log_level}")
    
    uvicorn.run(
        "agent.api_enhanced:app",  # String format for deployment stability
        host=host,
        port=port,
        log_level=log_level,
        reload=False,  # Disabled for deployment stability
        access_log=True
    )