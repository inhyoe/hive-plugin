#!/bin/bash
# emit-event.sh — Append a structured event to .hive-state/events.jsonl
# Usage: emit-event.sh <event_type> <session_id> '<json_payload>'
# Example: emit-event.sh phase.transition ses-001 '{"phase":0,"status":"enter"}'

set -euo pipefail

EVENT_TYPE="${1:?Usage: emit-event.sh <type> <session_id> '<payload>'}"
SESSION_ID="${2:?Missing session_id}"
PAYLOAD="${3:?Missing JSON payload}"

STATE_DIR="${HIVE_STATE_DIR:-.hive-state}"
EVENTS_FILE="${STATE_DIR}/events.jsonl"

mkdir -p "$STATE_DIR"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")

# Build JSON line using jq if available, else printf
if command -v jq &>/dev/null; then
  EVENT=$(jq -cn \
    --arg type "$EVENT_TYPE" \
    --arg ts "$TIMESTAMP" \
    --arg sid "$SESSION_ID" \
    --argjson payload "$PAYLOAD" \
    '{type: $type, timestamp: $ts, sessionId: $sid, payload: $payload}')
else
  EVENT="{\"type\":\"${EVENT_TYPE}\",\"timestamp\":\"${TIMESTAMP}\",\"sessionId\":\"${SESSION_ID}\",\"payload\":${PAYLOAD}}"
fi

echo "$EVENT" >> "$EVENTS_FILE"
