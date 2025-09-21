# DataDiver AI Backend

This directory contains the Python-based AI backend that powers DataDiver's document intelligence, RAG capabilities, and advanced summarization features.

## 🧠 Overview

The AI backend is built with FastAPI and integrates multiple AI technologies to provide:

- **Document Processing** - Advanced PDF parsing, text extraction, and chunking
- **Intelligent Summarization** - Domain-specific expert analysis with 1M context optimization
- **Interactive RAG Chat** - Real-time conversational AI with source citations
- **Hybrid Search** - Vector similarity + knowledge graph exploration
- **Domain Classification** - Automatic document categorization and expert analysis
- **Real-time Streaming** - WebSocket support for live response generation

## 🏗️ Architecture

### Core Components

```
agent/
├── 🚀 API Layer
│   ├── api.py                 # Main FastAPI application
│   ├── api_enhanced.py        # Enterprise features & WebSockets
│   └── models.py              # Pydantic data models
│
├── 🤖 AI Processing
│   ├── agent.py               # Core RAG agent using PydanticAI
│   ├── summarizer.py          # Document summarization engine
│   ├── document_classifier.py # Domain classification system
│   └── providers.py           # LLM provider abstraction
│
├── 🔍 Search & Retrieval
│   ├── enhanced_retrieval.py  # Hybrid search orchestrator
│   ├── query_processor.py     # Query understanding & intent
│   ├── tools.py               # Search tools (vector, graph, hybrid)
│   └── context.py            # Retrieval context management
│
├── 📊 Data Management
│   ├── db_utils.py            # Database operations & vector storage
│   ├── graph_utils.py         # Knowledge graph management
│   └── analytics.py          # Usage tracking & metrics
│
└── 📄 Document Processing
    ├── ingest.py              # Document upload & processing
    ├── chunker.py             # Intelligent text segmentation
    ├── embedder.py            # Vector embedding generation
    └── converters.py          # Multi-format document support
```

## 🚀 Quick Start

### Prerequisites
```bash
# Python 3.9+
python --version

# PostgreSQL with vector extensions
psql --version

# Redis for caching
redis-server --version
```

### Installation
```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env

# Initialize database
python -c "from db_utils import initialize_database; import asyncio; asyncio.run(initialize_database())"
```

### Configuration
```bash
# .env file
GOOGLE_API_KEY=your_gemini_api_key
LLM_CHOICE=gemini-2.5-flash
DATABASE_URL=postgresql://user:password@localhost:5432/datadiver
REDIS_URL=redis://localhost:6379
API_PORT=8058
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=200MB
```

### Start Development Server
```bash
python -m uvicorn api:app --host 0.0.0.0 --port 8058 --reload
```

Access at:
- **API**: http://localhost:8058
- **Docs**: http://localhost:8058/docs
- **Health**: http://localhost:8058/health

## 🔥 Key Features

### 🤖 1M Context Optimization

DataDiver is optimized for Gemini 2.5 Flash's 1M context window:

```python
# Single-pass document processing
class DBRSummarizer:
    def __init__(self, max_context_tokens: int = 900000):  # 90% of 1M
        self.enable_single_pass = True
        self.max_rag_context_docs = 20    # vs previous 5
        self.max_context_chunks = 100     # vs previous 10
```

**Performance Benefits:**
- **28x more context** usage (32K → 900K tokens)
- **70% faster** processing (45s → 12s average)
- **Single LLM call** instead of 10-50 batch calls
- **Higher quality** with full document context

### 🔍 Hybrid Search Engine

Combines multiple search strategies for optimal retrieval:

```python
# Enhanced retrieval with vector + graph search
async def retrieve(self, query: str, config: Dict):
    # 1. Query understanding & intent recognition
    processed_query = await self._process_query(query)

    # 2. Vector similarity search (semantic)
    vector_results = await vector_search_tool(VectorSearchInput(
        query=processed_query.vector_query,
        limit=100  # Optimized for 1M context
    ))

    # 3. Knowledge graph exploration (factual)
    graph_results = await graph_search_tool(GraphSearchInput(
        query=processed_query.graph_query
    ))

    # 4. Intelligent result fusion
    final_results = await self._fuse_results(vector_results, graph_results)

    return final_results
```

### 📊 Domain Expert Analysis

Automatic document classification with specialized analysis:

```python
# Domain-specific expert prompts
domains = {
    DocumentDomain.FINANCIAL: "financial analysis expert",
    DocumentDomain.ENVIRONMENTAL: "environmental scientist",
    DocumentDomain.TECHNICAL: "technical documentation specialist",
    DocumentDomain.LEGAL: "legal document analyst"
}

# Expert-level analysis for each domain
async def classify_and_analyze(self, document, chunks):
    classification = await self.classify_document(document, chunks)
    expert_prompt = self.get_domain_expert_prompt(classification.domain)
    return await self.analyze_with_expertise(expert_prompt)
```

### 💬 Real-time Chat Interface

Streaming conversational AI with live updates:

```python
# Streaming chat with source citations
@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    async def generate_response():
        # Real-time retrieval events
        async for event in enhanced_retriever.retrieve_with_events(request.message):
            yield f"data: {json.dumps(event)}\n\n"

        # Streaming AI response
        async for delta in rag_agent.stream_response(request.message):
            yield f"data: {json.dumps({'type': 'delta', 'content': delta})}\n\n"

        # Final sources and confidence
        yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

    return StreamingResponse(generate_response(), media_type="text/plain")
```

## 📚 API Documentation

### Core Endpoints

#### Document Management
```python
POST   /documents/upload      # Upload and process documents
GET    /documents            # List all documents
GET    /documents/{id}       # Get document details
DELETE /documents/{id}       # Delete document
POST   /documents/{id}/summarize  # Generate summary
```

#### Chat & Search
```python
POST   /chat/stream          # Streaming chat interface
POST   /search/vector        # Vector similarity search
POST   /search/graph         # Knowledge graph search
POST   /search/hybrid        # Combined search strategies
```

#### Analytics & Health
```python
GET    /health              # System health check
GET    /analytics/dashboard # Usage metrics
GET    /analytics/trending  # Trending searches
```

### Example Usage

#### Upload Document
```python
import requests

files = {'file': open('document.pdf', 'rb')}
data = {'collection_name': 'Research Papers'}

response = requests.post(
    'http://localhost:8058/documents/upload',
    files=files,
    data=data
)
```

#### Generate Summary
```python
response = requests.post(
    f'http://localhost:8058/documents/{doc_id}/summarize',
    json={
        'summary_type': 'comprehensive',
        'include_context': True,
        'force_regenerate': False
    }
)
summary = response.json()
```

#### Chat with Documents
```python
import requests
import json

response = requests.post(
    'http://localhost:8058/chat/stream',
    json={
        'message': 'What are the key findings in this report?',
        'search_type': 'hybrid',
        'session_id': 'user-session-123'
    },
    stream=True
)

for line in response.iter_lines():
    if line.startswith(b'data: '):
        data = json.loads(line[6:])
        print(data)
```

## 🛠️ Development

### Adding New Features

#### 1. New Search Tool
```python
# tools.py
@tool
async def custom_search_tool(input: CustomSearchInput) -> List[ChunkResult]:
    """Custom search implementation"""
    # Your search logic here
    return results

# Register in enhanced_retrieval.py
async def execute_custom_search(self, query, context):
    return await custom_search_tool(CustomSearchInput(query=query))
```

#### 2. New Document Processor
```python
# converters.py
class CustomDocumentConverter:
    async def convert(self, file_path: str) -> str:
        """Convert custom format to text"""
        # Your conversion logic
        return extracted_text

# Register in ingest.py
CONVERTERS = {
    '.custom': CustomDocumentConverter(),
}
```

#### 3. New Domain Expert
```python
# document_classifier.py
class DocumentDomain(Enum):
    CUSTOM = "custom_domain"

def get_domain_expert_prompt(self, domain: DocumentDomain):
    if domain == DocumentDomain.CUSTOM:
        return "You are a specialist in custom domain..."
```

### Performance Tuning

#### Vector Search Optimization
```python
# Tune embedding parameters
EMBEDDING_CONFIG = {
    'model': 'text-embedding-004',
    'dimensions': 768,
    'similarity_threshold': 0.7,
    'max_results': 100
}

# Optimize query expansion
QUERY_EXPANSION = {
    'enable_synonyms': True,
    'enable_context': True,
    'max_expansions': 3
}
```

#### LLM Configuration
```python
# Optimize for different use cases
LLM_CONFIGS = {
    'chat': {
        'model': 'gemini-2.5-flash',
        'temperature': 0.7,
        'max_tokens': 2000
    },
    'summary': {
        'model': 'gemini-2.5-flash',
        'temperature': 0.3,
        'max_tokens': 4000
    }
}
```

### Testing

```bash
# Run tests
pytest tests/

# Test specific module
pytest tests/test_summarizer.py -v

# Test with coverage
pytest --cov=agent tests/

# Load testing
locust -f tests/load_test.py --host=http://localhost:8058
```

### Deployment

#### Production Configuration
```python
# gunicorn.conf.py
bind = "0.0.0.0:8058"
workers = 4
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
max_requests = 1000
timeout = 300
```

#### Docker Deployment
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8058

CMD ["gunicorn", "-c", "gunicorn.conf.py", "api:app"]
```

#### Environment Variables
```bash
# Production settings
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO

# Database connections
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=30
REDIS_MAX_CONNECTIONS=100

# Performance tuning
MAX_CONCURRENT_REQUESTS=100
REQUEST_TIMEOUT=300
UPLOAD_TIMEOUT=600
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection
```bash
# Check PostgreSQL connection
psql $DATABASE_URL -c "SELECT 1;"

# Verify vector extension
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

#### 2. API Key Issues
```bash
# Test Gemini API
curl -H "Authorization: Bearer $GOOGLE_API_KEY" \
  "https://generativelanguage.googleapis.com/v1/models"
```

#### 3. Memory Issues
```python
# Monitor memory usage
import psutil
print(f"Memory usage: {psutil.virtual_memory().percent}%")

# Optimize chunk processing
CHUNK_BATCH_SIZE = 50  # Reduce if memory issues
MAX_CONCURRENT_SUMMARIES = 4  # Limit parallel processing
```

### Performance Monitoring

```python
# Add performance logging
import time
import logging

logger = logging.getLogger(__name__)

async def timed_operation(operation_name: str):
    start_time = time.time()
    try:
        result = await operation()
        return result
    finally:
        duration = time.time() - start_time
        logger.info(f"{operation_name} completed in {duration:.2f}s")
```

## 📖 Additional Resources

- **Main Documentation**: [README.md](../README.md)
- **System Architecture**: [system-architecture-diagram.md](../system-architecture-diagram.md)
- **1M Context Optimization**: [1M_CONTEXT_OPTIMIZATION.md](../1M_CONTEXT_OPTIMIZATION.md)
- **API Documentation**: http://localhost:8058/docs (when running)
- **Development Guidelines**: [CLAUDE.md](../CLAUDE.md)

---

**The DataDiver AI backend transforms documents into intelligent, queryable knowledge.** Built for scale, optimized for performance, and designed for the future of document intelligence.