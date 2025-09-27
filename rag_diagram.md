# RAG Retrieval & Summarization Flow

## Retrieval Pipeline (EnhancedRetriever)
```mermaid
flowchart LR
    Q[User query] --> PROC[QueryProcessor\n(agent/query_processor.py)]
    PROC -->|intent, entities, keywords| GRAPH_DEC{Graph search enabled?}
    PROC -->|vector query| VECTOR_DEC{Vector search enabled?}
    GRAPH_DEC -->|yes| GRAPH_SEARCH[graph_search_tool\n+ entity fact lookup]
    GRAPH_DEC -->|no| GRAPH_SKIP[Skip graph search]
    VECTOR_DEC -->|yes| VECTOR_BASE[vector_search_tool\n(base query)]
    VECTOR_DEC -->|yes| VECTOR_EXP[Query expansion\n(vector_search_tool)]
    VECTOR_DEC -->|no| VECTOR_SKIP[Skip vector search]
    GRAPH_SEARCH --> FUSE[Result fusion\n(intent/entity boosts)]
    GRAPH_SKIP --> FUSE
    VECTOR_BASE --> FUSE
    VECTOR_EXP --> FUSE
    VECTOR_SKIP --> FUSE
    FUSE --> MMR[Diversify & de-dupe\n(MMR-style selection)]
    MMR --> OUTPUT[Final retrieval set\n+ retrieval telemetry]
```

- Query understanding normalizes the text and infers intent, entities, keywords, and tailored graph/vector queries before any retrieval happens (`EnhancedRetriever._process_query`).
- Graph search hits the knowledge graph for facts plus targeted entity lookups, annotating results with provenance and relevance boosts (`GraphSearchInput`, `graph_search_tool`).
- Vector search runs the base similarity query, optional expanded queries, and tracks source scores for chunk-level evidence (`VectorSearchInput`, `vector_search_tool`).
- Fusion multiplies source-specific weights, intent boosts, and entity matches to rerank a single list before an MMR-style step enforces diversity and truncates to the requested result budget.
- Each major step emits retrieval events so the UI can render live progress and exposes timings via `RetrievalContext`.

## Summarization Pipeline (DBRSummarizer)
```mermaid
flowchart TD
    START[Summarization request\n(document_id, type)] --> CACHE{Cached summary?}
    CACHE -->|yes| RETURN_CACHED[Return cached summary\n(get_cached_summary)]
    CACHE -->|no| LOAD_DOC[Load document metadata\n+ chunks]
    LOAD_DOC --> CLASSIFY[Document domain classification\n(document_classifier)]
    LOAD_DOC --> CONTEXT_DEC{Include RAG context?}
    CONTEXT_DEC -->|auto-disable or user no| SKIP_CONTEXT[(Empty context package)]
    CONTEXT_DEC -->|yes| GEN_QUERIES[Generate/accept context queries]
    GEN_QUERIES --> HYBRID[Hybrid search for related chunks\n(hybrid_search_tool)]
    HYBRID --> BUILD_CONTEXT[Assemble related docs + chunks]
    SKIP_CONTEXT --> BUILD_CONTEXT
    CLASSIFY --> BATCHING[Batch chunks within token budget]
    BUILD_CONTEXT --> BATCHING
    BATCHING --> BATCH_SUMMS[LLM batch summaries\n(_summarize_batch via rag_agent)]
    BATCH_SUMMS --> MERGE[Hierarchical merge\n(_hierarchical_summarize)]
    MERGE --> FINAL_SUMM[_generate_final_summary]
    FINAL_SUMM --> VERIFY[Claim verification\n(hybrid search + LLM)]
    VERIFY --> STORE[store_summary + metadata]
    STORE --> RETURN_FINAL[Return structured summary\n+ domain insights]
```

- The summarizer immediately returns cached results when possible; otherwise it loads the document and all associated chunks from storage.
- Domain classification samples representative chunks to pick expert prompts and guide later summarization and confidence reporting.
- Optional RAG context generation issues focused hybrid searches using generated queries, adds related documents and chunks, and respects auto-disabling rules for very large documents.
- Hierarchical summarization batches chunks to stay within token limits, runs domain-aware LLM prompts for each batch, then fuses the intermediate outputs into a single JSON summary.
- A verification pass re-queries the source document, checks numeric consistency, and records verdicts per claim before caching and returning the enriched summary payload.
