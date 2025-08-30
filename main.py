"""
Main entry point for the RAG API backend on Replit.

This file imports and runs the FastAPI app from agent/api.py
with configuration suitable for Replit deployment.
"""

import os
import sys
import uvicorn
from pathlib import Path
from dotenv import load_dotenv

# Add current directory to Python path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# Load environment variables
load_dotenv()

# Import the FastAPI app from agent module with error handling
try:
    from agent.api import app
    print("✅ Successfully imported FastAPI app")
except ImportError as e:
    print(f"❌ Failed to import FastAPI app: {e}")
    sys.exit(1)

if __name__ == "__main__":
    # Get configuration from environment variables with Replit-friendly defaults
    host = os.getenv("HOST", "0.0.0.0")  # Replit needs 0.0.0.0
    port = int(os.getenv("PORT", 8000))   # Replit usually uses port 8000
    log_level = os.getenv("LOG_LEVEL", "info").lower()
    
    # Default to production mode for deployment stability
    app_env = os.getenv("APP_ENV", "production")
    reload = app_env == "development"
    
    print(f"🚀 Starting RAG API Backend on {host}:{port}")
    print(f"📊 Environment: {app_env}")
    print(f"📝 Log Level: {log_level}")
    print(f"🔄 Hot Reload: {reload}")
    
    # Run the server using string-based app import for deployment stability
    uvicorn.run(
        "agent.api:app",  # String format instead of direct import
        host=host,
        port=port,
        log_level=log_level,
        reload=False,  # Disabled for deployment stability
        access_log=True
    )