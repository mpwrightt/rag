# RAG Backend Deployment on Replit

This guide explains how to deploy the RAG (Retrieval-Augmented Generation) backend API on Replit.

## Overview

The RAG backend is a FastAPI application that provides:
- Chat endpoints with streaming support
- Vector, graph, and hybrid search
- Document upload and management
- Analytics and metrics
- 3rd party integrations (Google Drive, Dropbox, OneDrive)

## Quick Start

### 1. Create New Repl
1. Go to [Replit](https://replit.com)
2. Click "Create Repl"
3. Choose "Python" template
4. Name your Repl (e.g., "rag-backend")

### 2. Upload Files
Upload these essential files and folders to your Repl:
- `agent/` - Core API modules
- `ingestion/` - Document processing pipeline
- `requirements.txt` - Python dependencies
- `main.py` - Entry point (created for Replit)
- `.replit` - Replit configuration
- `replit.nix` - Environment setup

### 3. Install Dependencies
Replit will automatically install dependencies from `requirements.txt` when you first run the app.

### 4. Configure Environment Variables
In your Repl, go to Secrets (🔒 icon) and add these required variables:

#### Core API Keys
```
LLM_API_KEY=your_google_gemini_api_key
GOOGLE_API_KEY=your_google_gemini_api_key
GEMINI_API_KEY=your_google_gemini_api_key
```

#### Database Configuration
```
DATABASE_URL=postgresql://username:password@host:port/database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

#### Optional: Graph Database
```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
```

#### App Configuration
```
APP_ENV=production
LOG_LEVEL=INFO
CHUNK_SIZE=800
CHUNK_OVERLAP=150
MAX_CHUNK_SIZE=1500
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_PROVIDER=google
```

### 5. Run the Application
Click the "Run" button in Replit. The app will start on port 8000 and be available at:
```
https://your-repl-name.username.repl.co
```

## Database Setup

### PostgreSQL with Supabase (Recommended)
1. Go to [Supabase](https://supabase.com)
2. Create new project
3. Enable pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
4. Copy connection details to Replit secrets

### Alternative: Neon PostgreSQL
1. Go to [Neon](https://neon.tech)
2. Create database with pgvector support
3. Use connection string in `DATABASE_URL`

### Neo4j Graph Database (Optional)
1. Use [Neo4j AuraDB](https://neo4j.com/cloud/aura/) for cloud deployment
2. Or [Neo4j Sandbox](https://sandbox.neo4j.com/) for testing
3. Add credentials to Replit secrets

## Testing the Deployment

### Health Check
Visit: `https://your-repl-name.username.repl.co/health`

Expected response:
```json
{
  "status": "healthy",
  "database": true,
  "graph_database": true,
  "llm_connection": true,
  "version": "0.1.0",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### API Documentation
Visit: `https://your-repl-name.username.repl.co/docs`

This provides interactive Swagger documentation for all endpoints.

## Connecting Frontend

Update your frontend's API base URL to point to your Replit deployment:

```javascript
// In your frontend .env file
NEXT_PUBLIC_API_BASE=https://your-repl-name.username.repl.co
```

## Key Features Available

### Chat Endpoints
- `POST /chat` - Non-streaming chat
- `POST /chat/stream` - Streaming chat with SSE

### Search Endpoints
- `POST /search/vector` - Vector similarity search
- `POST /search/graph` - Knowledge graph search
- `POST /search/hybrid` - Combined search

### Document Management
- `GET /documents` - List documents
- `POST /upload` - Upload documents
- `DELETE /documents/{id}` - Delete documents

### Analytics
- `GET /api/analytics/real-time` - Real-time metrics
- `GET /api/analytics/chat-metrics` - Chat statistics
- `GET /api/analytics/dashboard` - Combined dashboard

## Troubleshooting

### Common Issues

#### "Module not found" errors
- Ensure all files are uploaded correctly
- Check that `agent/` and `ingestion/` folders are present
- Verify Python path in `.replit` file

#### Database connection errors
- Verify DATABASE_URL is correct
- Check if pgvector extension is enabled
- Ensure database allows external connections

#### API key errors
- Confirm all required secrets are set
- Check secret names match exactly
- Verify API keys are valid and have proper permissions

#### Port/URL issues
- Replit assigns URLs automatically
- Use the URL shown in the Replit interface
- Don't hardcode localhost URLs

### Debug Mode
Set these secrets for debugging:
```
APP_ENV=development
LOG_LEVEL=DEBUG
DEBUG_MODE=true
```

### Logs
View logs in the Replit console tab to diagnose issues.

## Performance Considerations

### Replit Limitations
- CPU and memory limits on free tier
- Request timeout limits
- Concurrent connection limits

### Optimization Tips
- Use connection pooling for databases
- Implement caching where appropriate
- Consider upgrading to Replit Pro for production use

## Security Notes

- Never commit API keys to code
- Use Replit secrets for sensitive data
- Enable CORS only for your frontend domains in production
- Consider rate limiting for public APIs

## Next Steps

1. Test all endpoints thoroughly
2. Upload sample documents
3. Verify chat and search functionality
4. Connect your frontend application
5. Monitor performance and logs

## Support

For issues specific to this deployment:
1. Check Replit console for error messages
2. Verify all environment variables are set
3. Test database connections independently
4. Review the health endpoint output

The backend is now ready to serve your RAG application from Replit! 🚀