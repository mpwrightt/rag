# Module Breakdown

This document provides a detailed breakdown of DataDiver's major modules and directories. Each section describes the module's purpose, key functions/classes, inputs/outputs, dependencies, implementation details, and edge cases. Cross-references to other docs are included (e.g., see [architecture.md](architecture.md) for data flow).

## Root Directory

**Purpose**: Project configuration, entry points, and shared resources. Serves as the glue between frontend/backend and deployment.

**Key Files**:
- [`package.json`](package.json): NPM dependencies (next@15, @clerk/nextjs@5, convex@1.12, tailwindcss@4, recharts@2.12).
- [`next.config.ts`](next.config.ts): Next.js config (appDir: true, images domains for Vercel).
- [`main.py`](main.py): FastAPI entry (imports [`agent/api.py`](agent/api.py:10) app, uvicorn server on 8058).
- [`.env.example`](.env.example): Template for env vars (Clerk keys, Convex URL, Gemini API, PG URL).
- [`DEPLOYMENT.md`](DEPLOYMENT.md): General deploy guide (Vercel/Railway/Docker/K8s, envs, security).
- [`REPLIT_DEPLOYMENT.md`](REPLIT_DEPLOYMENT.md): Replit-specific (secrets, run on 8000, Supabase/Neon).

**Inputs/Outputs**: Configures runtime (e.g., NEXT_PUBLIC_API_BASE → frontend fetches).
**Dependencies**: None (top-level).
**Details**: Root README.md overridden by docs/. Scripts/sql/ empty (future migrations).
**Edge Cases**: Missing env → errors (e.g., no CONVEX_URL → ConvexClientProvider throw).

## agent/

**Purpose**: Core RAG logic, API routes, database interactions, and AI orchestration. Handles query processing, retrieval, generation, and analytics.

**Key Functions/Classes**:
- [`agent.py`](agent/agent.py): PydanticAI Agent with tools (search_vector, search_graph, search_hybrid, summarize_collection).
- [`api.py`](agent/api.py): FastAPI app/routes: POST /chat (non-stream), /chat/stream (SSE), /search/{vector|graph|hybrid}, /upload (multipart process), /analytics/{real-time|chat-metrics|dashboard}, /integrations/{google-drive|dropbox|onedrive}/{auth|files}.
- [`models.py`](agent/models.py): Pydantic schemas (ChatRequest: messages/session_id/search_type/max_results, ChatResponse: response/sources/metrics, SearchRequest: query/top_k/threshold, Document: id/title/content/metadata).
- [`prompts.py`](agent/prompts.py): System prompt for RAG agent (JSON output, domain-aware, cite sources).
- [`providers.py`](agent/providers.py): LLM/embed clients (get_llm_client: Gemini/OpenAI/Anthropic/Groq/Mistral/Cohere based on LLM_CHOICE env, get_embedding_client: text-embedding-3-small/large/ada-002/004).
- [`db_utils.py`](agent/db_utils.py): asyncpg pool init (min_size=5/max=20, SSL/timeout), CRUD (create_session, insert_message, get_documents, insert_chunk, etc.).
- [`graph_utils.py`](agent/graph_utils.py): KnowledgeGraphClient (PG ops: add_episode → insert nodes/edges/facts, clear_graph → DELETE, query_graph → Cypher-like on PG tables).
- [`enhanced_retrieval.py`](agent/enhanced_retrieval.py): Multi-step RAG (query_processor: intent/entities/keywords, retrieve: tools chain, fuse_rerank: reciprocal rank fusion).
- [`document_classifier.py`](agent/document_classifier.py): Domain enum (environmental/financial/legal/technical/general) via keywords or LLM.
- [`summarizer.py`](agent/summarizer.py): Domain-expert summaries (prompt per domain, cache in PG summaries table, verification).
- [`tools.py`](agent/tools.py): PydanticAI tools (search_vector: PG cosine, search_graph: entity traversal, upload_integration: Drive/Dropbox APIs).
- [`analytics.py`](agent/analytics.py): Track (log_query: insert metrics/sessions, get_realtime: PG aggregate queries/min/users).

**Inputs/Outputs**:
- API: JSON requests (e.g., ChatRequest) → JSON responses (ChatResponse with sources/metrics).
- DB: Queries (SELECT with user_id filter) → results; Mutations (INSERT/UPDATE with RLS).
- LLM: Prompts (JSON-structured) → generations (parse JSON).

**Dependencies**: fastapi, pydantic-ai, asyncpg, google-generativeai, openai, graphiti-core, redis (cachetools fallback).
**Details**: Async throughout, error fallbacks (e.g., simple search if hybrid fails), env-config (LLM_CHOICE, VECTOR_DIMENSION=1536/768).
**Edge Cases**: Large contexts (truncate to 1M tokens, overlap chunks), no results (fallback to summary), rate limits (retry with backoff), invalid domain (general prompt).

See [api.md](api.md) for endpoint specs.

## api/

**Purpose**: Serverless deployment adapters and backend dependencies. Proxies requests to FastAPI app for Vercel/AWS without running uvicorn.

**Key Files**:
- [`aws_handler.py`](api/aws_handler.py): Mangum(app, lifespan="auto") for Lambda (cold start handling).
- [`vercel_handler.py`](api/vercel_handler.py): httpx ASGI transport/client (shared to avoid lifespan per-request), path normalization (strip /api/rag), CORS, timeouts (HANDLER_READ_TIMEOUT=55s), BaseHTTPRequestHandler entry, local uvicorn fallback.
- [`requirements.txt`](api/requirements.txt): Backend deps (fastapi==0.115.13, pydantic-ai==0.3.2, asyncpg==0.30.0, google-generativeai>=0.8.0, openai==1.90.0, anthropic==0.54.0, groq==0.28.0, mistralai==1.8.2, cohere==5.15.0, graphiti-core==0.12.4, boto3==1.38.41, httpx==0.28.1, mangum==0.17.0).

**Inputs/Outputs**: HTTP requests → forwarded to FastAPI app → responses (with CORS/base64 for binary).
**Dependencies**: mangum (AWS), httpx (Vercel).
**Details**: Single ASGI client per cold start for efficiency, env timeouts, passthrough ?p= for Vercel routing.
**Edge Cases**: Binary responses (base64 encode), OPTIONS preflight (CORS 204), missing httpx (500 error).

See [setup-deployment.md](setup-deployment.md) for usage.

## app/

**Purpose**: Next.js application structure, pages, layouts, and global styles. Handles routing, providers, and user-facing UI.

**Key Files**:
- [`layout.tsx`](app/layout.tsx): Root layout (Geist fonts, metadata title="DataDiver", ThemeProvider forced dark, ClerkProvider, ConvexClientProvider).
- [`globals.css`](app/globals.css): Tailwind @import, OKLCH colors (light/dark vars), animations (meteor/orbit/shine/border-beam), mobile utils (touch-manipulation, safe-area, prevent-zoom, btn-touch-target 44px).
- [`(landing)/page.tsx`](app/(landing)/page.tsx): Marketing page (HeroSection, FeaturesOne, BentoGrid, Testimonials, FAQs, Footer, CustomClerkPricing; MagicUI: DotPattern, InfiniteSlider tech marquee, SpotlightCard advantages with AnimatedBeam, NumberTicker metrics).
- [`dashboard/page.tsx`](app/dashboard/page.tsx): Auth dashboard (Tabs: Overview/Analytics/Performance/System/Activity/AI Insights; shadcn Card/Badge/Progress/Tabs, Recharts Area/Pie/Line/Bar; fetches /documents /health, KnowledgeHealthScore, auto-refresh toggle).
- Subdirs: dashboard/ (nav sidebar, charts, data.json mock), (landing)/ (components like hero-section.tsx).

**Inputs/Outputs**: User interactions → API calls (fetch /chat /documents with auth), Convex queries (useQuery for users/metrics).
**Dependencies**: next, react, @clerk/nextjs, convex/react, tailwindcss, recharts, lucide-react.
**Details**: App Router parallel routes, client components ("use client"), responsive (grid-cols-1 sm:2 lg:4, clamp text), mock data fallback on API error.
**Edge Cases**: No auth → redirect to sign-in, loading states (skeleton), offline (Convex offline persistence), mobile sidebar (sheet overlay <768px).

See [frontend structure in architecture.md](architecture.md#frontend-nextjs-15).

## components/

**Purpose**: Reusable React components for UI, providers, and custom elements. Organized by feature (ui primitives, magicui animations, react-bits effects).

**Key Files/Classes**:
- [`ConvexClientProvider.tsx`](components/ConvexClientProvider.tsx): ConvexReactClient with Clerk auth (useAuth, NEXT_PUBLIC_CONVEX_URL required).
- [`theme-provider.tsx`](components/theme-provider.tsx): NextThemesProvider wrapper (dark default, disableTransitionOnChange).
- [`ui/button.tsx`](components/ui/button.tsx): shadcn Button (cva variants: default/destructive/outline/secondary/ghost/link; sizes: default/sm/lg/icon; Slot for composability, cn merge, touch-manipulation min 44px).
- ui/: shadcn primitives (accordion.tsx, alert-dialog.tsx, badge.tsx, card.tsx, tabs.tsx, etc. – Radix UI base, Tailwind styles).
- magicui/: Animations (animated-beam.tsx: SVG beams between elements, spotlight-card.tsx: radial gradient spotlight, number-ticker.tsx: animated counters, orbiting-circles.tsx: CSS orbit keyframes).
- react-bits/: Effects (pixel-card.tsx: pixel art hover, splash-cursor.tsx: cursor trails).
- Others: custom-clerk-pricing.tsx (Clerk pricing integration), knowledge-health-score.tsx (metrics gauge), document-relationships.tsx (graph viz).

**Inputs/Outputs**: Props (e.g., Button: className/variant/size/children) → rendered JSX.
**Dependencies**: @radix-ui/react-*, class-variance-authority, clsx, tw-merge, framer-motion, lucide-react.
**Details**: Composable (Slot asChild), accessible (aria-invalid ring), mobile-first (min-height 44px, touch-action).
**Edge Cases**: Dark mode (CSS vars), loading (skeleton.tsx), no JS (progressive enhancement).

See [UI components in architecture.md](architecture.md#frontend-nextjs-15).

## convex/

**Purpose**: Real-time database for user management, auth sync, and payments. Uses Convex TypeScript for schema, queries, mutations, and webhooks.

**Key Files**:
- [`schema.ts`](convex/schema.ts): defineSchema { users: {name: string, externalId: string (Clerk ID), index byExternalId}, paymentAttempts: paymentAttemptSchemaValidator (fields like payment_id/userId/payer, indexes by paymentId/userId/payerUserId) }.
- [`users.ts`](convex/users.ts): Queries (current: getUserIdentity → byExternalId), mutations (upsertFromClerk: insert/patch name/externalId, deleteFromClerk: delete by ID), helpers (getCurrentUser/OrThrow).
- [`http.ts`](convex/http.ts): httpRouter POST /clerk-users-webhook (Svix verify with CLERK_WEBHOOK_SECRET, handle user.created/updated → upsert, user.deleted → delete, paymentAttempt.updated → transform/save internal mutation).
- [`auth.config.ts`](convex/auth.config.ts): providers [{domain: NEXT_PUBLIC_CLERK_FRONTEND_API_URL, applicationID: "convex"}].

**Inputs/Outputs**: Convex queries/mutations (e.g., useQuery("users:current") → user record), webhooks (JSON payload → internal mutations).
**Dependencies**: convex/server, @clerk/backend, svix.
**Details**: Internal mutations for webhook security, unique index prevents duplicates.
**Edge Cases**: No identity → null user, webhook invalid → 400, concurrent updates (patch idempotent).

See [DB schema in architecture.md](architecture.md#database-layer).

## ingestion/

**Purpose**: Document processing ETL pipeline for RAG+KG. Converts formats, chunks semantically, embeds, stores in PG, builds graph.

**Key Functions/Classes**:
- [`ingest.py`](ingestion/ingest.py): DocumentIngestionPipeline (init DB/graph, ingest_documents: clean/find/read/chunk/embed/save/graph, CLI argparse --chunk-size etc., watchdog/heartbeats/timeouts).
- [`chunker.py`](ingestion/chunker.py): ChunkingConfig, SemanticChunker (structure split + LLM boundaries, fallback simple), SimpleChunker (paragraph/sentence split), DocumentChunk (content/index/start/end/metadata/token_count).
- [`converters.py`](ingestion/converters.py): convert_to_markdown (PDF: pdfminer/PyMuPDF/OCR fallback; DOCX: python-docx; XLSX: pandas/openpyxl to MD tables; HTML: BeautifulSoup/markdownify; normalize_text: NFKC/de-hyphenate/collapse whitespace).
- [`embedder.py`](ingestion/embedder.py): EmbeddingGenerator (model configs dims/max_tokens, batch/retry on RateLimit/APIError, fallback individual/zero-vector), EmbeddingCache (MD5 hash, LRU eviction), embed_chunks (add embedding attr to DocumentChunk).
- [`graph_builder.py`](ingestion/graph_builder.py): GraphBuilder (KnowledgeGraphClient add_episode/clear, _prepare_episode_content truncate 6000 chars), extract_entities_from_chunks (rules for companies/tech/people/locations lists/patterns), SimpleEntityExtractor fallback.

**Inputs/Outputs**: File path/content → processed chunks (with embedding/entities) → PG insert (documents/chunks), graph episodes (nodes/edges/facts).
**Dependencies**: pdfminer.six, PyMuPDF, openpyxl, pdf2image/pytesseract (OCR opt), openai/google-generativeai, graphiti-core.
**Details**: Async pipeline, env timeouts (INGEST_GRAPH_BUILD_TIMEOUT=300s), progress callbacks, YAML frontmatter metadata.
**Edge Cases**: Empty PDF (fallback raw/OCR), oversized chunk (truncate sentence-end), no entities (empty dict), graph timeout (partial save, log error).

See [ingestion pipeline in architecture.md](architecture.md#data-flow).

## hooks/ & lib/

**Purpose**: Utility hooks and shared functions for frontend.

**Key Files**:
- [`use-mobile.ts`](hooks/use-mobile.ts): useIsMobile (matchMedia max-1023px), useIsMobileSidebar (max-767px for sheet overlay).
- [`utils.ts`](lib/utils.ts): cn(...inputs: ClassValue[]) = twMerge(clsx(inputs)) for Tailwind merging.

**Inputs/Outputs**: useIsMobile() → boolean (SSR undefined → client hydrate).
**Dependencies**: react, clsx, tw-merge.
**Details**: Event listener cleanup, !! coercion for boolean.
**Edge Cases**: SSR mismatch (initial undefined), resize events.

## public/

**Purpose**: Static assets (images, icons, favicons).

**Key Files**: favicon.ico, next.svg, vercel.svg, hero-section-main-app-dark.png, globe.svg, file.svg, window.svg.

**Details**: Used in landing (hero background), dashboard (logos), no processing needed.
**Edge Cases**: Missing asset → Next.js 404 placeholder.

## scripts/ & sql/

**Purpose**: Future scripts (migrations, data gen) and SQL schemas. Currently empty.

**Details**: Add Alembic for PG migrations, init.sql for pgvector/tables/indexes.
**Edge Cases**: N/A.

For setup, see [setup-deployment.md](setup-deployment.md). For testing, see [testing.md](testing.md).