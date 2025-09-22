# Changelog

All notable changes to this project will be documented in this file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit messages.

## [Unreleased]

### Added
- Initial full-stack RAG platform with Next.js frontend, FastAPI backend, PostgreSQL/Convex DB.
- Hybrid retrieval (vector + graph + keyword) with Gemini 1.5 Flash LLM support.
- Ingestion pipeline for multi-format documents (PDF/DOCX/XLSX) with semantic chunking and Graphiti KG.
- Clerk auth integration with Convex webhook sync.
- Dashboard with real-time analytics, charts (Recharts), and mobile-responsive UI (Tailwind/shadcn/MagicUI).

### Changed
- Optimized for 1M context with chunk overlap and summary caching.
- Backend deps updated (fastapi 0.115, pydantic-ai 0.3, openai 1.90).

### Deprecated

### Removed

### Fixed

### Security

## [0.1.0] - 2024-09-22

### Added
- Core architecture: Frontend (App Router, providers), backend (PydanticAI agent, tools), ingestion (converters/chunker/embedder/graph_builder).
- API endpoints: /chat/stream, /search/{vector|graph|hybrid}, /upload, /analytics/dashboard.
- Database schema: PG tables (documents/chunks/sessions/graph), Convex users/paymentAttempts.
- Deployment adapters: Vercel/httpx, AWS/Mangum, Docker compose.
- UI components: shadcn primitives, MagicUI animations, dashboard tabs/metrics.

### Changed
- Initial setup from scratch; no prior versions.

### This is a template for future releases. Update with semantic versioning (SemVer) and categorize changes.

For setup, see [setup-deployment.md](setup-deployment.md). For issues, see [troubleshooting.md](troubleshooting.md).