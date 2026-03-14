#!/bin/bash
# hive-launcher.sh — Hive Dashboard lifecycle manager
# Usage: hive-launcher.sh <start|stop|status|port-hash> [options]
#
# Commands:
#   start [--no-browser]  Start event server + dashboard, open browser
#   stop                  Stop processes owned by current session
#   status                Show running state and ports
#   port-hash <path>      Compute deterministic port pair for a project path
#
# Environment:
#   HIVE_STATE_DIR        State directory (default: .hive-state)
#   HIVE_SESSION_ID       Session identifier for ownership tracking
#   HIVE_EVENT_PORT       Override event server port
#   HIVE_DASHBOARD_PORT   Override dashboard port

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DASHBOARD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_DIR="$DASHBOARD_DIR/server"
REPO_ROOT="$(cd "$DASHBOARD_DIR/.." && pwd)"

STATE_DIR="${HIVE_STATE_DIR:-$REPO_ROOT/.hive-state}"
SESSION_ID="${HIVE_SESSION_ID:-hive-$$}"
RUNTIME_FILE="$STATE_DIR/dashboard-runtime.json"
LOCK_DIR="$STATE_DIR/.launcher-lock"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[hive-launcher]${NC} $1"; }
warn() { echo -e "${YELLOW}[hive-launcher]${NC} $1"; }
err() { echo -e "${RED}[hive-launcher]${NC} $1" >&2; }

# === Port Hash ===
cmd_port_hash() {
  local project_path="${1:?Usage: hive-launcher.sh port-hash <path>}"
  local hash
  hash=$(echo -n "$project_path" | cksum | cut -d' ' -f1)
  local offset=$((hash % 450))
  local event_port=$((3100 + offset * 2))
  local dash_port=$((3100 + offset * 2 + 1))
  echo "${event_port}:${dash_port}"
}

# === Port Probe ===
port_available() {
  local port="$1"
  ! lsof -Pi :"$port" -sTCP:LISTEN -t >/dev/null 2>&1
}

find_available_ports() {
  local base_event="$1"
  local base_dash="$2"
  local max_attempts=10

  # Try base ports first
  if port_available "$base_event" && port_available "$base_dash"; then
    echo "${base_event}:${base_dash}"
    return 0
  fi

  # Probe fallback range
  for i in $(seq 1 $max_attempts); do
    local try_event=$((base_event + i * 2))
    local try_dash=$((base_dash + i * 2))
    if [ "$try_event" -gt 3999 ] || [ "$try_dash" -gt 3999 ]; then
      break
    fi
    if port_available "$try_event" && port_available "$try_dash"; then
      echo "${try_event}:${try_dash}"
      return 0
    fi
  done

  err "No available ports found in range 3100-3999 after $max_attempts attempts"
  return 1
}

# === Runtime JSON helpers ===
write_runtime() {
  local event_port="$1" dash_port="$2" event_pid="$3" dash_pid="$4"
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")

  if command -v jq &>/dev/null; then
    jq -cn \
      --argjson ep "$event_port" --argjson dp "$dash_port" \
      --argjson epid "$event_pid" --argjson dpid "$dash_pid" \
      --arg sb "$SESSION_ID" --arg cwd "$(pwd)" --arg ts "$timestamp" \
      '{eventPort:$ep,dashboardPort:$dp,eventPid:$epid,dashboardPid:$dpid,startedBy:$sb,cwd:$cwd,startedAt:$ts}' \
      > "$RUNTIME_FILE"
  else
    # Fallback: escape quotes in values
    local safe_sid safe_cwd
    safe_sid=$(echo "$SESSION_ID" | sed 's/["\]/\\&/g')
    safe_cwd=$(pwd | sed 's/["\]/\\&/g')
    cat > "$RUNTIME_FILE" << JSONEOF
{"eventPort":${event_port},"dashboardPort":${dash_port},"eventPid":${event_pid},"dashboardPid":${dash_pid},"startedBy":"${safe_sid}","cwd":"${safe_cwd}","startedAt":"${timestamp}"}
JSONEOF
  fi
}

read_runtime_field() {
  local field="$1"
  if [ ! -f "$RUNTIME_FILE" ]; then
    echo ""
    return
  fi
  # Simple JSON field extraction without jq dependency
  grep -o "\"${field}\":[^,}]*" "$RUNTIME_FILE" 2>/dev/null | head -1 | sed 's/.*://;s/"//g;s/ //g'
}

process_alive() {
  local pid="$1"
  [ -n "$pid" ] && [ "$pid" != "0" ] && kill -0 "$pid" 2>/dev/null
}

# === Stale Recovery ===
check_and_clean_stale() {
  if [ ! -f "$RUNTIME_FILE" ]; then
    return 1  # no runtime = not running
  fi

  local event_pid dash_pid
  event_pid=$(read_runtime_field "eventPid")
  dash_pid=$(read_runtime_field "dashboardPid")

  # Check by port (more reliable than PID for forked processes)
  local event_port dash_port
  event_port=$(read_runtime_field "eventPort")
  dash_port=$(read_runtime_field "dashboardPort")

  if ! port_available "$event_port" && ! port_available "$dash_port"; then
    return 0  # running (both ports occupied)
  fi

  # Stale: only clean processes we own
  local owner
  owner=$(read_runtime_field "startedBy")
  if [ "$owner" != "$SESSION_ID" ]; then
    warn "Stale runtime from foreign session (owner=$owner), removing runtime file only"
    rm -f "$RUNTIME_FILE"
    return 1  # not running (foreign stale cleaned without killing)
  fi

  warn "Stale runtime detected (owned by us), cleaning up..."
  if process_alive "$event_pid"; then kill "$event_pid" 2>/dev/null || true; fi
  if process_alive "$dash_pid"; then kill "$dash_pid" 2>/dev/null || true; fi
  rm -f "$RUNTIME_FILE"
  return 1  # not running (cleaned)
}

# === Locking ===
acquire_lock() {
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    warn "Another launcher is starting, waiting..."
    local tries=0
    while [ -d "$LOCK_DIR" ] && [ $tries -lt 10 ]; do
      sleep 1
      tries=$((tries + 1))
    done
    if [ -d "$LOCK_DIR" ]; then
      warn "Lock stale, removing"
      rm -rf "$LOCK_DIR"
    fi
    if ! mkdir "$LOCK_DIR" 2>/dev/null; then
      err "Failed to acquire lock after timeout. Another launcher may be running."
      exit 1
    fi
  fi
}

release_lock() {
  rm -rf "$LOCK_DIR" 2>/dev/null || true
}

# === Commands ===

cmd_start() {
  local no_browser=false
  for arg in "$@"; do
    case "$arg" in
      --no-browser) no_browser=true ;;
    esac
  done

  mkdir -p "$STATE_DIR"

  # Check if already running
  if check_and_clean_stale; then
    local existing_dash_port
    existing_dash_port=$(read_runtime_field "dashboardPort")
    log "Dashboard already running on port $existing_dash_port"
    echo "already running"
    if [ "$no_browser" = false ] && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
      xdg-open "http://localhost:$existing_dash_port" 2>/dev/null &
    fi
    return 0
  fi

  acquire_lock
  trap 'release_lock' EXIT

  # Compute ports
  local port_pair base_event base_dash
  port_pair=$(cmd_port_hash "$(pwd)")
  base_event=$(echo "$port_pair" | cut -d: -f1)
  base_dash=$(echo "$port_pair" | cut -d: -f2)

  # Override from env
  base_event="${HIVE_EVENT_PORT:-$base_event}"
  base_dash="${HIVE_DASHBOARD_PORT:-$base_dash}"

  local available
  available=$(find_available_ports "$base_event" "$base_dash") || { release_lock; exit 1; }
  local event_port dash_port
  event_port=$(echo "$available" | cut -d: -f1)
  dash_port=$(echo "$available" | cut -d: -f2)

  log "Starting Event Server on port $event_port..."

  # Ensure dependencies
  if [ ! -d "$SERVER_DIR/node_modules" ]; then
    (cd "$SERVER_DIR" && npm install --silent 2>/dev/null)
  fi
  if [ ! -d "$DASHBOARD_DIR/node_modules" ]; then
    (cd "$DASHBOARD_DIR" && npm install --silent 2>/dev/null)
  fi

  # Start event server
  HIVE_STATE_DIR="$STATE_DIR" PORT="$event_port" npx --prefix "$SERVER_DIR" tsx "$SERVER_DIR/event-server.ts" >/dev/null 2>&1 &
  local event_pid=$!

  # Start dashboard
  log "Starting Dashboard on port $dash_port..."
  (cd "$DASHBOARD_DIR" && NEXT_PUBLIC_WS_URL="ws://localhost:$event_port" npm run dev -- --port "$dash_port" >/dev/null 2>&1) &
  local dash_pid=$!

  sleep 5

  # Verify processes started
  if ! process_alive "$event_pid" || ! process_alive "$dash_pid"; then
    err "Failed to start servers"
    kill "$event_pid" 2>/dev/null || true
    kill "$dash_pid" 2>/dev/null || true
    release_lock
    exit 1
  fi

  # Write runtime
  write_runtime "$event_port" "$dash_port" "$event_pid" "$dash_pid"

  release_lock
  trap - EXIT

  log "Dashboard: http://localhost:$dash_port"
  log "Event Server: ws://localhost:$event_port"

  # Browser open (best-effort)
  if [ "$no_browser" = false ] && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]; then
    xdg-open "http://localhost:$dash_port" 2>/dev/null &
  fi
}

cmd_stop() {
  if [ ! -f "$RUNTIME_FILE" ]; then
    log "No dashboard running (no runtime file)"
    return 0
  fi

  local owner
  owner=$(read_runtime_field "startedBy")

  if [ "$owner" != "$SESSION_ID" ]; then
    warn "Dashboard not owned by this session (owner=$owner, current=$SESSION_ID)"
    warn "Use HIVE_SESSION_ID=$owner to stop, or delete $RUNTIME_FILE manually"
    return 1
  fi

  local event_pid dash_pid
  event_pid=$(read_runtime_field "eventPid")
  dash_pid=$(read_runtime_field "dashboardPid")

  if process_alive "$event_pid"; then
    kill "$event_pid" 2>/dev/null
    log "Event server stopped (PID $event_pid)"
  fi
  if process_alive "$dash_pid"; then
    kill "$dash_pid" 2>/dev/null
    log "Dashboard stopped (PID $dash_pid)"
  fi

  rm -f "$RUNTIME_FILE"
  log "Cleanup complete"
}

cmd_status() {
  if [ ! -f "$RUNTIME_FILE" ]; then
    echo "stopped"
    return 0
  fi

  local event_pid dash_pid event_port dash_port
  event_pid=$(read_runtime_field "eventPid")
  dash_pid=$(read_runtime_field "dashboardPid")
  event_port=$(read_runtime_field "eventPort")
  dash_port=$(read_runtime_field "dashboardPort")

  if ! port_available "$event_port" && ! port_available "$dash_port"; then
    echo "running (dashboard=:$dash_port event=:$event_port)"
  else
    echo "stopped (stale runtime file)"
  fi
}

# === Main ===
COMMAND="${1:-help}"
shift || true

case "$COMMAND" in
  start)     cmd_start "$@" ;;
  stop)      cmd_stop ;;
  status)    cmd_status ;;
  port-hash) cmd_port_hash "$@" ;;
  help|*)
    echo "Usage: hive-launcher.sh <start|stop|status|port-hash> [options]"
    echo "  start [--no-browser]  Start dashboard servers"
    echo "  stop                  Stop servers (owned by current session)"
    echo "  status                Check if dashboard is running"
    echo "  port-hash <path>      Compute port pair for project path"
    exit 0
    ;;
esac
