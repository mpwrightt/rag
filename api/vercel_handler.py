"""
Vercel-compatible Python API entry point for the RAG system.
This forwards incoming requests to the FastAPI ASGI app without starting a server.
"""

import os
import sys
import json
import base64
from pathlib import Path
from typing import Dict, Any

# Add the project root to Python path for Vercel
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

# Import the FastAPI app from the main API module
from agent.api import app

# Lazy import httpx so local tools that don't have it installed still work
try:
    import httpx
except Exception:  # pragma: no cover
    httpx = None  # Will raise at runtime if actually used without dependency present


def _normalize_path(path: str) -> str:
    """Strip the /api/rag prefix added by vercel.json so routes match FastAPI app."""
    if path.startswith("/api/rag"):
        new_path = path[len("/api/rag"):]
        return new_path or "/"
    return path or "/"


async def _forward_to_asgi(event: Dict[str, Any]) -> Dict[str, Any]:
    if httpx is None:
        # Defensive error if dependency isn't available in the Vercel env
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "httpx is not installed in the runtime"}),
        }

    method = event.get("httpMethod", "GET")
    path = _normalize_path(event.get("path", "/"))
    headers = event.get("headers", {}) or {}
    params = event.get("queryStringParameters", {}) or {}

    # Decode body
    body: bytes | None
    raw_body = event.get("body")
    if raw_body is None:
        body = None
    else:
        if event.get("isBase64Encoded"):
            body = base64.b64decode(raw_body)
        else:
            # Treat as text
            body = raw_body.encode()

    # Use ASGITransport to invoke FastAPI app without starting a server
    transport = httpx.ASGITransport(app=app, lifespan="on")
    async with httpx.AsyncClient(transport=transport, base_url="http://asgi.internal") as client:
        resp = await client.request(
            method,
            path,
            headers=headers,
            params=params,
            content=body,
        )

    # Build Vercel response
    vercel_headers = dict(resp.headers)
    # Ensure CORS headers are present (FastAPI also sets permissive CORS)
    vercel_headers.setdefault("Access-Control-Allow-Origin", "*")
    vercel_headers.setdefault("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    vercel_headers.setdefault("Access-Control-Allow-Headers", "Content-Type, Authorization")

    # Decide if response should be base64 encoded (for binary)
    content_type = vercel_headers.get("content-type", "")
    if content_type.startswith("text/") or "json" in content_type or content_type.startswith("application/javascript") or content_type.startswith("application/problem+json") or content_type.startswith("text/event-stream"):
        body_text = resp.text
        return {
            "statusCode": resp.status_code,
            "headers": vercel_headers,
            "body": body_text,
        }
    else:
        body_b64 = base64.b64encode(resp.content).decode()
        return {
            "statusCode": resp.status_code,
            "headers": vercel_headers,
            "isBase64Encoded": True,
            "body": body_b64,
        }


# Vercel expects this function to be named `handler`
def handler(event, context):
    """Vercel serverless function handler forwarding to FastAPI app."""
    import asyncio

    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(_forward_to_asgi(event))
    finally:
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
        except Exception:
            pass
        loop.close()


# For local testing
if __name__ == "__main__":
    print("Starting Vercel-compatible API server...")
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8058)))
