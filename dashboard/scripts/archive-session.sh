#!/bin/bash
# archive-session.sh — Archive completed hive session for history + learning
# Usage: archive-session.sh [session_id]
# Called automatically by hive-workflow after session.summary

set -euo pipefail

STATE_DIR="${HIVE_STATE_DIR:-.hive-state}"
EVENTS_FILE="$STATE_DIR/events.jsonl"
HISTORY_DIR="$STATE_DIR/history"
SESSION_ID="${1:-$(cat "$STATE_DIR/session-id" 2>/dev/null || echo "unknown")}"
MEMORY_DIR="${HIVE_MEMORY_DIR:-$HOME/.claude/projects}"

# Skip if no events
if [ ! -f "$EVENTS_FILE" ] || [ ! -s "$EVENTS_FILE" ]; then
  echo "[archive] No events to archive"
  exit 0
fi

mkdir -p "$HISTORY_DIR"

# Archive events — filter by sessionId only
ARCHIVE_FILE="$HISTORY_DIR/${SESSION_ID}.jsonl"
grep "\"sessionId\":\"${SESSION_ID}\"" "$EVENTS_FILE" > "$ARCHIVE_FILE" || true

# Skip if no matching events
if [ ! -s "$ARCHIVE_FILE" ]; then
  echo "[archive] No events matching session $SESSION_ID"
  rm -f "$ARCHIVE_FILE"
  exit 0
fi

# Generate summary JSON
TOTAL_EVENTS=$(wc -l < "$ARCHIVE_FILE")
TEAMS=$(grep -o '"team.created"' "$ARCHIVE_FILE" 2>/dev/null | wc -l)
PASSED=$(grep -o '"success":true' "$ARCHIVE_FILE" 2>/dev/null | wc -l)
FAILED=$(grep -o '"success":false' "$ARCHIVE_FILE" 2>/dev/null | wc -l)
START_TIME=$(head -1 "$ARCHIVE_FILE" | grep -o '"timestamp":"[^"]*"' | head -1 | sed 's/"timestamp":"//;s/"//')
END_TIME=$(tail -1 "$ARCHIVE_FILE" | grep -o '"timestamp":"[^"]*"' | head -1 | sed 's/"timestamp":"//;s/"//')

# Extract providers used
PROVIDERS=$(grep -o '"provider":"[^"]*"' "$ARCHIVE_FILE" 2>/dev/null | sort -u | sed 's/"provider":"//;s/"//' | tr '\n' ',' | sed 's/,$//')

# Extract team IDs
TEAM_IDS=$(grep -o '"teamId":"[^"]*"' "$ARCHIVE_FILE" 2>/dev/null | sort -u | sed 's/"teamId":"//;s/"//' | tr '\n' ',' | sed 's/,$//')

# Write summary
SUMMARY_FILE="$HISTORY_DIR/${SESSION_ID}.summary.json"
cat > "$SUMMARY_FILE" << JSONEOF
{
  "sessionId": "${SESSION_ID}",
  "startedAt": "${START_TIME}",
  "completedAt": "${END_TIME}",
  "totalEvents": ${TOTAL_EVENTS},
  "teams": ${TEAMS},
  "passed": ${PASSED},
  "failed": ${FAILED},
  "providers": "${PROVIDERS}",
  "teamIds": "${TEAM_IDS}",
  "project": "$(pwd)"
}
JSONEOF

echo "[archive] Session archived: $ARCHIVE_FILE ($TOTAL_EVENTS events, $TEAMS teams)"

# === Learning: Write session insights to auto-memory ===
# Only if we have meaningful data (at least 1 team)
if [ "$TEAMS" -gt 0 ]; then
  LEARNING_FILE="$STATE_DIR/history/${SESSION_ID}.learning.md"
  cat > "$LEARNING_FILE" << LEARNEOF
---
name: hive-session-${SESSION_ID}
description: Hive session ${SESSION_ID} — ${TEAMS} teams, ${PASSED} passed, ${FAILED} failed
type: project
---

Hive session completed: ${SESSION_ID}
- Teams: ${TEAMS} (${TEAM_IDS})
- Providers: ${PROVIDERS}
- Results: ${PASSED} passed, ${FAILED} failed
- Duration: ${START_TIME} → ${END_TIME}
- Project: $(pwd)

**Why:** Track hive execution patterns for future optimization.
**How to apply:** Reference when planning similar tasks — reuse successful team compositions and avoid failed patterns.
LEARNEOF
  echo "[archive] Learning saved: $LEARNING_FILE"
fi
