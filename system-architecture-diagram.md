# DataDiver RAG System Architecture

This document explains how the RAG chat and summary functions work in the DataDiver application.

## Overview

The DataDiver system is a comprehensive RAG (Retrieval-Augmented Generation) platform built with Next.js frontend and FastAPI backend, featuring intelligent document analysis, chat interface, and automated summarization capabilities.

## High-Level Architecture

```mermaid
graph TB
    subgraph "Frontend (Next.js 15)"
        UI[Chat Interface]
        DOC[Documents Page]
        SEARCH[Search Page]
        UI --> DOC
        UI --> SEARCH
    end

    subgraph "Backend (FastAPI)"
        API[API Endpoints]
        AGENT[RAG Agent]
        RETRIEVER[Enhanced Retriever]
        SUMMARIZER[DBR Summarizer]

        API --> AGENT
        API --> SUMMARIZER
        AGENT --> RETRIEVER
    end

    subgraph "Data Layer"
        VDB[(Vector Database)]
        GDB[(Graph Database)]
        CACHE[(Cache Storage)]
        DOCS[(Document Storage)]

        RETRIEVER --> VDB
        RETRIEVER --> GDB
        SUMMARIZER --> CACHE
        API --> DOCS
    end

    subgraph "AI Models"
        LLM[Gemini 2.5 Flash]
        EMBED[Embedding Model]

        AGENT --> LLM
        RETRIEVER --> EMBED
        SUMMARIZER --> LLM
    end

    UI --> API
    DOC --> API
    SEARCH --> API
```

## RAG Chat System Flow

### 1. User Interaction Flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Chat Interface
    participant A as API Server
    participant R as Enhanced Retriever
    participant AG as RAG Agent
    participant V as Vector DB
    participant G as Graph DB
    participant L as LLM Model

    U->>C: Types question
    C->>A: POST /chat/stream
    A->>R: Initialize retrieval

    par Parallel Search
        R->>V: Vector search
        R->>G: Graph search
    end

    R->>R: Combine & rank results
    R->>AG: Provide context
    AG->>L: Generate response
    L-->>A: Stream response
    A-->>C: Server-sent events
    C-->>U: Real-time response

    Note over R,A: Emit retrieval events
    A-->>C: Retrieval timeline
```

### 2. Search Modes & Components

#### Enhanced Retrieval System (`agent/enhanced_retrieval.py`)

```mermaid
flowchart TD
    START[User Query] --> MODE{Search Mode}

    MODE -->|Vector| VEC[Vector Search Tool]
    MODE -->|Graph| GRAPH[Graph Search Tool]
    MODE -->|Hybrid| HYB[Hybrid Search Tool]

    VEC --> EMBED[Embedding Generation]
    EMBED --> VSEARCH[Semantic Vector Search]

    GRAPH --> ENTITIES[Entity Extraction]
    ENTITIES --> GSEARCH[Knowledge Graph Search]

    HYB --> COMBINE[Combine Vector + Graph]

    VSEARCH --> RANK[Result Ranking]
    GSEARCH --> RANK
    COMBINE --> RANK

    RANK --> CONTEXT[Context Assembly]
    CONTEXT --> AGENT[RAG Agent]
    AGENT --> RESPONSE[Generated Response]

    subgraph "Real-time Events"
        EVENTS[Retrieval Timeline]
        RANK --> EVENTS
        CONTEXT --> EVENTS
    end
```

### 3. Chat Interface Features

#### Core Components (`app/dashboard/chat/page.tsx`)

- **Streaming Response**: Real-time text generation with WebSocket support
- **Source Citations**: Automatic source linking with relevance scores
- **Confidence Metrics**: Multi-dimensional confidence scoring (accuracy, reliability, completeness)
- **Context Filtering**: Collection and document-based filtering
- **Suggested Questions**: Dynamic question generation based on document content
- **Retrieval Timeline**: Real-time visualization of search and retrieval steps

#### Message Flow Architecture

```mermaid
graph LR
    subgraph "Message Processing"
        INPUT[User Input] --> VALIDATE[Input Validation]
        VALIDATE --> SESSION[Session Management]
        SESSION --> STREAM[Streaming Setup]
    end

    subgraph "Response Generation"
        STREAM --> RETRIEVE[Document Retrieval]
        RETRIEVE --> CONTEXT[Context Assembly]
        CONTEXT --> GENERATE[LLM Generation]
        GENERATE --> METRICS[Confidence Calculation]
    end

    subgraph "Real-time Updates"
        METRICS --> DELTA[Response Deltas]
        RETRIEVE --> EVENTS[Retrieval Events]
        DELTA --> UI[Chat Interface]
        EVENTS --> UI
    end
```

## Summary System Architecture

### 1. DBR Summarizer Overview (`agent/summarizer.py`)

The summarization system provides intelligent, hierarchical document analysis with domain expertise and RAG context integration.

```mermaid
flowchart TD
    START[Document ID] --> CACHE{Check Cache}
    CACHE -->|Hit| RETURN[Return Cached Summary]
    CACHE -->|Miss| FETCH[Fetch Document & Chunks]

    FETCH --> CLASSIFY[Domain Classification]
    CLASSIFY --> CONTEXT[RAG Context Retrieval]

    CONTEXT --> BATCH[Hierarchical Batching]
    BATCH --> PARALLEL[Parallel Batch Processing]

    subgraph "Batch Processing"
        PARALLEL --> B1[Batch 1 Summary]
        PARALLEL --> B2[Batch 2 Summary]
        PARALLEL --> B3[Batch N Summary]

        B1 --> DOMAIN1[Domain Expert Analysis]
        B2 --> DOMAIN2[Domain Expert Analysis]
        B3 --> DOMAIN3[Domain Expert Analysis]
    end

    DOMAIN1 --> COMBINE[Combine Summaries]
    DOMAIN2 --> COMBINE
    DOMAIN3 --> COMBINE

    COMBINE --> FINAL[Final Summary Generation]
    FINAL --> VERIFY[Verification & Confidence]
    VERIFY --> STORE[Store in Cache]
    STORE --> RETURN
```

### 2. Hierarchical Processing

#### Batch Processing Strategy

```mermaid
graph TD
    DOC[Large Document] --> ANALYZE[Analyze Chunk Sizes]
    ANALYZE --> CALC[Calculate Batch Size]
    CALC --> SPLIT[Split into Batches]

    subgraph "Token Management"
        TOKENS[32K Token Limit]
        RESERVE[2K Reserved for Prompts]
        AVAILABLE[30K Available Tokens]

        CALC --> TOKENS
        TOKENS --> RESERVE
        RESERVE --> AVAILABLE
    end

    SPLIT --> BATCH1[Batch 1: Chunks 1-10]
    SPLIT --> BATCH2[Batch 2: Chunks 11-20]
    SPLIT --> BATCHN[Batch N: Chunks N+]

    BATCH1 --> EXPERT1[Domain Expert Prompt]
    BATCH2 --> EXPERT2[Domain Expert Prompt]
    BATCHN --> EXPERTN[Domain Expert Prompt]

    EXPERT1 --> JSON1[JSON Summary]
    EXPERT2 --> JSON2[JSON Summary]
    EXPERTN --> JSONN[JSON Summary]
```

### 3. Domain Classification & Expert Analysis

#### Document Classifier (`agent/document_classifier.py`)

```mermaid
flowchart LR
    INPUT[Document Samples] --> EXTRACT[Content Extraction]
    EXTRACT --> ANALYZE[Domain Analysis]

    subgraph "Domain Types"
        ANALYZE --> FINANCE[Financial Reports]
        ANALYZE --> ENVIRON[Environmental Studies]
        ANALYZE --> TECH[Technical Documentation]
        ANALYZE --> LEGAL[Legal Documents]
        ANALYZE --> GENERAL[General Content]
    end

    FINANCE --> EXPERT_F[Financial Expert Prompts]
    ENVIRON --> EXPERT_E[Environmental Expert Prompts]
    TECH --> EXPERT_T[Technical Expert Prompts]
    LEGAL --> EXPERT_L[Legal Expert Prompts]
    GENERAL --> EXPERT_G[General Analysis Prompts]

    subgraph "Expert Analysis Features"
        EXPERT_F --> METRICS_F[Financial KPIs]
        EXPERT_E --> METRICS_E[Environmental Indicators]
        EXPERT_T --> METRICS_T[Technical Specifications]
        EXPERT_L --> METRICS_L[Compliance Metrics]
    end
```

### 4. Summary Output Structure

#### Structured JSON Response

```json
{
  "document_id": "uuid",
  "document_title": "Document Name",
  "summary_type": "comprehensive|executive|financial|operational",
  "generated_at": "2024-timestamp",
  "summary": {
    "executive_overview": "High-level summary (≤180 words)",
    "key_metrics": {
      "revenue": "numeric_value",
      "growth_rate": "percentage",
      "custom_kpis": "domain_specific_metrics"
    },
    "major_highlights": [
      "Key finding 1",
      "Key finding 2",
      "Key finding N"
    ],
    "challenges_and_risks": [
      "Risk factor 1",
      "Challenge 2"
    ],
    "opportunities_and_recommendations": [
      "Recommendation 1",
      "Opportunity 2"
    ],
    "conclusion": "Overall outlook"
  },
  "domain_classification": {
    "domain": "financial|environmental|technical|legal|general",
    "confidence": 0.95,
    "reasoning": "Classification rationale",
    "keywords": ["relevant", "domain", "keywords"]
  },
  "metadata": {
    "total_chunks": 150,
    "processing_time": 45.2,
    "verification": {
      "overall_confidence": 0.92,
      "support_ratio": 0.88,
      "numeric_match_ratio": 0.94,
      "extraction_quality": 0.89
    }
  }
}
```

### 5. Verification & Confidence System

```mermaid
graph TD
    SUMMARY[Generated Summary] --> EXTRACT[Extract Claims]
    EXTRACT --> SEARCH[Search Source Evidence]
    SEARCH --> VERIFY[LLM Verification]

    subgraph "Verification Types"
        VERIFY --> FACTUAL[Factual Accuracy Check]
        VERIFY --> NUMERIC[Numeric Validation]
        VERIFY --> SOURCE[Source Reliability]
    end

    FACTUAL --> SUPPORT[Support Ratio]
    NUMERIC --> MATCH[Numeric Match Ratio]
    SOURCE --> QUALITY[Extraction Quality]

    SUPPORT --> AGGREGATE[Aggregate Confidence]
    MATCH --> AGGREGATE
    QUALITY --> AGGREGATE

    AGGREGATE --> CALIBRATE[Confidence Calibration]
    CALIBRATE --> FINAL[Final Confidence Score]
```

## Integration Points

### 1. Database Layer

#### Vector Database Operations
- **Document Indexing**: Automatic embedding generation for uploaded documents
- **Chunk Storage**: Hierarchical chunk storage with metadata
- **Similarity Search**: Semantic search using embeddings
- **Collection Management**: Organized document grouping

#### Graph Database Integration
- **Entity Extraction**: Named entity recognition and relationship mapping
- **Knowledge Graph**: Connected information representation
- **Graph Queries**: Relationship-based information retrieval

### 2. Real-time Features

#### WebSocket Communication
- **Streaming Responses**: Real-time text generation
- **Retrieval Events**: Live search and processing updates
- **Progress Tracking**: Job status and completion tracking

#### Caching Strategy
- **Summary Cache**: Persistent storage of generated summaries
- **Context Cache**: Temporary storage of retrieval results
- **Session Management**: User session state preservation

### 3. API Endpoints

#### Core RAG Endpoints (`agent/api.py`, `agent/api_enhanced.py`)

```
POST /chat/stream          # Streaming chat interface
GET  /documents            # Document listing and management
POST /documents/upload     # Document upload and processing
GET  /collections          # Collection management
POST /summarize            # Document summarization
GET  /summary/job/{id}     # Summary job status
GET  /health               # System health check
```

## Performance Optimizations

### 1. Concurrency & Parallelization
- **Parallel Batch Processing**: Multiple document sections processed simultaneously
- **Async Operations**: Non-blocking I/O for database and API calls
- **Semaphore Limiting**: Controlled concurrency to prevent resource exhaustion

### 2. Token Management
- **Dynamic Batching**: Intelligent chunk grouping based on content size
- **Context Window Optimization**: Efficient use of model context limits
- **Response Streaming**: Real-time response generation

### 3. Caching & Storage
- **Multi-level Caching**: Summary cache, context cache, session cache
- **Incremental Updates**: Progressive result building
- **Efficient Retrieval**: Optimized database queries and indexing

This architecture enables sophisticated document understanding, intelligent question answering, and comprehensive summarization with real-time feedback and high accuracy through verification systems.