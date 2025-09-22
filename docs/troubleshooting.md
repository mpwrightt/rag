# Troubleshooting

This guide addresses common issues encountered during development, deployment, and usage of DataDiver. Issues are categorized by component. For each, symptoms, causes, and solutions are provided. If unresolved, check logs (backend: console/uvicorn, frontend: browser devtools, DB: PG logs) and file issues on GitHub.

## Backend Issues

### API Timeouts or Hangs
**Symptoms**: 504 Gateway Timeout on /chat or /upload, ingestion stuck.
**Causes**: Long LLM calls (1M context), DB locks, graph build timeout.
**Solutions**:
- Increase env timeouts: REQUEST_TIMEOUT=300s, INGEST_GRAPH_BUILD_TIMEOUT=600s.
- Check watchdog: Set INGEST_HEARTBEAT_SEC=30, review stack dumps if blocked.
- Monitor: /health → "llm": "unhealthy" (API key quota), "database": "unhealthy" (pool exhausted).
- Scale: Gunicorn workers=4+, PG pool max=20.

**Example Fix** (Gemini slow):
```bash
# api/.env
LLM_CHOICE=gemini-1.5-flash-exp  # Faster variant
MAX_CONTEXT_TOKENS=500000  # Reduce if needed
```

### PDF/DOCX Upload Fails (Empty Content)
**Symptoms**: Uploaded file processes 0 chunks, "No chunks created" log.
**Causes**: Poor extraction (scanned PDF no text layer), encoding issues.
**Solutions**:
- Enable OCR: OCR_PDF=true, install pdf2image/pytesseract/Pillow (pip install).
- Fallbacks: converters.py tries pdfminer → PyMuPDF → OCR → raw decode.
- Test: curl /upload with sample.pdf, check logs for "pdfminer empty".
- Large files: MAX_FILE_SIZE=200MB, but split if >500 pages.

### Rate Limit Errors from LLM
**Symptoms**: 429 on embed/generate, "RateLimitError" in logs.
**Causes**: High concurrency exceeds provider quotas (Gemini 15 RPM free).
**Solutions**:
- Retry: Embedder/LLM clients use tenacity exponential backoff (max_retries=3).
- Rotate: Set LLM_CHOICE=openai (higher limits), or multiple keys.
- Batch: Embeddings batched 100, reduce batch_size=50 if bursty.
- Monitor: Analytics /api/analytics/dashboard → "error_rate": >0.8%.

### Database Connection Errors
**Symptoms**: "Connection refused" or SSL errors on startup, /health "database": "unhealthy".
**Causes**: Wrong DATABASE_URL, firewall blocks 5432, no pgvector.
**Solutions**:
- Verify URL: postgresql://user:pass@host:5432/db?sslmode=require (prod SSL).
- Pool: DATABASE_POOL_SIZE=10, test with psql $DATABASE_URL.
- Extension: psql -c "CREATE EXTENSION vector;".
- Local: Docker pgvector/pgvector:pg16, expose 5432.

**Example**:
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 'OK';"
# Enable vector
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

## Frontend Issues

### Auth Redirect Loop or 401
**Symptoms**: Infinite sign-in, dashboard 401 despite login.
**Causes**: Clerk/Convex sync fail, wrong NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.
**Solutions**:
- Check env: Keys match dashboard, domain includes localhost:3000.
- Webhook: Convex /clerk-users-webhook receives from Clerk (test with ngrok).
- Clear cache: rm -rf .next, npm run dev.
- Devtools: Network tab → 401 response body (JWT invalid?).

### Dashboard Charts Not Loading
**Symptoms**: Empty Recharts (Area/Pie), "Failed to fetch" console.
**Causes**: API_BASE wrong, CORS, mock fallback not triggering.
**Solutions**:
- Verify NEXT_PUBLIC_API_BASE=http://localhost:8058 (backend running).
- CORS: Backend sets *, but prod limit to frontend domain.
- Fallback: dashboard/page.tsx uses mock data on error (hourlyUsageData).
- Network: Backend /analytics/dashboard → 200 JSON.

### Mobile Layout Broken
**Symptoms**: Sidebar overlaps, text too small on <768px.
**Causes**: Tailwind responsive not applied, use-mobile hook mismatch.
**Solutions**:
- Breakpoints: useIsMobileSidebar <768px → sheet, grid-cols-1 sm:2.
- CSS: globals.css has mobile-container (padding env(safe-area-inset-left)), prevent-zoom font 16px.
- Test: Chrome devtools device mode, or real device (localhost via ngrok).

## Database & Graph Issues

### Vector Search Returns No Results
**Symptoms**: /search/vector empty, scores NaN.
**Causes**: Wrong dimension (1536 vs 768), no index, empty chunks.
**Solutions**:
- Dim: Set VECTOR_DIMENSION=768 (Gemini), recreate embeddings.
- Index: psql -c "CREATE INDEX ON chunks USING ivfflat (embedding vector_cosine_ops) (lists=100);".
- Data: Ingest docs first (python -m ingestion.ingest), check SELECT count(*) FROM chunks;.
- Threshold: Lower to 0.5 for testing.

### Graph Queries Slow or Empty
**Symptoms**: /search/graph timeout, 0 relationships.
**Causes**: PG graph tables unindexed, large episodes.
**Solutions**:
- Indexes: B-tree on nodes.id/edges.source_id (in schema.sql).
- Truncate: graph_builder.py limits 6000 chars/episode.
- Partial: INGEST_GRAPH_BUILD_TIMEOUT=300s logs partial saves.
- Test: SELECT * FROM graph_nodes LIMIT 5;.

## Deployment Issues

### Vercel 404 on /api Calls
**Symptoms**: Frontend fetch /api/chat → 404, but direct backend works.
**Causes**: vercel.json rewrites missing, path prefix.
**Solutions**:
- vercel.json: rewrites /api/:path* → backend URL.
- Vercel_handler: Strips /api/rag if present, ?p= passthrough.
- Logs: Vercel function logs → "path normalized to /chat".

### AWS Lambda Cold Start Slow
**Symptoms**: First /chat >10s, subsequent fast.
**Causes**: Mangum lifespan on init (DB pool/LLM warm).
**Solutions**:
- Layers: Bundle deps in Lambda layer (reduce size <250MB).
- Provisioned Concurrency: AWS console → 1-2 min warm.
- Warmers: Scheduled Lambda ping /health every 5min.

### Replit Port/URL Wrong
**Symptoms**: App runs but URL 404, "port 8000 required".
**Causes**: Replit assigns port, .replit config.
**Solutions**:
- .replit: run = "uvicorn main:app --host 0.0.0.0 --port $PORT".
- URL: https://your-repl.username.repl.co (not localhost).
- Secrets: All env in 🔒 tab.

## FAQs

| Issue | Quick Fix |
|-------|-----------|
| "Missing NEXT_PUBLIC_CONVEX_URL" | Add to .env.local, restart dev server. |
| Upload "413 Payload Too Large" | Increase MAX_FILE_SIZE=200MB in backend env. |
| Chat "No sources found" | Ingest documents first, check /documents count >0. |
| Dashboard "Network Error" | Backend not running? curl localhost:8058/health. |
| Graph "TimeoutError" | Set INGEST_GRAPH_BUILD_TIMEOUT=600, or skip_graph_building=true. |
| Embed "Dimension mismatch" | VECTOR_DIMENSION=768 for Gemini, recreate chunks. |
| Clerk "Invalid JWT" | Check keys/domains in dashboard, clear browser cookies. |

## Debugging Tips
- **Logs**: Backend DEBUG=true → verbose (e.g., chunking steps), frontend console.
- **Tools**: Postman/Insomnia for API, PGAdmin for DB inspect, Convex dashboard for schema/queries.
- **Profiling**: cProfile for Python slow funcs, React DevTools Profiler for frontend.
- **Mocks**: Use MSW for frontend API mocks during dev.

For module-specific issues, see [modules.md](modules.md). For changelog, see [changelog.md](changelog.md).