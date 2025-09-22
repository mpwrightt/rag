# Repository Guidelines

DataDiver combines a Next.js 15 client with a FastAPI retrieval service; use the checkpoints below when contributing.

## Project Structure & Module Organization
- `app/`, `components/`, `lib/`: App Router pages, shared UI, utilities; import with the `@/` alias.
- `convex/`: real-time schema and functions; update schema, actions, and auth hooks in the same change.
- `agent/`: FastAPI app plus retrieval and analytics pipelines; touch `models.py`, `db_utils.py`, and `enhanced_retrieval.py` together.
- `ingestion/`: chunking, embeddings, graph builders; mirror new formats in `scripts/convert_and_upload.py`.
- `api/` holds Vercel/AWS handlers and `docs/` tracks architecture—refresh diagrams whenever endpoints or data flow shift.

## Build, Test, and Development Commands
- `npm run dev` launches Next.js; start `npx convex dev` in parallel for local data sync.
- `npm run build` then `npm start` serves production bundles; add `npm run analyze` when debugging bundle size.
- Backend: `pip install -r requirements.txt` followed by `python -m uvicorn agent.api:app --reload --port 8058`.
- Ingestion smoke test: `python ingestion/ingest.py --file ./samples/report.pdf --collection Research`.

## Coding Style & Naming Conventions
- TypeScript: 2-space indentation, strict mode, functional components, Tailwind utilities, camelCase filenames (e.g., `documentTimeline.tsx`).
- Python: 4-space indentation, snake_case modules, typed Pydantic models, minimal but pointed docstrings for async flows.
- Secrets stay in `.env.local` (frontend) and `.env` (backend); commit only sanitized `*.example` templates.

## Testing Guidelines
- Aim for >80% coverage on retrieval-critical paths as outlined in `docs/testing.md`.
- Backend suites live in `agent/tests/` with `pytest`/`pytest-asyncio`; stub LLM, Postgres, and Convex calls.
- Frontend suites use Vitest + Testing Library colocated with components.
- Run `npm run lint` and pertinent pytest targets before each PR.

## Commit & Pull Request Guidelines
- Use `type: short description` commit messages (`feat: add collection filters`, `docs: update architecture diagram`).
- Keep commits narrowly scoped; mention affected subsystems when a change spans frontend, backend, and Convex.
- PRs include intent, test evidence, linked issues, and UI screenshots for user-facing changes.
- Flag new environment variables, migrations, or breaking API contracts in the PR checklist.

## Security & Configuration Tips
- Validate Clerk, Convex, and Gemini keys locally from `.env*.example`; rotate at once if exposure is suspected.
- Enforce Clerk auth in Next middleware and FastAPI dependencies on new routes; sanitize user content before rendering.
- When extending ingestion, wrap temporary files in context managers and delete artifacts after processing to limit PII.
