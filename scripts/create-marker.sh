#!/usr/bin/env bash
# =============================================================================
# create-marker.sh — Sole authorized path for Hive marker creation
# =============================================================================
# Usage: bash scripts/create-marker.sh <gate> [--team-id <id>] [--evidence-file <path>]
#
# Gates: g1, g2, p0, p1, p2, p3, g3, p4, p5
# =============================================================================
set -euo pipefail

if [ "${BASH_VERSINFO[0]}" -lt 4 ]; then
  echo "ERROR: Bash 4+ required (found ${BASH_VERSION}). Install via: brew install bash" >&2
  exit 1
fi

STATE_DIR="${HIVE_STATE_DIR:-.hive-state}"
SESSION_FILE="${STATE_DIR}/session.json"

# ── Argument parsing ──
GATE=""
TEAM_ID=""
EVIDENCE_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --team-id)
      if [[ -z "${2:-}" ]] || [[ "$2" == --* ]]; then
        echo "ERROR: --team-id requires a value" >&2
        exit 1
      fi
      TEAM_ID="$2"
      shift 2
      ;;
    --evidence-file)
      if [[ -z "${2:-}" ]] || [[ "$2" == --* ]]; then
        echo "ERROR: --evidence-file requires a value" >&2
        exit 1
      fi
      EVIDENCE_FILE="$2"
      shift 2
      ;;
    *)
      if [[ -z "$GATE" ]]; then
        GATE="$1"
      else
        echo "ERROR: Unexpected argument '$1' (gate already set to '${GATE}')" >&2
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$GATE" ]]; then
  echo "ERROR: Gate argument required (g1, g2, p0, p1, p2, p3, g3, p4, p5)" >&2
  exit 1
fi

# ── Gate-to-marker mapping ──
declare -A GATE_MAP=(
  [g1]="g1.marker"  [g2]="g2.marker"
  [p0]="p0.marker"  [p1]="p1.marker"  [p2]="p2.marker"  [p3]="p3.marker"
  [g3]="g3.marker"  [p4]="p4.marker"  [p5]="p5.marker"
)

# ── Gate-to-phase mapping (next phase after completing this gate) ──
declare -A GATE_NEXT_PHASE=(
  [g1]="G2"  [g2]="P0"
  [p0]="P1"  [p1]="P2"  [p2]="P3"  [p3]="G3"
  [g3]="P4"  [p4]="P5"  [p5]="DONE"
)

GATE_LOWER="${GATE,,}"
MARKER_NAME="${GATE_MAP[$GATE_LOWER]:-}"

if [[ -z "$MARKER_NAME" ]]; then
  echo "ERROR: Unknown gate '${GATE}'. Valid: g1, g2, p0, p1, p2, p3, g3, p4, p5" >&2
  exit 1
fi

# ── Session validation ──
if [[ ! -f "$SESSION_FILE" ]]; then
  echo "ERROR: No active session (${SESSION_FILE} not found)" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required" >&2
  exit 1
fi

CURRENT_PHASE=$(jq -r '.phase' "$SESSION_FILE")
CURRENT_MODE=$(jq -r '.mode' "$SESSION_FILE")
GATE_UPPER="${GATE_LOWER^^}"

# Validate session is in HIVE mode
if [[ "$CURRENT_MODE" != "HIVE" ]]; then
  echo "ERROR: Session not in HIVE mode (current: ${CURRENT_MODE}). Marker creation blocked." >&2
  exit 1
fi

# Validate current phase matches gate
if [[ "$CURRENT_PHASE" != "$GATE_UPPER" ]]; then
  echo "ERROR: Phase mismatch. Current: ${CURRENT_PHASE}, Gate: ${GATE_UPPER}" >&2
  exit 1
fi

# ── Consensus gates require evidence ──
if [[ "$GATE_LOWER" == "p4" ]]; then
  # Run validate-phase5-entry.sh (mandatory for P4→P5 transition)
  VALIDATE_SCRIPT="scripts/validate-phase5-entry.sh"
  if [[ ! -f "$VALIDATE_SCRIPT" ]]; then
    echo "ERROR: ${VALIDATE_SCRIPT} not found. Phase 5 entry validation is mandatory." >&2
    exit 1
  fi
  echo "Running Phase 5 entry validation..."
  if ! bash "$VALIDATE_SCRIPT"; then
    echo "ERROR: Phase 5 entry validation failed" >&2
    exit 1
  fi
fi

if [[ "$GATE_LOWER" =~ ^(g3|p4)$ ]] && [[ -z "$EVIDENCE_FILE" ]]; then
  echo "WARNING: Consensus gate ${GATE_UPPER} without --evidence-file" >&2
fi

# ── Create marker ──
mkdir -p "$STATE_DIR"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EVIDENCE_HASH=""

if [[ -n "$EVIDENCE_FILE" ]] && [[ -f "$EVIDENCE_FILE" ]]; then
  EVIDENCE_HASH=$(sha256sum "$EVIDENCE_FILE" | cut -d' ' -f1)
fi

cat > "${STATE_DIR}/${MARKER_NAME}" <<MARKER
timestamp: ${TIMESTAMP}
gate: ${GATE_UPPER}
evidence_hash: ${EVIDENCE_HASH:-none}
team_id: ${TEAM_ID:-none}
MARKER

echo "✓ Marker created: ${STATE_DIR}/${MARKER_NAME}"

# ── Update session.json ──
NEXT_PHASE="${GATE_NEXT_PHASE[$GATE_LOWER]}"

if [[ "$NEXT_PHASE" == "DONE" ]]; then
  # Mark session as completed
  if ! jq --arg gate "$GATE_UPPER" \
       '.completedGates += [$gate] | .mode = "DONE"' \
       "$SESSION_FILE" > "${SESSION_FILE}.tmp"; then
    rm -f "${SESSION_FILE}.tmp"
    echo "ERROR: Failed to update session.json" >&2
    exit 1
  fi
  mv "${SESSION_FILE}.tmp" "$SESSION_FILE"
else
  if ! jq --arg gate "$GATE_UPPER" --arg next "$NEXT_PHASE" \
       '.completedGates += [$gate] | .phase = $next' \
       "$SESSION_FILE" > "${SESSION_FILE}.tmp"; then
    rm -f "${SESSION_FILE}.tmp"
    echo "ERROR: Failed to update session.json" >&2
    exit 1
  fi
  mv "${SESSION_FILE}.tmp" "$SESSION_FILE"
fi

echo "✓ Session advanced: ${GATE_UPPER} → ${NEXT_PHASE}"
