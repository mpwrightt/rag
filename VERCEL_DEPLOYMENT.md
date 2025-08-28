# Vercel Deployment Guide

This guide will help you deploy your RAG SaaS Hybrid application to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Convex Account**: Set up at [convex.dev](https://convex.dev)
3. **Clerk Account**: Configure at [clerk.com](https://clerk.com)
4. **Supabase Account**: Set up at [supabase.com](https://supabase.com)
5. **Google AI API Key**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)

## 1. Environment Variables Setup

### In Vercel Dashboard

Go to your Vercel project dashboard and add these environment variables:

#### Required Variables
```bash
# Clerk Authentication (from your Clerk dashboard)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key_here
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key_here
NEXT_PUBLIC_CLERK_FRONTEND_API_URL=https://your-clerk-frontend-api-url.clerk.accounts.dev

# Clerk Redirect URLs
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard

# Convex Configuration (from your Convex dashboard)
NEXT_PUBLIC_CONVEX_URL=https://your-convex-deployment-url.convex.cloud

# Supabase Database
DATABASE_URL=postgresql://user:password@host:port/database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# RAG AI Configuration
LLM_API_KEY=your_google_gemini_api_key
LLM_CHOICE=gemini-2.5-flash
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_PROVIDER=google

# RAG API Configuration
NEXT_PUBLIC_API_BASE=https://your-vercel-app.vercel.app/api/rag
APP_PORT=8058

# Optional RAG Features
ENABLE_GRAPH_SEARCH=true
ENABLE_HYBRID_SEARCH=true
ENABLE_CHAT_HISTORY=true
```

#### Environment Variable Notes

- **NEXT_PUBLIC_** prefixed variables are available in the browser
- Keep `CLERK_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` private (server-side only)
- Set `NEXT_PUBLIC_API_BASE` to your Vercel app URL after deployment
- Update redirect URLs in Clerk to match your Vercel domain

## 2. Convex Deployment

### Deploy Convex Backend

```bash
# Install Convex CLI (if not already installed)
npm install -g convex

# Deploy to Convex
npx convex deploy
```

### Get Convex URL

After deployment, get your Convex URL from the Convex dashboard and add it to Vercel's environment variables as `NEXT_PUBLIC_CONVEX_URL`.

## 3. Vercel Deployment

### Option 1: Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to Vercel
vercel --prod

# Or link to existing project
vercel link
vercel --prod
```

### Option 2: GitHub Integration

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Vercel will automatically deploy on every push to main branch

## 4. Clerk Configuration

### Update Clerk Application Settings

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Go to **Domains** and add your Vercel domain
4. Update **Authorized redirect URIs** to include:
   - `https://your-vercel-app.vercel.app/dashboard`
   - `https://your-vercel-app.vercel.app/api/auth/callback`

## 5. Supabase Configuration

### Database Setup

1. Create a new project in [Supabase](https://supabase.com)
2. Run the SQL schema files in order:
   ```sql
   -- Run schema.sql first
   -- Then run enhanced_schema.sql
   -- Finally run fix_vector_dimension.sql
   ```
3. Get your database URL and API keys from Supabase dashboard

### Enable Extensions

Make sure these PostgreSQL extensions are enabled:
- `vector` (for embeddings)
- `uuid-ossp` (for UUID generation)

## 6. Google AI Configuration

1. Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add it as `LLM_API_KEY` in Vercel environment variables
3. Ensure the key has access to Gemini models

## 7. Post-Deployment Steps

### Update API Base URL

After deployment, update the `NEXT_PUBLIC_API_BASE` environment variable in Vercel to point to your deployed app:

```
NEXT_PUBLIC_API_BASE=https://your-vercel-app.vercel.app/api/rag
```

### Test the Deployment

1. Visit your Vercel app URL
2. Try to sign up/sign in with Clerk
3. Test the chat functionality
4. Check the health endpoint: `https://your-app.vercel.app/api/rag/health`

## 8. Troubleshooting

### Common Issues

1. **Python API Not Working**: Check that `api/vercel_handler.py` is properly configured
2. **Environment Variables**: Ensure all required environment variables are set in Vercel
3. **Database Connection**: Verify Supabase connection and run migrations
4. **Clerk Authentication**: Check that redirect URLs are correctly configured

### Logs and Debugging

```bash
# Check Vercel function logs
vercel logs

# Check build logs in Vercel dashboard
# Go to your project → Functions → View Logs
```

### Environment-Specific Configuration

For production, you might want to:
- Set up proper CORS policies
- Configure rate limiting
- Set up monitoring and alerting
- Configure backup strategies for your database

## 9. Scaling Considerations

### Vercel Limits
- Serverless functions have a 30-second timeout (configurable to 5 minutes for Pro plans)
- Consider upgrading to Pro plan for:
  - Longer function timeouts
  - Higher concurrency limits
  - Better performance monitoring

### Database Scaling
- Monitor your Supabase usage
- Consider upgrading your Supabase plan as usage grows
- Set up database connection pooling

## 10. Security Checklist

- [ ] All secret keys are stored as environment variables (not in code)
- [ ] Database credentials are not exposed to the client
- [ ] Clerk webhook secrets are properly configured
- [ ] CORS is properly configured for your domain
- [ ] HTTPS is enabled (automatic with Vercel)
- [ ] Rate limiting is implemented where needed

## Support

If you encounter issues:
1. Check Vercel function logs
2. Verify all environment variables are set
3. Test individual components (Clerk, Convex, Supabase)
4. Check the health endpoint for system status

For more detailed troubleshooting, refer to:
- [Vercel Documentation](https://vercel.com/docs)
- [Convex Documentation](https://docs.convex.dev)
- [Clerk Documentation](https://clerk.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
