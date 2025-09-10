-- Add document summaries table for caching AI-generated summaries
-- This table stores comprehensive summaries to avoid regenerating them

CREATE TABLE IF NOT EXISTS document_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    summary_type TEXT NOT NULL CHECK (summary_type IN ('comprehensive', 'executive', 'financial', 'operational')),
    domain_classification JSONB NOT NULL DEFAULT '{}',
    summary_content JSONB NOT NULL,
    context_info JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one summary per document/type combination
    UNIQUE(document_id, summary_type)
);

-- Indexes for efficient querying
CREATE INDEX idx_document_summaries_document_id ON document_summaries (document_id);
CREATE INDEX idx_document_summaries_type ON document_summaries (summary_type);
CREATE INDEX idx_document_summaries_domain ON document_summaries USING GIN (domain_classification);
CREATE INDEX idx_document_summaries_created_at ON document_summaries (created_at DESC);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at when summary is modified
CREATE TRIGGER update_document_summaries_updated_at 
    BEFORE UPDATE ON document_summaries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for easy summary retrieval with document info
CREATE OR REPLACE VIEW document_summaries_with_info AS
SELECT 
    ds.id,
    ds.document_id,
    d.title as document_title,
    d.source as document_source,
    ds.summary_type,
    ds.domain_classification,
    ds.summary_content,
    ds.context_info,
    ds.metadata,
    ds.created_at,
    ds.updated_at,
    d.created_at as document_created_at,
    d.updated_at as document_updated_at
FROM document_summaries ds
JOIN documents d ON ds.document_id = d.id;