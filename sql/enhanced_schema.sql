-- Enhanced schema for Enterprise RAG Platform with Analytics
-- This extends the base schema with real-time analytics, collaboration, and enterprise features

-- User activity and analytics tables
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    session_token TEXT UNIQUE,
    workspace_id UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS chat_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    user_id TEXT,
    message_count INTEGER DEFAULT 0,
    tool_calls_count INTEGER DEFAULT 0,
    search_queries_count INTEGER DEFAULT 0,
    documents_referenced INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    total_messages INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    avg_session_duration INTEGER,
    total_documents_uploaded INTEGER DEFAULT 0,
    total_searches INTEGER DEFAULT 0,
    total_tool_calls INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date)
);

-- Prompt Templates System
CREATE TABLE IF NOT EXISTS prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    template TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    version INTEGER DEFAULT 1,
    is_public BOOLEAN DEFAULT false,
    created_by TEXT,
    usage_count INTEGER DEFAULT 0,
    rating_avg FLOAT DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prompt_template_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    template TEXT NOT NULL,
    changelog TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(template_id, version)
);

CREATE TABLE IF NOT EXISTS prompt_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    user_id TEXT,
    variables JSONB DEFAULT '{}',
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Content Collections System
CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#6366f1',
    icon TEXT DEFAULT 'folder',
    created_by TEXT,
    is_shared BOOLEAN DEFAULT false,
    workspace_id UUID,
    document_count INTEGER DEFAULT 0,
    total_size INTEGER DEFAULT 0,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collection_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    added_by TEXT,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(collection_id, document_id)
);

CREATE TABLE IF NOT EXISTS collection_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    shared_with TEXT NOT NULL,
    permission TEXT NOT NULL CHECK (permission IN ('read', 'write', 'admin')),
    shared_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(collection_id, shared_with)
);

-- Smart Tagging and Categorization
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#6366f1',
    category TEXT DEFAULT 'general',
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    confidence FLOAT DEFAULT 1.0,
    auto_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, tag_id)
);

-- Real-time Collaboration
CREATE TABLE IF NOT EXISTS active_collaborations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    cursor_position INTEGER,
    selection_start INTEGER,
    selection_end INTEGER,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS document_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    position_start INTEGER,
    position_end INTEGER,
    parent_id UUID REFERENCES document_comments(id) ON DELETE CASCADE,
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Workflow and Automation
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('document_upload', 'schedule', 'manual', 'webhook')),
    trigger_config JSONB DEFAULT '{}',
    steps JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by TEXT,
    execution_count INTEGER DEFAULT 0,
    last_executed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    error_message TEXT,
    execution_time_ms INTEGER,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Search Analytics and Insights
CREATE TABLE IF NOT EXISTS search_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    user_id TEXT,
    query TEXT NOT NULL,
    search_type TEXT NOT NULL CHECK (search_type IN ('vector', 'hybrid', 'graph', 'full_text')),
    results_count INTEGER DEFAULT 0,
    clicked_results INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    response_time_ms INTEGER,
    relevance_scores FLOAT[] DEFAULT ARRAY[]::FLOAT[],
    user_satisfied BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Document Processing Pipeline
CREATE TABLE IF NOT EXISTS processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL CHECK (job_type IN ('ingestion', 'reindexing', 'summarization', 'tagging', 'extraction')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    progress FLOAT DEFAULT 0,
    config JSONB DEFAULT '{}',
    result JSONB DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced Indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active ON user_sessions (last_active);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_session_id ON chat_analytics (session_id);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_user_id ON chat_analytics (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_created_at ON chat_analytics (created_at);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics (date);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates (category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_tags ON prompt_templates USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_public ON prompt_templates (is_public, rating_avg);
CREATE INDEX IF NOT EXISTS idx_prompt_usage_logs_template_id ON prompt_usage_logs (template_id, created_at);
CREATE INDEX IF NOT EXISTS idx_collections_created_by ON collections (created_by);
CREATE INDEX IF NOT EXISTS idx_collections_workspace_id ON collections (workspace_id);
CREATE INDEX IF NOT EXISTS idx_collection_documents_collection_id ON collection_documents (collection_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_document_id ON document_tags (document_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag_id ON document_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_active_collaborations_document_id ON active_collaborations (document_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_document_id ON document_comments (document_id);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger_type ON workflows (trigger_type, is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions (workflow_id, started_at);
CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics USING GIN (to_tsvector('english', query));
CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at ON search_analytics (created_at);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_document_id ON processing_jobs (document_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs (status, job_type);

-- Proposals and Versions (Proposal Generator)
CREATE TABLE IF NOT EXISTS proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    client_fields JSONB DEFAULT '{}',
    project_fields JSONB DEFAULT '{}',
    status TEXT DEFAULT 'draft',
    metadata JSONB DEFAULT '{}',
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS proposal_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    html TEXT,
    sections JSONB DEFAULT '[]',
    citations JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proposal_versions_proposal_id ON proposal_versions (proposal_id);

-- Analytics Functions
CREATE OR REPLACE FUNCTION get_chat_activity_metrics(
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '7 days',
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    total_messages INTEGER,
    total_sessions INTEGER,
    unique_users INTEGER,
    avg_messages_per_session FLOAT,
    total_tool_calls INTEGER,
    avg_response_time_ms FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(ca.message_count), 0)::INTEGER as total_messages,
        COUNT(DISTINCT ca.session_id)::INTEGER as total_sessions,
        COUNT(DISTINCT ca.user_id)::INTEGER as unique_users,
        CASE 
            WHEN COUNT(DISTINCT ca.session_id) > 0 
            THEN COALESCE(SUM(ca.message_count), 0)::FLOAT / COUNT(DISTINCT ca.session_id)::FLOAT
            ELSE 0
        END as avg_messages_per_session,
        COALESCE(SUM(ca.tool_calls_count), 0)::INTEGER as total_tool_calls,
        COALESCE(AVG(ca.response_time_ms), 0) as avg_response_time_ms
    FROM chat_analytics ca
    WHERE ca.created_at >= start_date AND ca.created_at <= end_date;
END;
$$;

CREATE OR REPLACE FUNCTION get_document_usage_stats()
RETURNS TABLE (
    total_documents INTEGER,
    documents_uploaded_today INTEGER,
    most_referenced_document_id UUID,
    most_referenced_document_title TEXT,
    avg_document_size INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH document_refs AS (
        SELECT 
            ca.documents_referenced,
            ROW_NUMBER() OVER (ORDER BY ca.documents_referenced DESC) as rn
        FROM chat_analytics ca
        WHERE ca.documents_referenced > 0
    ),
    most_referenced AS (
        SELECT d.id, d.title
        FROM documents d
        LIMIT 1 -- This is simplified - would need proper reference tracking
    )
    SELECT
        (SELECT COUNT(*)::INTEGER FROM documents) as total_documents,
        (SELECT COUNT(*)::INTEGER FROM documents WHERE created_at >= CURRENT_DATE) as documents_uploaded_today,
        mr.id as most_referenced_document_id,
        mr.title as most_referenced_document_title,
        (SELECT AVG(LENGTH(content))::INTEGER FROM documents) as avg_document_size
    FROM most_referenced mr;
END;
$$;

-- Real-time Analytics View
CREATE OR REPLACE VIEW real_time_metrics AS
WITH recent_activity AS (
    SELECT
        COUNT(DISTINCT s.id) as active_sessions,
        COUNT(DISTINCT m.id) as messages_last_hour,
        COUNT(DISTINCT CASE WHEN s.created_at >= NOW() - INTERVAL '1 hour' THEN s.user_id END) as new_users_last_hour
    FROM sessions s
    LEFT JOIN messages m ON s.id = m.session_id AND m.created_at >= NOW() - INTERVAL '1 hour'
    WHERE s.expires_at > NOW()
),
document_stats AS (
    SELECT
        COUNT(*) as total_documents,
        COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END) as documents_today
    FROM documents
)
SELECT
    ra.active_sessions,
    ra.messages_last_hour,
    ra.new_users_last_hour,
    ds.total_documents,
    ds.documents_today,
    (SELECT COUNT(*) FROM prompt_templates WHERE is_public = true) as public_templates,
    (SELECT COUNT(*) FROM collections) as total_collections
FROM recent_activity ra, document_stats ds;

-- Update triggers for the new tables
CREATE TRIGGER update_prompt_templates_updated_at BEFORE UPDATE ON prompt_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_comments_updated_at BEFORE UPDATE ON document_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for new tables
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_collaborations ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;