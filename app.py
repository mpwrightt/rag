"""
Alternative entry point for the RAG API backend.
"""

import os
import sys
import uvicorn
from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

# Ensure proper module path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    # Get configuration from environment variables with deployment-friendly defaults
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    log_level = os.getenv("LOG_LEVEL", "info").lower()
    app_env = os.getenv("APP_ENV", "production")
    
    print(f"🚀 Starting RAG API Backend on {host}:{port}")
    print(f"📊 Environment: {app_env}")
    print(f"📝 Log Level: {log_level}")
    
    # Run with deployment-optimized configuration
    uvicorn.run(
        "agent.api:app",  # String format for deployment stability
        host=host,
        port=port,
        log_level=log_level,
        reload=False,  # Disabled for deployment stability
        access_log=True
    )