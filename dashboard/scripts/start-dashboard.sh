#!/bin/bash
# start-dashboard.sh — Start Hive Dashboard (event server + Next.js)
# Usage: ./dashboard/scripts/start-dashboard.sh [--bg]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DASHBOARD_DIR="$REPO_ROOT/dashboard"
SERVER_DIR="$DASHBOARD_DIR/server"

EVENT_PORT="${HIVE_EVENT_PORT:-3001}"
DASHBOARD_PORT="${HIVE_DASHBOARD_PORT:-3000}"
STATE_DIR="${HIVE_STATE_DIR:-$REPO_ROOT/.hive-state}"

EVENT_PID=""
DASHBOARD_PID=""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[hive-dashboard]${NC} $1"; }
warn() { echo -e "${YELLOW}[hive-dashboard]${NC} $1"; }
err() { echo -e "${RED}[hive-dashboard]${NC} $1"; }

# Cleanup on exit
cleanup() {
  echo ""
  log "Shutting down..."
  if [ -n "$EVENT_PID" ] && kill -0 "$EVENT_PID" 2>/dev/null; then
    kill "$EVENT_PID" 2>/dev/null
    log "Event server stopped (PID $EVENT_PID)"
  fi
  if [ -n "$DASHBOARD_PID" ] && kill -0 "$DASHBOARD_PID" 2>/dev/null; then
    kill "$DASHBOARD_PID" 2>/dev/null
    log "Dashboard stopped (PID $DASHBOARD_PID)"
  fi
  log "Cleanup complete."
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Pre-flight checks
check_port() {
  local port=$1
  local name=$2
  if lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
    warn "Port $port already in use ($name). Skipping startup for $name."
    return 1
  fi
  return 0
}

# Ensure .hive-state directory
mkdir -p "$STATE_DIR"
log "State directory: $STATE_DIR"

# Ensure dependencies
if [ ! -d "$SERVER_DIR/node_modules" ]; then
  log "Installing event server dependencies..."
  (cd "$SERVER_DIR" && npm install --silent)
fi

if [ ! -d "$DASHBOARD_DIR/node_modules" ]; then
  log "Installing dashboard dependencies..."
  (cd "$DASHBOARD_DIR" && npm install --silent)
fi

# Start Event Server
if check_port "$EVENT_PORT" "Event Server"; then
  log "Starting Event Server on port $EVENT_PORT..."
  HIVE_STATE_DIR="$STATE_DIR" PORT="$EVENT_PORT" npx --prefix "$SERVER_DIR" tsx "$SERVER_DIR/event-server.ts" &
  EVENT_PID=$!
  log "Event Server started (PID $EVENT_PID)"
fi

# Start Next.js Dashboard
if check_port "$DASHBOARD_PORT" "Dashboard"; then
  log "Starting Dashboard on port $DASHBOARD_PORT..."
  (cd "$DASHBOARD_DIR" && NEXT_PUBLIC_WS_URL="ws://localhost:$EVENT_PORT" npm run dev -- --port "$DASHBOARD_PORT") &
  DASHBOARD_PID=$!
  log "Dashboard started (PID $DASHBOARD_PID)"
fi

log "Dashboard: http://localhost:$DASHBOARD_PORT"
log "Event Server: ws://localhost:$EVENT_PORT"
log "Press Ctrl+C to stop"

# Wait for processes
wait
