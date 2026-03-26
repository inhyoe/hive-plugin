#!/usr/bin/env bash
# tmux-pend.sh — tmux-bridge CLI 얇은 포워더
# Usage: tmux-pend.sh <provider> --marker <marker> [--timeout <seconds>]

# Resolve repo root: env override → readlink fallback
if [[ -n "${CLAUDE_PLUGIN_ROOT:-}" ]]; then
  HIVE_ROOT="$CLAUDE_PLUGIN_ROOT"
elif [[ -n "${HIVE_PLUGIN_DIR:-}" ]]; then
  HIVE_ROOT="$HIVE_PLUGIN_DIR"
else
  HIVE_ROOT="$(cd "$(dirname "$(readlink -f "$0")")" && cd .. && pwd)"
fi

exec node "${HIVE_ROOT}/hooks/tmux-bridge/dist/cli.js" pend "$@"
