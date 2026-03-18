#!/usr/bin/env bash
# validate-skills.sh — PostToolUse hook handler for SKILL quality gate
# Triggered after Edit/Write operations on plugin files.
#
# Validation scripts (validate-plugin.sh, validate-standards.sh, test_markers.py)
# are read-only and never modify project files. This hook script creates only
# operational infrastructure files (.hive-state/.validate-lock, .validate-ts).
#
# Environment (set by Claude Code hook system):
#   TOOL_INPUT — JSON string with tool parameters (contains file_path)
#   CLAUDE_PLUGIN_ROOT — plugin installation root
#
# Exit codes:
#   0 = validation passed or skipped (non-matching file)
#   1 = validation failed (blocks further work)
#   2 = gate infrastructure error (blocks further work)

set -uo pipefail

# --- Path resolution ---
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
VALIDATE_SCRIPT="$PLUGIN_ROOT/scripts/validate-all.sh"
LOCK_DIR="$PLUGIN_ROOT/.hive-state"
LOCK_FILE="$LOCK_DIR/.validate-lock"
TS_FILE="$LOCK_DIR/.validate-ts"
DEBOUNCE_SECONDS=3

# --- Extract file_path from TOOL_INPUT ---
FILE_PATH=""
if [ -n "${TOOL_INPUT:-}" ]; then
    # Try jq first (preferred)
    if command -v jq &>/dev/null; then
        FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty' 2>/dev/null || echo "")
    fi
    # Fallback: grep-based extraction if jq unavailable or failed
    if [ -z "$FILE_PATH" ]; then
        FILE_PATH=$(echo "$TOOL_INPUT" | grep -oP '"file_path"\s*:\s*"([^"]*)"' | head -1 | sed 's/.*"\([^"]*\)"/\1/' 2>/dev/null || echo "")
    fi
fi

# If we couldn't extract a file path, skip silently
if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# --- Pattern matching: only validate plugin-related files ---
# Supports both absolute paths (/home/.../skills/hive/SKILL.md)
# and relative paths (skills/hive/SKILL.md)
SHOULD_VALIDATE=false

# Normalize: extract the project-relative portion
REL_PATH="$FILE_PATH"
if [[ "$FILE_PATH" == /* ]]; then
    # Absolute path — strip plugin root prefix if present
    REL_PATH="${FILE_PATH#"$PLUGIN_ROOT"/}"
fi

case "$REL_PATH" in
    skills/*/SKILL.md)             SHOULD_VALIDATE=true ;;
    skills/*/templates/*.md)       SHOULD_VALIDATE=true ;;
    .claude-plugin/*)              SHOULD_VALIDATE=true ;;
    marketplace.json)              SHOULD_VALIDATE=true ;;
    *)                             SHOULD_VALIDATE=false ;;
esac

if [ "$SHOULD_VALIDATE" = false ]; then
    exit 0
fi

# --- Gate infrastructure check ---
if [ ! -f "$VALIDATE_SCRIPT" ]; then
    echo "[QUALITY GATE ERROR] validate-all.sh not found at: $VALIDATE_SCRIPT"
    echo "Gate infrastructure missing — blocking to prevent unvalidated changes."
    exit 2
fi

# --- Timestamp-based debounce ---
# Skip if validation ran within DEBOUNCE_SECONDS ago (true debounce, not just mutex)
mkdir -p "$LOCK_DIR"

if [ -f "$TS_FILE" ]; then
    last_run=$(cat "$TS_FILE" 2>/dev/null || echo 0)
    now=$(date +%s)
    elapsed=$((now - last_run))
    if [ "$elapsed" -lt "$DEBOUNCE_SECONDS" ]; then
        echo "[QUALITY GATE] Skipped — validated ${elapsed}s ago (debounce: ${DEBOUNCE_SECONDS}s)"
        exit 0
    fi
fi

# --- Concurrency lock ---
if command -v flock &>/dev/null; then
    exec 200>"$LOCK_FILE"
    if ! flock -w 5 200; then
        echo "[QUALITY GATE] Skipped — another validation is running (lock timeout 5s)"
        exit 0
    fi

    # Re-check timestamp after acquiring lock (another process may have just run)
    if [ -f "$TS_FILE" ]; then
        last_run=$(cat "$TS_FILE" 2>/dev/null || echo 0)
        now=$(date +%s)
        elapsed=$((now - last_run))
        if [ "$elapsed" -lt "$DEBOUNCE_SECONDS" ]; then
            echo "[QUALITY GATE] Skipped — validated ${elapsed}s ago (debounce after lock)"
            flock -u 200 2>/dev/null || true
            exit 0
        fi
    fi
fi

# --- Run validation ---
echo "[QUALITY GATE] SKILL file modified: $(basename "$FILE_PATH")"
echo "[QUALITY GATE] Running validation..."

bash "$VALIDATE_SCRIPT"
RESULT=$?

# Record timestamp for debounce — only on success
# On failure, do NOT record: next edit must re-run validation
if [ $RESULT -eq 0 ]; then
    date +%s > "$TS_FILE" 2>/dev/null || true
fi

# Release lock
if command -v flock &>/dev/null; then
    flock -u 200 2>/dev/null || true
fi

if [ $RESULT -ne 0 ]; then
    echo ""
    echo "[QUALITY GATE] BLOCKED — Fix validation errors before continuing."
    exit 1
fi

exit 0
