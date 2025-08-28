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
    # Import and run the API
    from agent.api import app
    import uvicorn
    
    # Get configuration from environment
    host = os.getenv("APP_HOST", "0.0.0.0")
    port = int(os.getenv("APP_PORT", 8058))
    
    print(f"Starting API server on {host}:{port}")
    uvicorn.run(app, host=host, port=port, reload=False)