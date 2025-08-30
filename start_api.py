#!/usr/bin/env python3
"""
Start the API server with proper module setup.
"""

import sys
import os
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

if __name__ == "__main__":
    import uvicorn
    
    # Get configuration from environment with deployment-friendly defaults
    host = os.getenv("HOST", os.getenv("APP_HOST", "0.0.0.0"))
    port = int(os.getenv("PORT", os.getenv("APP_PORT", 8000)))
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