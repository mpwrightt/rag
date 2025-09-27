# DataDiver Deployment Guide

This guide covers deploying DataDiver's complete AI-powered document intelligence platform to production.

## 🏗️ Architecture Overview

DataDiver consists of three main components:

1. **Frontend (Next.js)** - User interface and dashboard
2. **AI Backend (Python FastAPI)** - Document processing and AI capabilities
3. **Real-time Database (Convex)** - User management and live features

## 🚀 Production Deployment

### Option 1: Vercel + Railway (Recommended)

#### Frontend on Vercel
```bash
# Connect repository to Vercel
vercel link

# Set environment variables in Vercel dashboard
CONVEX_DEPLOYMENT=your_convex_deployment
NEXT_PUBLIC_CONVEX_URL=https://your_convex_url
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your_key
CLERK_SECRET_KEY=sk_live_your_key
NEXT_PUBLIC_CLERK_FRONTEND_API_URL=https://your-clerk-domain.clerk.accounts.dev
NEXT_PUBLIC_API_BASE=https://your-railway-backend.up.railway.app

# Deploy
vercel --prod
```

#### AI Backend on Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and create project
railway login
railway init

# Set environment variables
railway variables set GOOGLE_API_KEY=your_gemini_key
railway variables set LLM_CHOICE=gemini-2.5-flash
railway variables set DATABASE_URL=postgresql://...
railway variables set REDIS_URL=redis://...

# Deploy
railway up
```

#### Database Setup
```bash
# PostgreSQL on Railway
railway add postgresql

# Redis on Railway
railway add redis

# Or use external providers:
# - Neon (PostgreSQL): https://neon.tech
# - Upstash (Redis): https://upstash.com
```

### Option 2: Docker Deployment

#### Complete Docker Setup
```yaml
# docker-compose.yml
version: '3.8'

services:
  # Frontend
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_BASE=http://backend:8058
      - CONVEX_DEPLOYMENT=${CONVEX_DEPLOYMENT}
    depends_on:
      - backend

  # AI Backend
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "8058:8058"
    environment:
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - DATABASE_URL=postgresql://postgres:password@db:5432/datadiver
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - ./uploads:/app/uploads

  # PostgreSQL with vector support
  db:
    image: pgvector/pgvector:pg16
    environment:
      - POSTGRES_DB=datadiver
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"

  # Redis for caching
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

#### Dockerfiles

**Frontend Dockerfile:**
```dockerfile
# Dockerfile.frontend
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

**Backend Dockerfile:**
```dockerfile
# Dockerfile.backend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY agent/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY agent/ .
RUN mkdir -p uploads

EXPOSE 8058

# Use gunicorn for production
CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8058", "--timeout", "300", "api:app"]
```

### Option 3: Kubernetes Deployment

#### Kubernetes Manifests

**Backend Deployment:**
```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: datadiver-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: datadiver-backend
  template:
    metadata:
      labels:
        app: datadiver-backend
    spec:
      containers:
      - name: backend
        image: datadiver/backend:latest
        ports:
        - containerPort: 8058
        env:
        - name: GOOGLE_API_KEY
          valueFrom:
            secretKeyRef:
              name: datadiver-secrets
              key: google-api-key
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: datadiver-secrets
              key: database-url
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8058
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8058
          initialDelaySeconds: 5
          periodSeconds: 5
```

**Service and Ingress:**
```yaml
# k8s/backend-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: datadiver-backend-service
spec:
  selector:
    app: datadiver-backend
  ports:
  - port: 8058
    targetPort: 8058
  type: ClusterIP

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: datadiver-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.datadiver.ai
    secretName: datadiver-tls
  rules:
  - host: api.datadiver.ai
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: datadiver-backend-service
            port:
              number: 8058
```

## ⚙️ Environment Configuration

### Production Environment Variables

#### Frontend (.env.production)
```bash
# Application
NEXT_PUBLIC_API_BASE=https://api.datadiver.ai
NODE_ENV=production

# Convex Database
CONVEX_DEPLOYMENT=prod:your-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-convex-url.convex.cloud

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_your_key
CLERK_SECRET_KEY=sk_live_your_key
NEXT_PUBLIC_CLERK_FRONTEND_API_URL=https://your-domain.clerk.accounts.dev

# Redirects
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/dashboard
```

#### Backend (.env.production)
```bash
# Application
ENVIRONMENT=production
DEBUG=false
API_PORT=8058
LOG_LEVEL=INFO

# AI Configuration
GOOGLE_API_KEY=your_production_gemini_key
LLM_CHOICE=gemini-2.5-flash
MAX_CONTEXT_TOKENS=900000

# Database
DATABASE_URL=postgresql://user:password@host:5432/datadiver
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=30

# Redis
REDIS_URL=redis://host:6379
REDIS_MAX_CONNECTIONS=100

# File Storage
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=200MB
ALLOWED_EXTENSIONS=pdf,docx,txt,pptx

# Performance
MAX_CONCURRENT_REQUESTS=100
REQUEST_TIMEOUT=300
UPLOAD_TIMEOUT=600
SUMMARY_CONCURRENCY=8

# Security
CORS_ORIGINS=https://app.datadiver.ai,https://datadiver.ai
TRUSTED_HOSTS=app.datadiver.ai,api.datadiver.ai
```

### Convex Environment Variables
```bash
# Set in Convex Dashboard
CLERK_WEBHOOK_SECRET=whsec_your_production_secret
NEXT_PUBLIC_CLERK_FRONTEND_API_URL=https://your-domain.clerk.accounts.dev
```

## 🔒 Security Configuration

### SSL/TLS Setup
```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name api.datadiver.ai;

    ssl_certificate /etc/ssl/certs/datadiver.crt;
    ssl_certificate_key /etc/ssl/private/datadiver.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://localhost:8058;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts for long-running requests
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

### Firewall Rules
```bash
# UFW configuration
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow from 10.0.0.0/8 to any port 5432  # PostgreSQL (internal only)
ufw allow from 10.0.0.0/8 to any port 6379  # Redis (internal only)
ufw enable
```

### Database Security
```sql
-- PostgreSQL security
-- Create restricted user for application
CREATE USER datadiver_app WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE datadiver TO datadiver_app;
GRANT USAGE ON SCHEMA public TO datadiver_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO datadiver_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO datadiver_app;

-- Enable row level security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_documents ON documents FOR ALL TO datadiver_app USING (user_id = current_user_id());
```

## 📊 Monitoring & Observability

### Health Checks
```python
# health.py
from fastapi import APIRouter
import asyncio
import time

router = APIRouter()

@router.get("/health")
async def health_check():
    """Comprehensive health check"""
    checks = {
        "status": "healthy",
        "timestamp": time.time(),
        "version": "1.0.0",
        "checks": {}
    }

    # Database connectivity
    try:
        await test_database_connection()
        checks["checks"]["database"] = "healthy"
    except Exception as e:
        checks["checks"]["database"] = f"unhealthy: {str(e)}"
        checks["status"] = "unhealthy"

    # Redis connectivity
    try:
        await test_redis_connection()
        checks["checks"]["redis"] = "healthy"
    except Exception as e:
        checks["checks"]["redis"] = f"unhealthy: {str(e)}"
        checks["status"] = "unhealthy"

    # AI model availability
    try:
        await test_llm_connection()
        checks["checks"]["llm"] = "healthy"
    except Exception as e:
        checks["checks"]["llm"] = f"unhealthy: {str(e)}"
        checks["status"] = "unhealthy"

    return checks
```

### Logging Configuration
```python
# logging_config.py
import logging.config

LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "[%(asctime)s] %(levelname)s in %(module)s: %(message)s",
        },
        "json": {
            "format": '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "module": "%(module)s", "message": "%(message)s"}',
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
            "stream": "ext://sys.stdout"
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "formatter": "json",
            "filename": "/var/log/datadiver/app.log",
            "maxBytes": 10485760,  # 10MB
            "backupCount": 5
        }
    },
    "loggers": {
        "": {
            "level": "INFO",
            "handlers": ["console", "file"]
        },
        "uvicorn": {
            "level": "INFO",
            "handlers": ["console", "file"],
            "propagate": False
        }
    }
}

logging.config.dictConfig(LOGGING_CONFIG)
```

### Metrics Collection
```python
# metrics.py
from prometheus_client import Counter, Histogram, Gauge, generate_latest

# Metrics
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint'])
REQUEST_DURATION = Histogram('http_request_duration_seconds', 'HTTP request duration')
ACTIVE_SESSIONS = Gauge('active_chat_sessions', 'Number of active chat sessions')
DOCUMENT_PROCESSING_TIME = Histogram('document_processing_seconds', 'Document processing time')

@app.middleware("http")
async def metrics_middleware(request, call_next):
    start_time = time.time()

    response = await call_next(request)

    duration = time.time() - start_time
    REQUEST_COUNT.labels(method=request.method, endpoint=request.url.path).inc()
    REQUEST_DURATION.observe(duration)

    return response

@app.get("/metrics")
async def get_metrics():
    return Response(generate_latest(), media_type="text/plain")
```

## 🚨 Backup & Recovery

### Database Backup
```bash
#!/bin/bash
# backup.sh

# Configuration
DB_NAME="datadiver"
BACKUP_DIR="/backups/postgresql"
RETENTION_DAYS=30

# Create backup
pg_dump $DATABASE_URL | gzip > "$BACKUP_DIR/datadiver_$(date +%Y%m%d_%H%M%S).sql.gz"

# Clean old backups
find $BACKUP_DIR -name "datadiver_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Upload to cloud storage (optional)
aws s3 cp "$BACKUP_DIR/datadiver_$(date +%Y%m%d_%H%M%S).sql.gz" s3://datadiver-backups/
```

### Document Storage Backup
```bash
#!/bin/bash
# backup_documents.sh

UPLOAD_DIR="/app/uploads"
BACKUP_BUCKET="s3://datadiver-documents-backup"

# Sync documents to cloud storage
aws s3 sync $UPLOAD_DIR $BACKUP_BUCKET --delete

# Create archive for local backup
tar -czf "/backups/documents_$(date +%Y%m%d).tar.gz" $UPLOAD_DIR
```

### Disaster Recovery
```bash
#!/bin/bash
# restore.sh

# Restore database
gunzip -c /backups/postgresql/datadiver_20240315_120000.sql.gz | psql $DATABASE_URL

# Restore documents
aws s3 sync s3://datadiver-documents-backup/ /app/uploads/

# Restart services
systemctl restart datadiver-backend
systemctl restart nginx
```

## 📈 Performance Optimization

### Database Optimization
```sql
-- PostgreSQL performance tuning
-- postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

-- Indexes for performance
CREATE INDEX CONCURRENTLY idx_documents_user_id ON documents(user_id);
CREATE INDEX CONCURRENTLY idx_chunks_document_id ON chunks(document_id);
CREATE INDEX CONCURRENTLY idx_chunks_embedding ON chunks USING ivfflat (embedding vector_cosine_ops);

-- Vacuum and analyze
VACUUM ANALYZE documents;
VACUUM ANALYZE chunks;
```

### Application Performance
```python
# performance.py
import asyncio
from functools import wraps

# Connection pooling
DATABASE_POOL_CONFIG = {
    "min_size": 10,
    "max_size": 20,
    "command_timeout": 60,
}

# Caching
REDIS_CONFIG = {
    "max_connections": 100,
    "retry_on_timeout": True,
    "socket_timeout": 5,
}

# Rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/chat/stream")
@limiter.limit("10/minute")  # Limit chat requests
async def chat_stream(request: Request, chat_request: ChatRequest):
    # Implementation
    pass
```

## 🔧 Troubleshooting

### Common Production Issues

#### High Memory Usage
```bash
# Monitor memory usage
htop
free -h

# Check application memory
ps aux | grep uvicorn
ps aux | grep node

# Optimize Python memory
export PYTHONMALLOC=malloc
export MALLOC_TRIM_THRESHOLD_=100000
```

#### Database Connection Issues
```bash
# Check PostgreSQL connections
SELECT count(*) FROM pg_stat_activity;
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;

# Monitor slow queries
SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
```

#### API Performance Issues
```bash
# Check response times
curl -w "@curl-format.txt" -s -o /dev/null https://api.datadiver.ai/health

# Monitor with htop
htop -p $(pgrep uvicorn)

# Check logs for errors
tail -f /var/log/datadiver/app.log | grep ERROR
```

## 📋 Deployment Checklist

### Pre-deployment
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database migrations applied
- [ ] Backup strategy implemented
- [ ] Monitoring configured
- [ ] Load testing completed

### Deployment
- [ ] Frontend deployed to Vercel/CDN
- [ ] Backend deployed with health checks
- [ ] Database connectivity verified
- [ ] Cache warming completed
- [ ] DNS records updated

### Post-deployment
- [ ] Health checks passing
- [ ] Metrics collecting properly
- [ ] Logs configured and accessible
- [ ] Backup verification
- [ ] Performance monitoring active
- [ ] Error alerting configured

### Rollback Plan
- [ ] Previous version tagged
- [ ] Database rollback scripts ready
- [ ] Quick rollback procedure documented
- [ ] Team notifications configured

---

**DataDiver is ready for enterprise-scale deployment.** This guide ensures a robust, secure, and performant production environment that can scale with your document intelligence needs.