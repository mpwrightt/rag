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
    """
    Represents a request to the chat endpoint.

    Attributes:
        message: The user's message.
        session_id: An optional ID for maintaining conversation continuity.
        user_id: An optional identifier for the user.
        metadata: Additional metadata for the request.
        search_type: The type of search to be performed.
    """
    message: str = Field(..., description="User message")
    session_id: Optional[str] = Field(None, description="Session ID for conversation continuity")
    user_id: Optional[str] = Field(None, description="User identifier")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    search_type: SearchType = Field(default=SearchType.HYBRID, description="Type of search to perform")
    
    model_config = ConfigDict(use_enum_values=True)


class SearchRequest(BaseModel):
    """
    Represents a request to the search endpoint.

    Attributes:
        query: The search query.
        search_type: The type of search to be performed.
        limit: The maximum number of results to return.
        filters: A dictionary of filters to apply to the search.
    """
    query: str = Field(..., description="Search query")
    search_type: SearchType = Field(default=SearchType.HYBRID, description="Type of search")
    limit: int = Field(default=10, ge=1, le=50, description="Maximum results")
    filters: Dict[str, Any] = Field(default_factory=dict, description="Search filters")
    
    model_config = ConfigDict(use_enum_values=True)


# Response Models
class DocumentMetadata(BaseModel):
    """
    Represents the metadata for a document.

    Attributes:
        id: The unique identifier for the document.
        title: The title of the document.
        source: The source of the document.
        metadata: A dictionary of additional metadata.
        created_at: The timestamp when the document was created.
        updated_at: The timestamp when the document was last updated.
        chunk_count: An optional count of the chunks in the document.
    """
    id: str
    title: str
    source: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime
    chunk_count: Optional[int] = None


class ChunkResult(BaseModel):
    """
    Represents a single chunk returned from a search result.

    Attributes:
        chunk_id: The unique identifier for the chunk.
        document_id: The ID of the document to which the chunk belongs.
        content: The text content of the chunk.
        score: The relevance score of the chunk.
        metadata: A dictionary of additional metadata.
        document_title: The title of the document.
        document_source: The source of the document.
    """
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
    """
    Represents a single result from a knowledge graph search.

    Attributes:
        fact: The content of the fact.
        uuid: The unique identifier for the fact.
        valid_at: An optional timestamp for when the fact became valid.
        invalid_at: An optional timestamp for when the fact became invalid.
        source_node_uuid: An optional ID of the source node for the fact.
    """
    fact: str
    uuid: str
    valid_at: Optional[str] = None
    invalid_at: Optional[str] = None
    source_node_uuid: Optional[str] = None


class EntityRelationship(BaseModel):
    """
    Represents a relationship between two entities in the knowledge graph.

    Attributes:
        from_entity: The name of the source entity.
        to_entity: The name of the target entity.
        relationship_type: The type of the relationship.
        metadata: A dictionary of additional metadata for the relationship.
    """
    from_entity: str
    to_entity: str
    relationship_type: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SearchResponse(BaseModel):
    """
    Represents a response from the search endpoint.

    Attributes:
        results: A list of chunk results from vector or hybrid search.
        graph_results: A list of results from a graph search.
        total_results: The total number of results found.
        search_type: The type of search that was performed.
        query_time_ms: The time taken for the query in milliseconds.
    """
    results: List[ChunkResult] = Field(default_factory=list)
    graph_results: List[GraphSearchResult] = Field(default_factory=list)
    total_results: int = 0
    search_type: SearchType
    query_time_ms: float


class ToolCall(BaseModel):
    """
    Represents a call to a tool made by the agent.

    Attributes:
        tool_name: The name of the tool that was called.
        args: A dictionary of arguments passed to the tool.
        tool_call_id: An optional, unique ID for the tool call.
    """
    tool_name: str
    args: Dict[str, Any] = Field(default_factory=dict)
    tool_call_id: Optional[str] = None


class SourceResult(BaseModel):
    """
    Represents a source document for frontend display.

    This model provides a simplified view of a search result for use in a UI.

    Attributes:
        filename: The name of the source file.
        chunk_id: The ID of the specific chunk from the source.
        relevance_score: The relevance score of the source.
        document_title: An optional title for the source document.
    """
    filename: str
    chunk_id: str
    relevance_score: float
    document_title: Optional[str] = None


class ChatResponse(BaseModel):
    """
    Represents a response from the chat endpoint.

    Attributes:
        message: The agent's response message.
        session_id: The ID of the session.
        sources: A list of sources used to generate the response.
        tools_used: A list of tools that were called by the agent.
        metadata: A dictionary of additional metadata for the response.
    """
    message: str
    session_id: str
    sources: List[SourceResult] = Field(default_factory=list)
    tools_used: List[ToolCall] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class StreamDelta(BaseModel):
    """
    Represents a single delta in a streaming response.

    Attributes:
        content: The content of the delta.
        delta_type: The type of the delta (e.g., 'text', 'tool_call', 'end').
        metadata: A dictionary of additional metadata for the delta.
    """
    content: str
    delta_type: Literal["text", "tool_call", "end"] = "text"
    metadata: Dict[str, Any] = Field(default_factory=dict)


# Database Models
class Document(BaseModel):
    """
    Represents a document in the database.

    Attributes:
        id: An optional, unique identifier for the document.
        title: The title of the document.
        source: The source of the document.
        content: The full content of the document.
        metadata: A dictionary of additional metadata.
        created_at: An optional timestamp for when the document was created.
        updated_at: An optional timestamp for when the document was last updated.
    """
    id: Optional[str] = None
    title: str
    source: str
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Chunk(BaseModel):
    """
    Represents a chunk of a document.

    Attributes:
        id: An optional, unique identifier for the chunk.
        document_id: The ID of the document to which the chunk belongs.
        content: The text content of the chunk.
        embedding: An optional vector embedding for the chunk.
        chunk_index: The index of the chunk within the document.
        metadata: A dictionary of additional metadata.
        token_count: An optional count of the tokens in the chunk.
        created_at: An optional timestamp for when the chunk was created.
    """
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
    """
    Represents a user session in the database.

    Attributes:
        id: An optional, unique identifier for the session.
        user_id: An optional ID for the user who owns the session.
        metadata: A dictionary of additional metadata for the session.
        created_at: An optional timestamp for when the session was created.
        updated_at: An optional timestamp for when the session was last updated.
        expires_at: An optional timestamp for when the session expires.
    """
    id: Optional[str] = None
    user_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class Message(BaseModel):
    """
    Represents a single message in a session's conversation history.

    Attributes:
        id: An optional, unique identifier for the message.
        session_id: The ID of the session to which the message belongs.
        role: The role of the message sender (e.g., 'user', 'assistant').
        content: The text content of the message.
        metadata: A dictionary of additional metadata for the message.
        created_at: An optional timestamp for when the message was created.
    """
    id: Optional[str] = None
    session_id: str
    role: MessageRole
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(use_enum_values=True)


# Agent Models
class AgentDependencies(BaseModel):
    """
    Represents the dependencies required by the agent for its execution.

    Attributes:
        session_id: The ID of the current session.
        database_url: An optional URL for the database connection.
        neo4j_uri: An optional URI for the Neo4j graph database.
        openai_api_key: An optional API key for the OpenAI service.
    """
    session_id: str
    database_url: Optional[str] = None
    neo4j_uri: Optional[str] = None
    openai_api_key: Optional[str] = None
    
    model_config = ConfigDict(arbitrary_types_allowed=True)




class AgentContext(BaseModel):
    """
    Represents the execution context for the agent.

    Attributes:
        session_id: The ID of the current session.
        messages: A list of messages in the current conversation.
        tool_calls: A list of tool calls made by the agent.
        search_results: A list of search results from vector or hybrid search.
        graph_results: A list of results from a graph search.
        metadata: A dictionary of additional metadata for the context.
    """
    session_id: str
    messages: List[Message] = Field(default_factory=list)
    tool_calls: List[ToolCall] = Field(default_factory=list)
    search_results: List[ChunkResult] = Field(default_factory=list)
    graph_results: List[GraphSearchResult] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)


# Ingestion Models
class IngestionConfig(BaseModel):
    """
    Represents the configuration for the document ingestion pipeline.

    Attributes:
        chunk_size: The target size for each document chunk.
        chunk_overlap: The number of tokens to overlap between consecutive chunks.
        max_chunk_size: The maximum size a chunk can be.
        use_semantic_splitting: A boolean indicating if semantic splitting should be used.
        extract_entities: A boolean indicating if entities should be extracted.
        skip_graph_building: A boolean to skip knowledge graph building for faster ingestion.
    """
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
    """
    Represents the result of a document ingestion operation.

    Attributes:
        document_id: The ID of the ingested document.
        title: The title of the ingested document.
        chunks_created: The number of chunks created from the document.
        entities_extracted: The number of entities extracted from the document.
        relationships_created: The number of relationships created in the graph.
        processing_time_ms: The time taken for ingestion in milliseconds.
        errors: A list of any errors that occurred during ingestion.
    """
    document_id: str
    title: str
    chunks_created: int
    entities_extracted: int
    relationships_created: int
    processing_time_ms: float
    errors: List[str] = Field(default_factory=list)


# Error Models
class ErrorResponse(BaseModel):
    """
    Represents a standardized error response.

    Attributes:
        error: A description of the error.
        error_type: The type of the error.
        details: An optional dictionary of additional error details.
        request_id: An optional ID for the request that caused the error.
    """
    error: str
    error_type: str
    details: Optional[Dict[str, Any]] = None
    request_id: Optional[str] = None


# Analytics Models
class ChatMetrics(BaseModel):
    """
    Represents aggregated metrics for chat activity.

    Attributes:
        total_messages: The total number of messages sent.
        total_sessions: The total number of chat sessions.
        unique_users: The number of unique users who have chatted.
        avg_messages_per_session: The average number of messages per session.
        total_tool_calls: The total number of tool calls made.
        avg_response_time_ms: The average response time in milliseconds.
    """
    total_messages: int
    total_sessions: int
    unique_users: int
    avg_messages_per_session: float
    total_tool_calls: int
    avg_response_time_ms: float


class DocumentUsageStats(BaseModel):
    """
    Represents statistics about document usage.

    Attributes:
        total_documents: The total number of documents in the system.
        documents_uploaded_today: The number of documents uploaded today.
        most_referenced_document_id: The ID of the most referenced document.
        most_referenced_document_title: The title of the most referenced document.
        avg_document_size: The average size of documents in bytes.
    """
    total_documents: int
    documents_uploaded_today: int
    most_referenced_document_id: Optional[str]
    most_referenced_document_title: Optional[str]
    avg_document_size: int


class RealTimeMetrics(BaseModel):
    """
    Represents real-time metrics for the system.

    Attributes:
        active_sessions: The number of currently active sessions.
        messages_last_hour: The number of messages sent in the last hour.
        new_users_last_hour: The number of new users in the last hour.
        total_documents: The total number of documents in the system.
        documents_today: The number of documents uploaded today.
        public_templates: The number of public prompt templates.
        total_collections: The total number of document collections.
    """
    active_sessions: int
    messages_last_hour: int
    new_users_last_hour: int
    total_documents: int
    documents_today: int
    public_templates: int
    total_collections: int


class PromptTemplate(BaseModel):
    """
    Represents a prompt template.

    Attributes:
        id: An optional, unique identifier for the template.
        name: The name of the template.
        description: An optional description for the template.
        template: The content of the template.
        category: The category of the template.
        tags: A list of tags for the template.
        version: The version number of the template.
        is_public: A boolean indicating if the template is public.
        created_by: An optional ID of the user who created the template.
        usage_count: The number of times the template has been used.
        rating_avg: The average rating of the template.
        rating_count: The number of ratings the template has received.
        metadata: A dictionary of additional metadata.
        created_at: An optional timestamp for when the template was created.
        updated_at: An optional timestamp for when the template was last updated.
    """
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
    """
    Represents a collection of documents.

    Attributes:
        id: An optional, unique identifier for the collection.
        name: The name of the collection.
        description: An optional description for the collection.
        color: A hex color string for the collection's icon.
        icon: The name of the icon for the collection.
        created_by: An optional ID of the user who created the collection.
        is_shared: A boolean indicating if the collection is shared.
        workspace_id: An optional ID of the workspace the collection belongs to.
        document_count: The number of documents in the collection.
        total_size: The total size of the documents in the collection, in bytes.
        last_accessed: An optional timestamp for when the collection was last accessed.
        metadata: A dictionary of additional metadata.
        created_at: An optional timestamp for when the collection was created.
        updated_at: An optional timestamp for when the collection was last updated.
    """
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
    """
    Represents a single step in an automation workflow.

    Attributes:
        type: The type of the workflow step (e.g., 'search', 'summarize').
        config: A dictionary of configuration options for the step.
        name: An optional name for the step.
        description: An optional description for the step.
    """
    type: str  # e.g., "search", "summarize", "tag", "notify"
    config: Dict[str, Any] = Field(default_factory=dict)
    name: Optional[str] = None
    description: Optional[str] = None


class Workflow(BaseModel):
    """
    Represents an automation workflow.

    Attributes:
        id: An optional, unique identifier for the workflow.
        name: The name of the workflow.
        description: An optional description for the workflow.
        trigger_type: The type of trigger that starts the workflow.
        trigger_config: A dictionary of configuration options for the trigger.
        steps: A list of steps that make up the workflow.
        is_active: A boolean indicating if the workflow is active.
        created_by: An optional ID of the user who created the workflow.
        execution_count: The number of times the workflow has been executed.
        last_executed: An optional timestamp for when the workflow was last executed.
        created_at: An optional timestamp for when the workflow was created.
        updated_at: An optional timestamp for when the workflow was last updated.
    """
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
    """
    Represents metrics for user engagement.

    Attributes:
        total_sessions: The total number of sessions.
        avg_messages_per_session: The average number of messages per session.
        total_messages: The total number of messages.
        total_tool_calls: The total number of tool calls made.
        total_searches: The total number of searches performed.
        avg_response_time: The average response time in milliseconds.
        high_satisfaction_count: The number of sessions with high satisfaction.
        low_satisfaction_count: The number of sessions with low satisfaction.
        avg_satisfaction_rating: The average satisfaction rating.
    """
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
    """
    Represents a request to create a new prompt template.

    Attributes:
        name: The name of the template.
        description: An optional description for the template.
        template: The content of the template.
        category: The category of the template.
        tags: A list of tags for the template.
        is_public: A boolean indicating if the template should be public.
    """
    name: str
    description: Optional[str] = None
    template: str
    category: str = "general"
    tags: List[str] = Field(default_factory=list)
    is_public: bool = False


class CreateCollectionRequest(BaseModel):
    """
    Represents a request to create a new collection.

    Attributes:
        name: The name of the collection.
        description: An optional description for the collection.
        color: A hex color string for the collection's icon.
        icon: The name of the icon for the collection.
        is_shared: A boolean indicating if the collection should be shared.
    """
    name: str
    description: Optional[str] = None
    color: str = "#6366f1"
    icon: str = "folder"
    is_shared: bool = False


class AddToCollectionRequest(BaseModel):
    """
    Represents a request to add documents to a collection.

    Attributes:
        document_ids: A list of IDs of the documents to be added.
    """
    document_ids: List[str]


class CreateWorkflowRequest(BaseModel):
    """
    Represents a request to create a new workflow.

    Attributes:
        name: The name of the workflow.
        description: An optional description for the workflow.
        trigger_type: The type of trigger for the workflow.
        trigger_config: A dictionary of configuration options for the trigger.
        steps: A list of steps that make up the workflow.
    """
    name: str
    description: Optional[str] = None
    trigger_type: Literal["document_upload", "schedule", "manual", "webhook"]
    trigger_config: Dict[str, Any] = Field(default_factory=dict)
    steps: List[WorkflowStep]


# Response Models for New Features
class AnalyticsDashboardResponse(BaseModel):
    """
    Represents the response for the analytics dashboard endpoint.

    Attributes:
        real_time_metrics: A `RealTimeMetrics` object.
        chat_metrics: A `ChatMetrics` object.
        document_stats: A `DocumentUsageStats` object.
        trending_searches: A list of trending searches.
        user_engagement: A `UserEngagementMetrics` object.
    """
    real_time_metrics: RealTimeMetrics
    chat_metrics: ChatMetrics
    document_stats: DocumentUsageStats
    trending_searches: List[Dict[str, Any]] = Field(default_factory=list)
    user_engagement: UserEngagementMetrics


class PromptTemplateListResponse(BaseModel):
    """
    Represents a paginated response for a list of prompt templates.

    Attributes:
        templates: A list of `PromptTemplate` objects.
        total: The total number of templates available.
        page: The current page number.
        per_page: The number of templates per page.
    """
    templates: List[PromptTemplate]
    total: int
    page: int
    per_page: int


class CollectionListResponse(BaseModel):
    """
    Represents a paginated response for a list of collections.

    Attributes:
        collections: A list of `Collection` objects.
        total: The total number of collections available.
    """
    collections: List[Collection]
    total: int


# Health Check Models
class HealthStatus(BaseModel):
    """
    Represents the health status of the application and its dependencies.

    Attributes:
        status: The overall health status.
        database: A boolean indicating if the database connection is healthy.
        graph_database: A boolean indicating if the graph database connection is healthy.
        llm_connection: A boolean indicating if the connection to the LLM is healthy.
        version: The version of the application.
        timestamp: The timestamp of the health check.
    """
    status: Literal["healthy", "degraded", "unhealthy"]
    database: bool
    graph_database: bool
    llm_connection: bool
    version: str
    timestamp: datetime