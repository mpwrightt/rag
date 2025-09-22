# Testing Strategy

DataDiver follows a comprehensive testing strategy to ensure reliability, performance, and security across its full-stack architecture. While the current codebase has minimal explicit test files (no dedicated `tests/` directory or visible Jest/Pytest suites), the strategy outlines recommended approaches for unit, integration, end-to-end (E2E), and performance testing. Coverage targets >80% for critical paths (RAG pipeline, API endpoints, DB ops).

Future implementations should add tests using pytest (backend), Jest/Vitest (frontend), and Cypress/Playwright (E2E). Mock external services (LLM/DB) with responses/responses to avoid costs/flakiness.

## 🧪 Unit Testing

**Purpose**: Test individual functions/classes in isolation (e.g., chunker splitting, entity extraction, prompt generation).

**Tools**:
- Backend: pytest, pytest-asyncio (for async), pytest-mock (LLM/DB mocks), Hypothesis (property-based for edge cases like large docs).
- Frontend: Vitest/Jest with React Testing Library (RTL) for components (render Button, fireEvent click), @testing-library/jest-dom matchers.

**Key Areas**:
- **Ingestion**: Test converters.py (mock PDF → MD output), chunker.py (input text → expected chunks, semantic vs simple), embedder.py (mock OpenAI response → embedding list).
- **Agent**: Test models.py (Pydantic validation: invalid ChatRequest → ValidationError), prompts.py (format_prompt → JSON string), document_classifier.py (text → domain enum).
- **DB/Graph**: Test db_utils.py (mock asyncpg conn → insert/select results), graph_builder.py (chunk → entities dict with known companies/tech).
- **Utils**: Test lib/utils.ts (cn("bg-red", "text-white") → merged string), hooks/use-mobile.ts (mock matchMedia → true/false).

**Running Unit Tests**:
```bash
# Backend
cd api
pip install pytest pytest-asyncio pytest-mock
pytest tests/unit/ -v --cov=agent --cov-report=html  # >80% coverage

# Frontend
cd app
npm install --save-dev vitest @testing-library/react jsdom
npm test -- --coverage  # vitest run
```

**Example Backend Test** (tests/unit/test_chunker.py):
```python
import pytest
from ingestion.chunker import SemanticChunker, ChunkingConfig

@pytest.mark.asyncio
async def test_semantic_chunking():
    config = ChunkingConfig(chunk_size=200, use_semantic_splitting=True)
    chunker = SemanticChunker(config)
    text = "Header\n\nParagraph one. Paragraph two."
    chunks = await chunker.chunk_document("Test", "test.md", text)
    assert len(chunks) == 2  # Structure split
    assert "Header" in chunks[0].content
```

**Coverage**: Use pytest-cov (backend), Vitest coverage (frontend). Ignore mocks/third-party (e.g., asyncpg calls).

## 🔗 Integration Testing

**Purpose**: Test interactions between modules (e.g., API endpoint → DB insert → retrieval).

**Tools**:
- Backend: pytest with TestClient (FastAPI), httpx for async, factories (factory-boy for PG data), docker-compose for test DB/Redis.
- Frontend: MSW (Mock Service Worker) for API mocks, Convex test utils for DB.

**Key Areas**:
- **API Endpoints**: Test /chat (valid request → 200 with sources), /upload (file → document_id, async processing), /search/hybrid (query → results with scores >0.7).
- **RAG Pipeline**: Test end-to-end ingestion (upload → chunks in PG → graph nodes), query (search → fused results → mock LLM response).
- **Auth/DB**: Test Clerk JWT → user_id filter in PG queries, Convex webhook → user upsert.
- **Integrations**: Mock Drive API → file list, test /integrations/google-drive/files.

**Running Integration Tests**:
```bash
# Backend (with test DB)
docker-compose -f docker-compose.test.yml up -d  # PG/Redis test instances
pytest tests/integration/ -v --cov

# Frontend
npm test -- --config vitest.integration.config.js  # Mock API responses
```

**Example API Test** (tests/integration/test_api.py):
```python
from fastapi.testclient import TestClient
from agent.api import app

client = TestClient(app)

def test_chat_endpoint():
    response = client.post("/chat", json={
        "messages": [{"role": "user", "content": "test"}]
    }, headers={"Authorization": "Bearer mock-jwt"})
    assert response.status_code == 200
    assert "response" in response.json()
```

**Database Testing**: Use testcontainers-python for ephemeral PG/Redis, truncate tables between tests, seed with factories.

## 🌐 End-to-End (E2E) Testing

**Purpose**: Test user workflows (e.g., sign up → upload → chat → view analytics).

**Tools**: Cypress (frontend+API), Playwright (cross-browser). Run against local/staging.

**Key Scenarios**:
- **Auth Flow**: Sign up (Clerk) → dashboard load (Convex user query) → 401 on unauth route.
- **Document Workflow**: Upload PDF → processing status → list in /documents → search retrieves chunks/sources.
- **Chat**: Type query → stream response → sources cited → analytics update.
- **Dashboard**: Load tabs → charts render (Recharts data from /analytics) → mobile sidebar toggles.
- **Integrations**: Auth Drive → list files → upload from Drive to ingestion.

**Running E2E Tests**:
```bash
# Cypress
cd app
npm install --save-dev cypress
npx cypress open  # GUI, or npx cypress run (headless)

# Playwright
npm install --save-dev @playwright/test
npx playwright test  # Tests in e2e/ dir
```

**Example Cypress Test** (cypress/e2e/upload.cy.js):
```js
describe('Document Upload', () => {
  it('uploads and processes PDF', () => {
    cy.visit('/dashboard/documents');
    cy.get('[data-cy="upload-button"]').click();
    cy.get('input[type="file"]').selectFile('cypress/fixtures/report.pdf');
    cy.get('[data-cy="submit-upload"]').click();
    cy.contains('Processing complete').should('be.visible');
    cy.get('[data-cy="documents-list"]').should('contain', 'report.pdf');
  });
});
```

**Fixtures**: Mock files (report.pdf), API responses (MSW for /upload 202).

## ⚡ Performance & Load Testing

**Purpose**: Ensure scalability (e.g., 100 concurrent chats, 1k docs ingestion).

**Tools**: Locust (Python API load), Artillery (HTTP), k6 (JS). Monitor with /metrics (Prometheus).

**Scenarios**:
- **Ingestion Load**: 100 docs parallel → measure time/chunks/sec, DB inserts.
- **Query Load**: 50 users/sec /chat hybrid → avg response <2s, error rate <1%.
- **Search**: 1000 vector queries → latency histogram, PG query plans.
- **Frontend**: Lighthouse CI for perf/accessibility (dashboard load <3s).

**Running Load Tests**:
```bash
# Locust (backend)
pip install locust
locust -f tests/load/chat_locust.py --host=http://localhost:8058  # 100 users, 10s ramp

# Artillery (API)
npm install -g artillery
artillery run tests/load/chat.yml  # YAML scenario: POST /chat x100

# k6 (frontend + API)
docker run --rm -v ${PWD}:/scripts loadimpact/k6 run scripts/e2e.js  # JS script
```

**Example Locust** (tests/load/chat_locust.py):
```python
from locust import HttpUser, task, between

class ChatUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def chat_query(self):
        self.client.post("/chat", json={
            "messages": [{"role": "user", "content": "test query"}]
        }, headers={"Authorization": "Bearer mock"})
```

**Thresholds**: Response time P95 <5s, error rate <0.5%, throughput >50 req/s.

## 🛡️ Security Testing

**Purpose**: Validate auth, input sanitization, vulnerabilities.

**Tools**: OWASP ZAP (DAST), Bandit (Python static), npm audit (JS).

**Areas**:
- Auth: JWT tampering → 403, missing token → 401.
- Injection: SQLi in queries (parameterized), XSS in frontend (sanitized outputs).
- Upload: Invalid file types → 400, oversized → 413.
- Rate Limit: 11th /chat/min → 429.

**Running Security Tests**:
```bash
# Backend static
pip install bandit
bandit -r agent/ ingestion/

# Frontend
npm audit
npm run lint:security  # ESLint security plugin

# DAST
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:8058
```

## CI/CD Integration

**GitHub Actions** (.github/workflows/test.yml):
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres: { image: pgvector/pgvector:pg16 }
      redis: { image: redis:7-alpine }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5 { python-version: 3.11 }
      - uses: actions/setup-node@v4 { node-version: 18 }
      - run: pip install -r api/requirements.txt && pytest --cov>80%
      - run: cd app && npm ci && npm test -- --coverage
      - run: npx cypress run  # E2E
      - uses: codecov/codecov-action@v4  # Coverage report
```

**Coverage Report**: Codecov/Badge in README.

## 📈 Current Testing Status

- **Implemented**: Minimal (no visible tests; recommend adding pytest for backend, Vitest for frontend).
- **Coverage**: 0% (baseline; target 80% for agent/ingestion).
- **CI/CD**: Not configured (add GitHub Actions for lint/test/build).
- **Recommendations**: Start with API integration tests (TestClient for /chat), add mocks for LLM (responses.json), E2E for workflows.

For troubleshooting test failures, see [troubleshooting.md](troubleshooting.md).