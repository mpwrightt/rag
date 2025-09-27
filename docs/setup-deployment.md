# Setup and Deployment

This guide provides step-by-step instructions for local development setup, production deployment, and environment configuration. DataDiver supports multiple deployment strategies from simple (Vercel + Railway) to enterprise (Kubernetes).

## 🛠️ Local Development Setup

### Prerequisites
- Node.js ≥18
- Python ≥3.11
- PostgreSQL ≥15 with pgvector extension
- Redis ≥7 (for caching)
- Git
- Accounts: Clerk (auth), Convex (real-time DB), Google Cloud (Gemini API)

### 1. Clone Repository
```bash
git clone https://github.com/your-org/datadiver.git
cd datadiver
```

### 2. Environment Configuration
Create `.env.local` (frontend) and `api/.env` (backend) from examples:
```bash
cp .env.example .env.local
cp api/.env.example api/.env
```

#### Frontend (.env.local)
```
# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key
CLERK_SECRET_KEY=sk_test_your_key
NEXT_PUBLIC_CLERK_FRONTEND_API_URL=https://your-domain.clerk.dev

# Convex DB
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3180  # Local dev
CONVEX_DEPLOYMENT=dev

# API Backend
NEXT_PUBLIC_API_BASE=http://localhost:8058

# Optional
NODE_ENV=development
```

#### Backend (api/.env)
```
# AI Provider (Gemini primary)
GOOGLE_API_KEY=your_gemini_api_key
LLM_CHOICE=gemini-1.5-flash
EMBEDDING_MODEL=text-embedding-004  # Or text-embedding-3-small
VECTOR_DIMENSION=768  # For Gemini embeddings

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/datadiver?sslmode=disable
DATABASE_POOL_SIZE=5  # Dev: small pool

# Redis Cache
REDIS_URL=redis://localhost:6379

# App Config
APP_ENV=development
LOG_LEVEL=DEBUG
MAX_FILE_SIZE=50MB  # Dev limit
REQUEST_TIMEOUT=120s
```

### 3. Database Setup
#### PostgreSQL
1. Install PostgreSQL and enable pgvector:
```bash
# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE EXTENSION vector;"

# Or Docker
docker run --name datadiver-pg -e POSTGRES_PASSWORD=pass -p 5432:5432 -d pgvector/pgvector:pg16
```

2. Create database and run schema:
```bash
createdb datadiver
psql $DATABASE_URL -f sql/schema.sql  # Create tables/indexes (if sql/ populated)
```

#### Redis
```bash
# Install
sudo apt install redis-server

# Or Docker
docker run --name datadiver-redis -p 6379:6379 -d redis:7-alpine
```

#### Convex (Local Dev)
```bash
npm install -g convex
npx convex dev  # Starts local server on :3180
npx convex dashboard  # Schema management
```

### 4. Install Dependencies
#### Frontend
```bash
cd app
npm install
```

#### Backend
```bash
cd ../api
pip install -r requirements.txt
```

### 5. Clerk Setup
1. Create app at [Clerk Dashboard](https://dashboard.clerk.com).
2. Add domains (localhost:3000 for dev).
3. Configure webhook: URL `http://localhost:3180/api/clerk-users-webhook` (local Convex), secret to env.
4. Copy publishable/secret keys to .env.local.

### 6. Run Development Servers
Open three terminals:

**Terminal 1: Convex (Real-time DB)**
```bash
npx convex dev
```

**Terminal 2: Backend API**
```bash
cd api
uvicorn main:app --host 0.0.0.0 --port 8058 --reload
```

**Terminal 3: Frontend**
```bash
cd app
npm run dev
```

Access:
- Frontend: http://localhost:3000
- API Docs: http://localhost:8058/docs
- Health: http://localhost:8058/health

### 7. Ingest Test Documents
```bash
cd ingestion
python -m ingest --documents ../documents --clean --verbose  # Assumes sample docs in /documents
```

## 🔧 Production Deployment

### Option 1: Vercel (Frontend) + Railway (Backend) - Recommended
#### Frontend on Vercel
1. Push to GitHub.
2. Connect repo in [Vercel Dashboard](https://vercel.com).
3. Set env vars (from .env.local, use production keys).
4. Deploy: Auto on push, or `vercel --prod`.

**vercel.json** (root for routing):
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://your-railway-app.up.railway.app/api/:path*" }
  ]
}
```

#### Backend on Railway
1. Install CLI: `npm i -g @railway/cli`.
2. Login: `railway login`.
3. Init: `railway init` (link to GitHub repo, select api/ dir).
4. Add services: `railway add postgres`, `railway add redis`.
5. Set vars: `railway variables set GOOGLE_API_KEY=prod_key` (from api/.env).
6. Deploy: `railway up`.

Update frontend NEXT_PUBLIC_API_BASE to Railway URL.

### Option 2: AWS Lambda (Backend) + Vercel (Frontend)
#### Backend on AWS Lambda
1. Zip api/ dir with requirements.txt.
2. Create Lambda function (Python 3.11, timeout 300s).
3. Handler: `aws_handler.handler`.
4. Env vars: Same as Railway.
5. API Gateway: Proxy integration to Lambda.
6. IAM: PG access (RDS proxy), S3 (uploads opt).

**api/aws_handler.py** (already configured with Mangum).

#### Frontend
Same as Vercel, set NEXT_PUBLIC_API_BASE to API Gateway URL.

### Option 3: Docker Compose (Self-Hosted)
#### docker-compose.yml (root)
```yaml
version: '3.8'
services:
  frontend:
    build: ./app
    ports:
      - "3000:3000"
    env_file: .env.local
    depends_on:
      - backend

  backend:
    build: ./api
    ports:
      - "8058:8058"
    env_file: api/.env
    depends_on:
      - db
      - redis
    volumes:
      - uploads:/app/uploads

  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: datadiver
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: pass
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./sql:/docker-entrypoint-initdb.d

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
  uploads:
```

#### Build and Run
```bash
docker-compose up -d --build
# Migrate DB if needed
docker-compose exec db psql -U postgres -d datadiver -f /docker-entrypoint-initdb.d/schema.sql
```

**Dockerfiles**:
- app/Dockerfile: Multi-stage Node build (npm ci/build → standalone).
- api/Dockerfile: Python slim (apt gcc/libpq, pip requirements, gunicorn -w4 uvicorn).

### Option 4: Replit (Prototyping/Dev)
See [REPLIT_DEPLOYMENT.md](REPLIT_DEPLOYMENT.md) for details:
- Upload agent/ingestion/, requirements.txt, main.py.
- Secrets: GOOGLE_API_KEY, DATABASE_URL (Supabase/Neon).
- Run: Auto on port 8000, URL your-repl.repl.co.

### Option 5: Kubernetes (Enterprise)
Use manifests from DEPLOYMENT.md (Deployment/Service/Ingress for backend/frontend, Secrets for env, PersistentVolumes for PG/uploads, HorizontalPodAutoscaler).

Deploy:
```bash
kubectl apply -f k8s/
kubectl port-forward svc/datadiver-ingress 3000:80  # Access
```

## ⚙️ Environment Variables Reference

### Shared
| Var | Description | Default | Required |
|-----|-------------|---------|----------|
| NODE_ENV | Environment (development/production) | development | No |
| APP_ENV | Backend env | development | No |

### Frontend
| Var | Description | Example |
|-----|-------------|---------|
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | Clerk public key | pk_live_... |
| CLERK_SECRET_KEY | Clerk secret key | sk_live_... |
| NEXT_PUBLIC_CONVEX_URL | Convex URL | https://...convex.cloud |
| NEXT_PUBLIC_API_BASE | Backend URL | https://api.datadiver.ai |

### Backend
| Var | Description | Default | Required |
|-----|-------------|---------|----------|
| GOOGLE_API_KEY | Gemini API key | - | Yes |
| LLM_CHOICE | LLM provider | gemini-1.5-flash | Yes |
| DATABASE_URL | PG connection | - | Yes |
| REDIS_URL | Redis connection | - | Yes (if caching) |
| VECTOR_DIMENSION | Embedding dim | 1536 | No |
| MAX_FILE_SIZE | Upload limit | 100MB | No |
| REQUEST_TIMEOUT | API timeout | 60s | No |
| INGEST_GRAPH_BUILD_TIMEOUT | Graph timeout | 300s | No |

### Convex/Clerk
- CLERK_WEBHOOK_SECRET: Webhook verification.
- CONVEX_DEPLOYMENT: Deployment name (dev/prod).

## 🧪 Testing Deployment
1. Health: `curl $API_BASE/health` → {"status": "healthy"}.
2. Auth: Sign up via Clerk → dashboard accessible.
3. Upload: POST /upload file → 202 processing, GET /documents lists.
4. Chat: POST /chat/stream query → streamed response with sources.
5. Analytics: GET /analytics/dashboard → metrics data.

## 🔧 Troubleshooting
- **Port Conflicts**: Change ports in docker-compose/env.
- **DB Connection**: Verify URL/SSL, firewall allows 5432.
- **API Key Invalid**: Check quotas in Google Cloud Console.
- **CORS Errors**: Set CORS_ORIGINS=your-frontend.com in backend env.
- **Cold Starts**: Lambda/Vercel delays ~1-2s; use warmers.

See [troubleshooting.md](troubleshooting.md) for more.

For testing strategy, see [testing.md](testing.md). For changelog, see [changelog.md](changelog.md).