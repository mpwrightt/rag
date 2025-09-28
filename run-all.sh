#!/bin/bash

# Enhanced DataDiver startup script with Dolphin integration
# Usage: ./run-all.sh [options]

set -e

# Default values
NO_CONVEX=false
NO_DOLPHIN=false
SETUP_DOLPHIN=false
API_PORT=8058
NEXT_PORT=3000

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --no-convex)
      NO_CONVEX=true
      shift
      ;;
    --no-dolphin)
      NO_DOLPHIN=true
      shift
      ;;
    --setup-dolphin)
      SETUP_DOLPHIN=true
      shift
      ;;
    --api-port)
      API_PORT="$2"
      shift 2
      ;;
    --next-port)
      NEXT_PORT="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --setup-dolphin    Download and setup Dolphin model (first time)"
      echo "  --no-dolphin       Skip Dolphin, use traditional parsers only"
      echo "  --no-convex        Skip Convex database server"
      echo "  --api-port PORT    Custom API port (default: 8058)"
      echo "  --next-port PORT   Custom frontend port (default: 3000)"
      echo "  -h, --help         Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                    # Standard run with auto-detection"
      echo "  $0 --setup-dolphin   # First-time setup with Dolphin"
      echo "  $0 --no-dolphin      # Run without Dolphin"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Running DataDiver project from: $SCRIPT_DIR"
echo "🐬 Enhanced with Dolphin multimodal document parser"

# Array to store background process PIDs
PIDS=()

# Function to cleanup background processes
cleanup() {
  echo ""
  echo "🛑 Stopping all services..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      echo "   Stopping PID $pid"
      kill "$pid" 2>/dev/null || true
    fi
  done
  echo "✅ All services stopped"
  exit 0
}

# Setup signal handlers
trap cleanup SIGINT SIGTERM

# Check if Dolphin setup is needed
if [[ "$SETUP_DOLPHIN" == true ]]; then
  echo ""
  echo "🔧 Setting up Dolphin document parser..."
  if python scripts/setup_dolphin.py; then
    echo "✅ Dolphin setup completed successfully!"
    export USE_DOLPHIN=1
  else
    echo "❌ Dolphin setup failed. Continuing without Dolphin..."
    export USE_DOLPHIN=0
  fi
elif [[ "$NO_DOLPHIN" != true ]]; then
  echo ""
  echo "🔍 Verifying Dolphin setup..."
  if python scripts/setup_dolphin.py --verify-only >/dev/null 2>&1; then
    echo "✅ Dolphin is ready!"
    export USE_DOLPHIN=1
  else
    echo "⚠️  Dolphin not available. Use --setup-dolphin to install. Continuing without Dolphin..."
    export USE_DOLPHIN=0
  fi
else
  echo ""
  echo "⏭️  Skipping Dolphin (use --no-dolphin to skip explicitly)"
  export USE_DOLPHIN=0
fi

echo ""
echo "🚀 Starting services..."

# Start Convex (unless disabled)
if [[ "$NO_CONVEX" != true ]]; then
  echo "💾 Starting Convex dev server..."
  npx convex dev &
  CONVEX_PID=$!
  PIDS+=($CONVEX_PID)
  echo "   Convex PID: $CONVEX_PID"
  sleep 2  # Give Convex a moment to start
else
  echo "⏭️  Skipping Convex database"
fi

# Start FastAPI backend
echo "🔌 Starting FastAPI backend on port $API_PORT..."
python -m uvicorn agent.api:app --reload --port "$API_PORT" &
API_PID=$!
PIDS+=($API_PID)
echo "   API PID: $API_PID"
sleep 2  # Give API a moment to start

# Start Next.js frontend
echo "📊 Starting Next.js frontend on port $NEXT_PORT..."
PORT="$NEXT_PORT" npm run dev &
FRONTEND_PID=$!
PIDS+=($FRONTEND_PID)
echo "   Frontend PID: $FRONTEND_PID"

echo ""
echo "🎉 All services launched successfully!"
echo ""
echo "📊 Frontend: http://localhost:$NEXT_PORT"
echo "🔌 API: http://localhost:$API_PORT"
if [[ "$NO_CONVEX" != true ]]; then
  echo "💾 Convex: Running (PID: $CONVEX_PID)"
fi
if [[ "$USE_DOLPHIN" == "1" ]]; then
  echo "🐬 Dolphin: Enhanced document parsing enabled"
else
  echo "📄 Document parsing: Traditional parsers only"
fi

echo ""
echo "📋 Running processes: ${PIDS[*]}"
echo ""
echo "Press Ctrl+C to stop all services..."

# Wait for user interrupt
while true; do
  sleep 1
  # Check if any process has died
  for i in "${!PIDS[@]}"; do
    pid="${PIDS[i]}"
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "⚠️  Process $pid has stopped"
      unset 'PIDS[i]'
    fi
  done

  # If no processes left, exit
  if [[ ${#PIDS[@]} -eq 0 ]]; then
    echo "❌ All processes have stopped"
    exit 1
  fi
done