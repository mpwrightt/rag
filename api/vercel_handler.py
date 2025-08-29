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
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Add the project root to Python path for Vercel
# (__file__).parent is the 'api/' dir; we need the repo root one level up
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

# Import the FastAPI app from the main API module
from agent.api import app

# Lazy import httpx so local tools that don't have it installed still work
try:
    import httpx
except Exception:  # pragma: no cover
    httpx = None  # Will raise at runtime if actually used without dependency present

# Reuse a single ASGI transport/client across invocations so FastAPI lifespan
# (startup/shutdown) runs once per cold start instead of on every request.
_ASGI_TRANSPORT = None
_ASGI_CLIENT = None

def _get_httpx_client():
    """Get a process-wide AsyncClient bound to the ASGI app.

    This avoids re-running app lifespan on each request and reduces cold start
    overhead. Timeouts are configurable via HANDLER_CONNECT_TIMEOUT and
    HANDLER_READ_TIMEOUT environment variables.
    """
    global _ASGI_TRANSPORT, _ASGI_CLIENT
    if httpx is None:
        raise RuntimeError("httpx is not installed in the runtime")
    if _ASGI_TRANSPORT is None:
        _ASGI_TRANSPORT = httpx.ASGITransport(app=app)
    if _ASGI_CLIENT is None:
        # Configure conservative timeouts to avoid indefinite hangs
        try:
            connect_t = float(os.getenv("HANDLER_CONNECT_TIMEOUT", "8"))
        except Exception:
            connect_t = 8.0
        try:
            read_t = float(os.getenv("HANDLER_READ_TIMEOUT", "55"))
        except Exception:
            read_t = 55.0
        _ASGI_CLIENT = httpx.AsyncClient(
            transport=_ASGI_TRANSPORT,
            base_url="http://asgi.internal",
            timeout=httpx.Timeout(read=read_t, connect=connect_t),
        )
    return _ASGI_CLIENT

def _normalize_path(path: str) -> str:
    """Normalize the path to match FastAPI routes.

    - If the incoming path has an "/api/rag" prefix (e.g. from direct calls), strip it.
    - Ensure the path is non-empty and starts with "/".
    """
    if not path:
        return "/"
    if path.startswith("/api/rag"):
        path = path[len("/api/rag"):]
    if not path.startswith("/"):
        path = "/" + path
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
    headers = event.get("headers", {}) or {}
    params = dict(event.get("queryStringParameters", {}) or {})

    # Reconstruct original path from the passthrough query param 'p' (see vercel.json)
    # Example: /api/rag/documents -> dest /api/vercel_handler.py?p=documents
    passthrough_path = None
    if "p" in params and params["p"] is not None:
        passthrough_path = params.pop("p")
    incoming_path = event.get("path", "/")
    if passthrough_path:
        # Ensure leading '/'
        path = _normalize_path(passthrough_path)
    else:
        # Fallback to normalizing the event path (covers local/dev invocations)
        path = _normalize_path(incoming_path)

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

    # Use a shared ASGITransport/AsyncClient to invoke FastAPI app without
    # starting a server. This ensures lifespan runs once per cold start.
    client = _get_httpx_client()
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


class handler(BaseHTTPRequestHandler):
    """Vercel Python function entrypoint.

    Uses BaseHTTPRequestHandler as required by Vercel's Python runtime and forwards
    the request to the FastAPI ASGI app via httpx.ASGITransport.
    """

    def _build_event(self) -> Dict[str, Any]:
        # Parse URL and query params
        parsed = urlparse(self.path)
        query_params = {k: v[0] if isinstance(v, list) and v else None for k, v in parse_qs(parsed.query).items()}

        # Extract passthrough path if present
        passthrough_path = query_params.pop("p", None)
        path = _normalize_path(passthrough_path or parsed.path)

        # Collect headers into a case-insensitive dict
        headers = {k: v for k, v in self.headers.items()}

        # Read body if present
        body_bytes = b""
        content_length = int(self.headers.get("content-length", 0) or 0)
        if content_length > 0:
            body_bytes = self.rfile.read(content_length)

        # Build Lambda-style event for reuse with existing forwarding logic
        event: Dict[str, Any] = {
            "httpMethod": self.command,
            "headers": headers,
            "queryStringParameters": query_params,
            "path": path,
        }

        if body_bytes:
            # Base64 encode binary bodies
            event["isBase64Encoded"] = True
            event["body"] = base64.b64encode(body_bytes).decode()
        else:
            event["isBase64Encoded"] = False
            event["body"] = None

        return event

    def _send_response(self, result: Dict[str, Any]):
        status = int(result.get("statusCode", 200))
        headers = result.get("headers", {}) or {}
        body = result.get("body", "")
        is_b64 = result.get("isBase64Encoded", False)

        # Default CORS if not set
        headers.setdefault("Access-Control-Allow-Origin", "*")
        headers.setdefault("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        headers.setdefault("Access-Control-Allow-Headers", "Content-Type, Authorization")

        self.send_response(status)
        for k, v in headers.items():
            # Skip transfer-encoding which can cause issues
            if k.lower() != "transfer-encoding":
                self.send_header(k, v)
        self.end_headers()

        if body is not None:
            if isinstance(body, str):
                if is_b64:
                    self.wfile.write(base64.b64decode(body))
                else:
                    self.wfile.write(body.encode())
            elif isinstance(body, (bytes, bytearray)):
                self.wfile.write(body)

    def do_OPTIONS(self):  # Handle CORS preflight
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def _handle(self):
        import asyncio
        event = self._build_event()
        # Run the async forwarder in a fresh event loop per request
        # asyncio.run handles loop creation and teardown safely
        result = asyncio.run(_forward_to_asgi(event))
        self._send_response(result)

    def do_GET(self):
        self._handle()

    def do_POST(self):
        self._handle()

    def do_PUT(self):
        self._handle()

    def do_DELETE(self):
        self._handle()


# For local testing
if __name__ == "__main__":
    print("Starting Vercel-compatible API server...")
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8058)))
