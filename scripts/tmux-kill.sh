#!/usr/bin/env bash
# tmux-kill.sh — tmux-bridge CLI 얇은 포워더
# Usage: tmux-kill.sh <provider>
exec node "$(dirname "$0")/../hooks/tmux-bridge/dist/cli.js" kill "$@"
