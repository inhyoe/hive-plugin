#!/usr/bin/env bash
# tmux-ask.sh — tmux-bridge CLI 얇은 포워더
# Usage: tmux-ask.sh <provider> "<prompt>" [--wait] [--followup] [--marker <marker>]
exec node "$(dirname "$0")/../hooks/tmux-bridge/dist/cli.js" ask "$@"
