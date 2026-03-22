#!/usr/bin/env bash
# tmux-pend.sh — tmux-bridge CLI 얇은 포워더
# Usage: tmux-pend.sh <provider> --marker <marker> [--timeout <seconds>]
exec node "$(dirname "$0")/../hooks/tmux-bridge/dist/cli.js" pend "$@"
