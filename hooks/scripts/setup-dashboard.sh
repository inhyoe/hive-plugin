#!/bin/bash
# setup-dashboard.sh — Auto-install dashboard dependencies on SessionStart
# Runs silently if already installed, installs on first use.

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
DASHBOARD_DIR="$PLUGIN_ROOT/dashboard"
SERVER_DIR="$DASHBOARD_DIR/server"

# Skip if dashboard directory doesn't exist
if [ ! -d "$DASHBOARD_DIR" ]; then
  exit 0
fi

# Install dashboard dependencies (skip if already installed)
if [ ! -d "$DASHBOARD_DIR/node_modules" ]; then
  echo "[hive] Installing dashboard dependencies..."
  (cd "$DASHBOARD_DIR" && npm install --silent 2>/dev/null) || true
fi

# Install event server dependencies
if [ -d "$SERVER_DIR" ] && [ ! -d "$SERVER_DIR/node_modules" ]; then
  echo "[hive] Installing event server dependencies..."
  (cd "$SERVER_DIR" && npm install --silent 2>/dev/null) || true
fi

# Export plugin root for hive skills
export HIVE_PLUGIN_DIR="$PLUGIN_ROOT"
