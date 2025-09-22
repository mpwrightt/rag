# API Reference

This document details the RESTful API endpoints provided by DataDiver's FastAPI backend. The API is accessible at `/` (e.g., `http://localhost:8058` in dev, or your deployed base URL). All endpoints use JSON for requests/responses unless specified. Authentication is required for protected routes via Bearer token (Clerk JWT).

OpenAPI documentation is auto-generated and available at `/docs` (Swagger UI) or `/redoc` (ReDoc).

## Authentication

- **Header**: `Authorization: Bearer <clerk-jwt>`
- **Scopes**: User must be authenticated via Clerk; endpoints check `user_id` from JWT.
- **Unauthenticated**: Returns 401 Unauthorized.
- **Invalid Token**: Returns 403 Forbidden.

## Base URL
`{NEXT_PUBLIC_API_BASE}` (e.g., `https://api.datadiver.ai`)

## Error Responses
Common error format:
```json
{
  "detail": "Error description",
  "type": "validation_error|auth_error|internal_error",
  "code": 400|401|500
}
```
- 400 Bad Request: Validation errors (Pydantic details array).
- 401 Unauthorized: Missing/invalid auth.
- 403 Forbidden: Insufficient permissions.
- 429 Too Many Requests: Rate limit exceeded.
- 500 Internal Server Error: Unexpected (logged).

## Endpoints

### Health Check
| Method | Path | Description | Auth | Parameters | Response |
|--------|------|-------------|------|------------|----------|
| GET | `/health` | System health check (DB, LLM, graph connectivity). | No | None | 200: `{"status": "healthy", "checks": {"database": "healthy", "llm": "healthy", ...}, "version": "1.0.0"}` |

**Example**:
```bash
curl http://localhost:8058/health
```

### Chat
| Method | Path | Description | Auth | Request Body | Response |
|--------|------|-------------|------|--------------|----------|
| POST | `/chat` | Non-streaming chat (RAG query with hybrid retrieval). | Yes | [ChatRequest](#chatrequest) | 200: [ChatResponse](#chatresponse) `{ "response": "Generated text", "sources": [...], "metrics": {...} }` |
| POST | `/chat/stream` | Streaming chat (SSE for real-time responses). | Yes | [ChatRequest](#chatrequest) | 200: SSE stream `data: {"delta": "partial text", "done": false} ... data: {"done": true, "sources": [...]} ` |

#### ChatRequest (Pydantic)
```json
{
  "messages": [{"role": "user|assistant", "content": "str"}],
  "session_id": "str",  // Optional, auto-generates if missing
  "search_type": "vector|graph|hybrid",  // Default: hybrid
  "max_results": 5,  // 1-20, default 5
  "temperature": 0.7,  // 0-1, default 0.7
  "domain": "environmental|financial|legal|technical|general"  // Optional, auto-classified
}
```

#### ChatResponse
```json
{
  "response": "Full generated answer",
  "sources": [{"document_id": "uuid", "title": "str", "snippet": "str", "score": 0.85}],
  "metrics": {"response_time_ms": 1800, "tokens_used": 450, "sources_count": 3},
  "session_id": "str"
}
```

**Example**:
```bash
curl -X POST http://localhost:8058/chat/stream \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "What are the key environmental risks?"}],
    "search_type": "hybrid",
    "max_results": 3
  }'
```

### Search
| Method | Path | Description | Auth | Request Body | Response |
|--------|------|-------------|------|--------------|----------|
| POST | `/search/vector` | Vector similarity search (cosine > threshold). | Yes | [SearchRequest](#searchrequest) | 200: [SearchResponse](#searchresponse) `{ "results": [...], "metrics": {...} }` |
| POST | `/search/graph` | Knowledge graph traversal (entities/relations). | Yes | [SearchRequest](#searchrequest) | 200: [SearchResponse](#searchresponse) |
| POST | `/search/hybrid` | Combined vector + graph + keyword, fused reranked. | Yes | [SearchRequest](#searchrequest) | 200: [SearchResponse](#searchresponse) |

#### SearchRequest
```json
{
  "query": "str",  // Required
  "top_k": 10,  // 1-50, default 10
  "threshold": 0.7,  // 0-1, default 0.7 (cosine for vector)
  "collection_id": "uuid",  // Optional filter
  "user_id": "uuid"  // Auto from auth, optional override
}
```

#### SearchResponse
```json
{
  "results": [
    {
      "id": "uuid",
      "content": "str snippet",
      "title": "str",
      "score": 0.92,
      "type": "chunk|document|entity",
      "metadata": {"entities": {"companies": ["Google"], "technologies": ["AI"]}},
      "relationships": [{"source": "str", "target": "str", "type": "RELATED_TO"}]
    }
  ],
  "metrics": {"retrieval_time_ms": 120, "results_count": 10, "avg_score": 0.85}
}
```

**Example**:
```bash
curl -X POST http://localhost:8058/search/hybrid \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "carbon emission strategies",
    "top_k": 5,
    "threshold": 0.8
  }'
```

### Document Management
| Method | Path | Description | Auth | Parameters | Request Body | Response |
|--------|------|-------------|------|------------|--------------|----------|
| GET | `/documents` | List user's documents (paginated). | Yes | `?limit=20&offset=0&collection_id=uuid` | None | 200: `{"documents": [...], "total": 50, "has_more": true}` |
| POST | `/upload` | Upload and process document (multipart). | Yes | None | Multipart: `file` (PDF/DOCX/etc.), `collection_id` (optional) | 202: `{"document_id": "uuid", "status": "processing", "progress_url": "/progress/{id}"}` |
| GET | `/documents/{id}` | Get document details. | Yes | `id: uuid` | None | 200: [Document](#document) |
| DELETE | `/documents/{id}` | Delete document and chunks/graph. | Yes | `id: uuid` | None | 200: `{"deleted": true}` |

#### Document
```json
{
  "id": "uuid",
  "title": "str",
  "source": "str",
  "content": "full text",  // Optional, large
  "metadata": {"file_size": 12345, "ingestion_date": "2024-01-01T00:00:00Z", "entities": {...}},
  "chunk_count": 15,
  "summary": "str",  // If generated
  "user_id": "uuid",
  "collection_id": "uuid"
}
```

**Example Upload**:
```bash
curl -X POST http://localhost:8058/upload \
  -H "Authorization: Bearer <jwt>" \
  -F "file=@report.pdf" \
  -F "collection_id=env-123"
```

### Analytics
| Method | Path | Description | Auth | Parameters | Response |
|--------|------|-------------|------|------------|----------|
| GET | `/analytics/real-time` | Real-time metrics (queries/min, active users). | Yes | `?time_range=24h|7d|30d` | 200: `{"queries_per_min": 2847, "active_users": 156, "response_avg_ms": 8.1}` |
| GET | `/analytics/chat-metrics` | Chat statistics (success rate, session trends). | Yes | `?session_id=str&date_from=2024-01-01` | 200: `{"success_rate": 97.8, "avg_session_length": 5, "trends": [...]}` |
| GET | `/analytics/dashboard` | Combined dashboard data (usage, performance). | Yes | `?time_range=24h` | 200: [DashboardMetrics](#dashboardmetrics) |

#### DashboardMetrics
```json
{
  "usage": {"daily_queries": 1847, "active_users": 48},
  "performance": {"avg_response_time": 1.8, "success_rate": 97.8},
  "knowledge_base": {"total_documents": 76, "total_chunks": 2847, "graph_nodes": 1247},
  "system": {"cpu_usage": 42, "memory_usage": 71, "uptime": 99.94}
}
```

**Example**:
```bash
curl -H "Authorization: Bearer <jwt>" http://localhost:8058/analytics/dashboard?time_range=24h
```

### Integrations
| Method | Path | Description | Auth | Request Body | Response |
|--------|------|-------------|------|--------------|----------|
| POST | `/integrations/google-drive/auth` | OAuth auth for Google Drive. | Yes | [OAuthRequest](#oauthrequest) | 200: `{"auth_url": "str", "state": "str"}` |
| POST | `/integrations/google-drive/files` | List Drive files. | Yes | `{"access_token": "str"}` | 200: `{"files": [{"id": "str", "name": "str", "mimeType": "str"}]}` |
| POST | `/integrations/dropbox/auth` | Similar for Dropbox. | Yes | [OAuthRequest](#oauthrequest) | 200: `{"auth_url": "str"}` |
| ... | `/integrations/onedrive/...` | OneDrive endpoints. | Yes | Varies | Varies |

#### OAuthRequest
```json
{
  "redirect_uri": "str",
  "state": "str"  // Optional CSRF
}
```

**Example Google Drive Auth**:
```bash
curl -X POST http://localhost:8058/integrations/google-drive/auth \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"redirect_uri": "http://localhost:3000/drive-callback"}'
```

## Rate Limits
- Chat: 10/min per user (adjustable via SlowAPI).
- Search: 50/min.
- Upload: 5/hour (large files queued).

## WebSockets
No WebSockets; use SSE for streaming (/chat/stream).

For module details, see [docs/modules.md](modules.md). For troubleshooting, see [docs/troubleshooting.md](troubleshooting.md).