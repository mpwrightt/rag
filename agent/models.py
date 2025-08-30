"""
Pydantic models for data validation and serialization.
"""

from typing import List, Dict, Any, Optional, Literal
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict, field_validator
from enum import Enum


class MessageRole(str, Enum):
    """Message role enumeration."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class SearchType(str, Enum):
    """Search type enumeration."""
    VECTOR = "vector"
    HYBRID = "hybrid"
    GRAPH = "graph"


# Request Models
class ChatRequest(BaseModel):
    """Chat request model."""
    message: str = Field(..., description="User message")
    session_id: Optional[str] = Field(None, description="Session ID for conversation continuity")
    user_id: Optional[str] = Field(None, description="User identifier")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    search_type: SearchType = Field(default=SearchType.HYBRID, description="Type of search to perform")
    
    model_config = ConfigDict(use_enum_values=True)


class SearchRequest(BaseModel):
    """Search request model."""
    query: str = Field(..., description="Search query")
    search_type: SearchType = Field(default=SearchType.HYBRID, description="Type of search")
    limit: int = Field(default=10, ge=1, le=50, description="Maximum results")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Search filters")
    
    model_config = ConfigDict(use_enum_values=True)


# Response Models
class DocumentMetadata(BaseModel):
    """Document metadata model."""
    id: str
    title: str
    source: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    chunk_count: Optional[int] = None


class ChunkResult(BaseModel):
    """Chunk search result model."""
    chunk_id: str
    document_id: str
    content: str
    score: float
    metadata: Dict[str, Any] = Field(default_factory=dict)
    document_title: str
    document_source: str
    
    @field_validator('score')
    @classmethod
    def validate_score(cls, v: float) -> float:
        """Ensure score is between 0 and 1."""
        return max(0.0, min(1.0, v))


class GraphSearchResult(BaseModel):
    """Knowledge graph search result model."""
    fact: str
    uuid: str
    valid_at: Optional[str] = None
    invalid_at: Optional[str] = None
    source_node_uuid: Optional[str] = None


class EntityRelationship(BaseModel):
    """Entity relationship model."""
    from_entity: str
    to_entity: str
    relationship_type: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SearchResponse(BaseModel):
    """Search response model."""
    results: List[ChunkResult] = Field(default_factory=list)
    graph_results: List[GraphSearchResult] = Field(default_factory=list)
    total_results: int = 0
    search_type: SearchType
    query_time_ms: float


class ToolCall(BaseModel):
    """Tool call information model."""
    tool_name: str
    args: Dict[str, Any] = Field(default_factory=dict)
    tool_call_id: Optional[str] = None


class SourceResult(BaseModel):
    """Source result for frontend display."""
    filename: str
    chunk_id: str
    relevance_score: float
    document_title: Optional[str] = None


class ChatResponse(BaseModel):
    """Chat response model."""
    message: str
    session_id: str
    sources: List[SourceResult] = Field(default_factory=list)
    tools_used: List[ToolCall] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class StreamDelta(BaseModel):
    """Streaming response delta."""
    content: str
    delta_type: Literal["text", "tool_call", "end"] = "text"
    metadata: Dict[str, Any] = Field(default_factory=dict)


# Database Models
class Document(BaseModel):
    """Document model."""
    id: Optional[str] = None
    title: str
    source: str
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Chunk(BaseModel):
    """Document chunk model."""
    id: Optional[str] = None
    document_id: str
    content: str
    embedding: Optional[List[float]] = None
    chunk_index: int
    metadata: Dict[str, Any] = Field(default_factory=dict)
    token_count: Optional[int] = None
    created_at: Optional[datetime] = None
    
    @field_validator('embedding')
    @classmethod
    def validate_embedding(cls, v: Optional[List[float]]) -> Optional[List[float]]:
        """Validate embedding dimensions."""
        if v is not None and len(v) != 1536:  # OpenAI text-embedding-3-small
            raise ValueError(f"Embedding must have 1536 dimensions, got {len(v)}")
        return v


class Session(BaseModel):
    """Session model."""
    id: Optional[str] = None
    user_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class Message(BaseModel):
    """Message model."""
    id: Optional[str] = None
    session_id: str
    role: MessageRole
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(use_enum_values=True)


# Agent Models
class AgentDependencies(BaseModel):
    """Dependencies for the agent."""
    session_id: str
    database_url: Optional[str] = None
    neo4j_uri: Optional[str] = None
    openai_api_key: Optional[str] = None
    
    model_config = ConfigDict(arbitrary_types_allowed=True)




class AgentContext(BaseModel):
    """Agent execution context."""
    session_id: str
    messages: List[Message] = Field(default_factory=list)
    tool_calls: List[ToolCall] = Field(default_factory=list)
    search_results: List[ChunkResult] = Field(default_factory=list)
    graph_results: List[GraphSearchResult] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


# Ingestion Models
class IngestionConfig(BaseModel):
    """Configuration for document ingestion."""
    chunk_size: int = Field(default=1000, ge=100, le=5000)
    chunk_overlap: int = Field(default=200, ge=0, le=1000)
    max_chunk_size: int = Field(default=2000, ge=500, le=10000)
    use_semantic_splitting: bool = True
    extract_entities: bool = True
    # New option for faster ingestion
    skip_graph_building: bool = Field(default=False, description="Skip knowledge graph building for faster ingestion")
    
    @field_validator('chunk_overlap')
    @classmethod
    def validate_overlap(cls, v: int, info) -> int:
        """Ensure overlap is less than chunk size."""
        chunk_size = info.data.get('chunk_size', 1000)
        if v >= chunk_size:
            raise ValueError(f"Chunk overlap ({v}) must be less than chunk size ({chunk_size})")
        return v


class IngestionResult(BaseModel):
    """Result of document ingestion."""
    document_id: str
    title: str
    chunks_created: int
    entities_extracted: int
    relationships_created: int
    processing_time_ms: float
    errors: List[str] = Field(default_factory=list)


# Error Models
class ErrorResponse(BaseModel):
    """Error response model."""
    error: str
    error_type: str
    details: Optional[Dict[str, Any]] = None
    request_id: Optional[str] = None


# Analytics Models
class ChatMetrics(BaseModel):
    """Chat activity metrics."""
    total_messages: int
    total_sessions: int
    unique_users: int
    avg_messages_per_session: float
    total_tool_calls: int
    avg_response_time_ms: float


class DocumentUsageStats(BaseModel):
    """Document usage statistics."""
    total_documents: int
    documents_uploaded_today: int
    most_referenced_document_id: Optional[str]
    most_referenced_document_title: Optional[str]
    avg_document_size: int


class RealTimeMetrics(BaseModel):
    """Real-time system metrics."""
    active_sessions: int
    messages_last_hour: int
    new_users_last_hour: int
    total_documents: int
    documents_today: int
    public_templates: int
    total_collections: int


class PromptTemplate(BaseModel):
    """Prompt template model."""
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    template: str
    category: str = "general"
    tags: List[str] = Field(default_factory=list)
    version: int = 1
    is_public: bool = False
    created_by: Optional[str] = None
    usage_count: int = 0
    rating_avg: float = 0
    rating_count: int = 0
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Collection(BaseModel):
    """Content collection model."""
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    color: str = "#6366f1"
    icon: str = "folder"
    created_by: Optional[str] = None
    is_shared: bool = False
    workspace_id: Optional[str] = None
    document_count: int = 0
    total_size: int = 0
    last_accessed: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class WorkflowStep(BaseModel):
    """Workflow step model."""
    type: str  # e.g., "search", "summarize", "tag", "notify"
    config: Dict[str, Any] = Field(default_factory=dict)
    name: Optional[str] = None
    description: Optional[str] = None


class Workflow(BaseModel):
    """Automation workflow model."""
    id: Optional[str] = None
    name: str
    description: Optional[str] = None
    trigger_type: Literal["document_upload", "schedule", "manual", "webhook"]
    trigger_config: Dict[str, Any] = Field(default_factory=dict)
    steps: List[WorkflowStep]
    is_active: bool = True
    created_by: Optional[str] = None
    execution_count: int = 0
    last_executed: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class UserEngagementMetrics(BaseModel):
    """User engagement analytics."""
    total_sessions: int
    avg_messages_per_session: float
    total_messages: int
    total_tool_calls: int
    total_searches: int
    avg_response_time: float
    high_satisfaction_count: int
    low_satisfaction_count: int
    avg_satisfaction_rating: float


# Request Models for New Features
class CreatePromptTemplateRequest(BaseModel):
    """Request to create a prompt template."""
    name: str
    description: Optional[str] = None
    template: str
    category: str = "general"
    tags: List[str] = Field(default_factory=list)
    is_public: bool = False


class CreateCollectionRequest(BaseModel):
    """Request to create a collection."""
    name: str
    description: Optional[str] = None
    color: str = "#6366f1"
    icon: str = "folder"
    is_shared: bool = False


class AddToCollectionRequest(BaseModel):
    """Request to add documents to collection."""
    document_ids: List[str]


class CreateWorkflowRequest(BaseModel):
    """Request to create a workflow."""
    name: str
    description: Optional[str] = None
    trigger_type: Literal["document_upload", "schedule", "manual", "webhook"]
    trigger_config: Dict[str, Any] = Field(default_factory=dict)
    steps: List[WorkflowStep]


# Response Models for New Features
class AnalyticsDashboardResponse(BaseModel):
    """Response for analytics dashboard."""
    real_time_metrics: RealTimeMetrics
    chat_metrics: ChatMetrics
    document_stats: DocumentUsageStats
    trending_searches: List[Dict[str, Any]] = Field(default_factory=list)
    user_engagement: UserEngagementMetrics


class PromptTemplateListResponse(BaseModel):
    """Response for prompt template list."""
    templates: List[PromptTemplate]
    total: int
    page: int
    per_page: int


class CollectionListResponse(BaseModel):
    """Response for collection list."""
    collections: List[Collection]
    total: int


# Health Check Models
class HealthStatus(BaseModel):
    """Health check status."""
    status: Literal["healthy", "degraded", "unhealthy"]
    database: bool
    graph_database: bool
    llm_connection: bool
    version: str
    timestamp: datetime