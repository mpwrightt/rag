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
    # Simple direct import
    try:
        from agent.api import app
    except ImportError:
        # Try alternative import path
        from agent.api_enhanced import app
    
    # Run with Replit configuration
    uvicorn.run(
        "agent.api:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )