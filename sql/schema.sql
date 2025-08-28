-- Supabase-compatible schema for Agentic RAG with Knowledge Graph
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop existing tables and indexes
DROP TABLE IF EXISTS facts CASCADE;
DROP TABLE IF EXISTS edges CASCADE;
DROP TABLE IF EXISTS nodes CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS chunks CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP INDEX IF EXISTS idx_chunks_embedding;
DROP INDEX IF EXISTS idx_chunks_document_id;
DROP INDEX IF EXISTS idx_documents_metadata;
DROP INDEX IF EXISTS idx_chunks_content_trgm;
DROP INDEX IF EXISTS idx_nodes_name;
DROP INDEX IF EXISTS idx_nodes_type;
DROP INDEX IF EXISTS idx_edges_source_target;
DROP INDEX IF EXISTS idx_facts_node;
DROP INDEX IF EXISTS idx_facts_valid_at;
DROP INDEX IF EXISTS idx_facts_content;

-- Documents table for storing source documents
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_documents_metadata ON documents USING GIN (metadata);
CREATE INDEX idx_documents_created_at ON documents (created_at DESC);

-- Chunks table for vector search
CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(768),
    chunk_index INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}',
    token_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 1);
CREATE INDEX idx_chunks_document_id ON chunks (document_id);
CREATE INDEX idx_chunks_chunk_index ON chunks (document_id, chunk_index);
CREATE INDEX idx_chunks_content_trgm ON chunks USING GIN (content gin_trgm_ops);

-- Knowledge Graph Tables

-- Nodes table for entities in the knowledge graph
CREATE TABLE nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('person', 'company', 'technology', 'event', 'location', 'other')),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, type)
);

CREATE INDEX idx_nodes_name ON nodes (name);
CREATE INDEX idx_nodes_type ON nodes (type);

-- Edges table for relationships between nodes
CREATE TABLE edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_node_id, target_node_id, relationship_type)
);

CREATE INDEX idx_edges_source_target ON edges (source_node_id, target_node_id);

-- Facts table for temporal knowledge with validity periods
CREATE TABLE facts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    source TEXT,
    valid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    invalid_at TIMESTAMP WITH TIME ZONE,
    confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (invalid_at IS NULL OR invalid_at > valid_at)
);

CREATE INDEX idx_facts_node ON facts (node_id);
CREATE INDEX idx_facts_valid_at ON facts (valid_at);
CREATE INDEX idx_facts_content ON facts USING GIN (to_tsvector('english', content));

-- Sessions table for conversation management
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);

-- Messages table for conversation history
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_session_id ON messages (session_id, created_at);

-- Vector Search Functions

CREATE OR REPLACE FUNCTION match_chunks(
    query_embedding vector(768),
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    similarity FLOAT,
    metadata JSONB,
    document_title TEXT,
    document_source TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id AS chunk_id,
        c.document_id,
        c.content,
        1 - (c.embedding <=> query_embedding) AS similarity,
        c.metadata,
        d.title AS document_title,
        d.source AS document_source
    FROM chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE c.embedding IS NOT NULL
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION hybrid_search(
    query_embedding vector(768),
    query_text TEXT,
    match_count INT DEFAULT 10,
    text_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    content TEXT,
    combined_score FLOAT,
    vector_similarity FLOAT,
    text_similarity FLOAT,
    metadata JSONB,
    document_title TEXT,
    document_source TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH vector_results AS (
        SELECT
            c.id AS chunk_id,
            c.document_id,
            c.content,
            1 - (c.embedding <=> query_embedding) AS vector_sim,
            c.metadata,
            d.title AS doc_title,
            d.source AS doc_source
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE c.embedding IS NOT NULL
    ),
    text_results AS (
        SELECT
            c.id AS chunk_id,
            c.document_id,
            c.content,
            ts_rank_cd(to_tsvector('english', c.content), plainto_tsquery('english', query_text)) AS text_sim,
            c.metadata,
            d.title AS doc_title,
            d.source AS doc_source
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', query_text)
    )
    SELECT
        COALESCE(v.chunk_id, t.chunk_id) AS chunk_id,
        COALESCE(v.document_id, t.document_id) AS document_id,
        COALESCE(v.content, t.content) AS content,
        (COALESCE(v.vector_sim, 0) * (1 - text_weight) + COALESCE(t.text_sim, 0) * text_weight) AS combined_score,
        COALESCE(v.vector_sim, 0) AS vector_similarity,
        COALESCE(t.text_sim, 0) AS text_similarity,
        COALESCE(v.metadata, t.metadata) AS metadata,
        COALESCE(v.doc_title, t.doc_title) AS document_title,
        COALESCE(v.doc_source, t.doc_source) AS document_source
    FROM vector_results v
    FULL OUTER JOIN text_results t ON v.chunk_id = t.chunk_id
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION get_document_chunks(doc_id UUID)
RETURNS TABLE (
    chunk_id UUID,
    content TEXT,
    chunk_index INTEGER,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        id AS chunk_id,
        chunks.content,
        chunks.chunk_index,
        chunks.metadata
    FROM chunks
    WHERE document_id = doc_id
    ORDER BY chunk_index;
END;
$$;

-- Knowledge Graph Functions

CREATE OR REPLACE FUNCTION search_facts(
    query_text TEXT,
    limit_count INT DEFAULT 20
)
RETURNS TABLE (
    fact_id UUID,
    node_id UUID,
    node_name TEXT,
    node_type TEXT,
    content TEXT,
    source TEXT,
    valid_at TIMESTAMP WITH TIME ZONE,
    invalid_at TIMESTAMP WITH TIME ZONE,
    confidence FLOAT,
    rank FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
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
        ts_rank_cd(to_tsvector('english', f.content), plainto_tsquery('english', query_text)) AS rank
    FROM facts f
    JOIN nodes n ON f.node_id = n.id
    WHERE
        to_tsvector('english', f.content) @@ plainto_tsquery('english', query_text)
        AND (f.invalid_at IS NULL OR f.invalid_at > CURRENT_TIMESTAMP)
    ORDER BY rank DESC
    LIMIT limit_count;
END;
$$;

CREATE OR REPLACE FUNCTION get_entity_relationships(
    entity_name TEXT,
    max_depth INT DEFAULT 2
)
RETURNS TABLE (
    source_name TEXT,
    source_type TEXT,
    relationship_type TEXT,
    target_name TEXT,
    target_type TEXT,
    relationship_description TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE relationship_path AS (
        -- Find direct relationships
        SELECT
            n1.name AS source_name,
            n1.type AS source_type,
            e.relationship_type,
            n2.name AS target_name,
            n2.type AS target_type,
            e.description AS relationship_description,
            1 AS depth,
            ARRAY[n1.id, n2.id] AS visited_nodes
        FROM nodes n1
        JOIN edges e ON n1.id = e.source_node_id
        JOIN nodes n2 ON e.target_node_id = n2.id
        WHERE n1.name ILIKE entity_name

        UNION ALL

        -- Find indirect relationships
        SELECT
            n1.name,
            n1.type,
            e.relationship_type,
            n2.name,
            n2.type,
            e.description,
            rp.depth + 1,
            rp.visited_nodes || n2.id
        FROM relationship_path rp
        JOIN edges e ON rp.visited_nodes[array_length(rp.visited_nodes, 1)] = e.source_node_id
        JOIN nodes n1 ON e.source_node_id = n1.id
        JOIN nodes n2 ON e.target_node_id = n2.id
        WHERE
            rp.depth < max_depth
            AND NOT (n2.id = ANY(rp.visited_nodes))
    )
    SELECT DISTINCT
        rp.source_name,
        rp.source_type,
        rp.relationship_type,
        rp.target_name,
        rp.target_type,
        rp.relationship_description
    FROM relationship_path rp
    ORDER BY rp.depth, rp.source_name, rp.target_name;
END;
$$;

CREATE OR REPLACE FUNCTION get_entity_timeline(
    entity_name TEXT,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
    fact_id UUID,
    content TEXT,
    source TEXT,
    valid_at TIMESTAMP WITH TIME ZONE,
    invalid_at TIMESTAMP WITH TIME ZONE,
    confidence FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.id AS fact_id,
        f.content,
        f.source,
        f.valid_at,
        f.invalid_at,
        f.confidence
    FROM facts f
    JOIN nodes n ON f.node_id = n.id
    WHERE
        n.name ILIKE entity_name
        AND (start_date IS NULL OR f.valid_at >= start_date)
        AND (end_date IS NULL OR f.valid_at <= end_date)
        AND (f.invalid_at IS NULL OR f.invalid_at > CURRENT_TIMESTAMP)
    ORDER BY f.valid_at DESC;
END;
$$;

-- Utility Functions

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-updating timestamps
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_nodes_updated_at BEFORE UPDATE ON nodes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Useful Views

CREATE OR REPLACE VIEW document_summaries AS
SELECT
    d.id,
    d.title,
    d.source,
    d.created_at,
    d.updated_at,
    d.metadata,
    COUNT(c.id) AS chunk_count,
    AVG(c.token_count) AS avg_tokens_per_chunk,
    SUM(c.token_count) AS total_tokens
FROM documents d
LEFT JOIN chunks c ON d.id = c.document_id
GROUP BY d.id, d.title, d.source, d.created_at, d.updated_at, d.metadata;

CREATE OR REPLACE VIEW knowledge_graph_stats AS
WITH node_counts AS (
    SELECT
        n.type,
        COUNT(*) as type_count
    FROM nodes n
    GROUP BY n.type
)
SELECT
    (SELECT COUNT(*) FROM nodes) AS total_nodes,
    (SELECT COUNT(*) FROM edges) AS total_edges,
    (SELECT COUNT(*) FROM facts) AS total_facts,
    (SELECT COUNT(DISTINCT n.type) FROM nodes n) AS node_types,
    json_object_agg(nc.type, nc.type_count) AS nodes_by_type
FROM node_counts nc;

-- Row Level Security (RLS) - Enable for Supabase
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;