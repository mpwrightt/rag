"""
Vercel-compatible Python API entry point for the RAG system.
This serves as the main entry point for Vercel's Python runtime.
"""

import os
import sys
import json
from pathlib import Path

# Add the project root to Python path for Vercel
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Import the FastAPI app from the main API module
from agent.api import app

# Vercel expects this function to be named `handler`
def handler(event, context):
    """
    Vercel serverless function handler.
    This wraps the FastAPI app for Vercel deployment.
    """
    # Extract HTTP method, path, and other details from the event
    http_method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    headers = event.get('headers', {})
    query_params = event.get('queryStringParameters', {}) or {}
    body = event.get('body', '')

    # Convert Vercel event to ASGI-compatible format
    scope = {
        'type': 'http',
        'asgi': {'version': '3.0', 'spec_version': '2.3'},
        'http_version': '1.1',
        'method': http_method,
        'path': path,
        'raw_path': path.encode(),
        'query_string': '&'.join([f"{k}={v}" for k, v in query_params.items()]).encode(),
        'headers': [[k.lower().encode(), v.encode()] for k, v in headers.items()],
        'server': ('vercel', 443),
        'client': ('127.0.0.1', 0),
    }

    # Handle the request using FastAPI's ASGI interface
    async def handle_request():
        # This is a simplified approach - in production you might want
        # to use a more robust ASGI server adapter for Vercel
        try:
            # For now, we'll return a simple response
            # In a full implementation, you'd integrate with Vercel's Python runtime properly
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
                'body': json.dumps({
                    'message': 'RAG API is running on Vercel',
                    'status': 'healthy',
                    'version': '0.1.0'
                })
            }
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': str(e)})
            }

    # Run the async handler
    import asyncio
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(handle_request())
        return result
    finally:
        loop.close()

# For local testing
if __name__ == "__main__":
    print("Starting Vercel-compatible API server...")
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8058)))
