"""
Main entry point for the RAG API backend on Replit.

This file imports and runs the FastAPI app from agent/api.py
with configuration suitable for Replit deployment.
"""

import os
import uvicorn
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import the FastAPI app from agent module
from agent.api import app

if __name__ == "__main__":
    # Get configuration from environment variables with Replit-friendly defaults
    host = os.getenv("HOST", "0.0.0.0")  # Replit needs 0.0.0.0
    port = int(os.getenv("PORT", 8000))   # Replit usually uses port 8000
    log_level = os.getenv("LOG_LEVEL", "info").lower()
    
    # Check if running in development mode
    reload = os.getenv("APP_ENV", "production") == "development"
    
    print(f"🚀 Starting RAG API Backend on {host}:{port}")
    print(f"📊 Environment: {os.getenv('APP_ENV', 'production')}")
    print(f"📝 Log Level: {log_level}")
    print(f"🔄 Hot Reload: {reload}")
    
    # Run the server
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level=log_level,
        reload=reload,
        access_log=True
    )