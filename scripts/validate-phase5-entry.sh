#!/bin/bash
# validate-phase5-entry.sh — Phase 5 진입 전 필수 검증
# Phase 4 합의가 모든 팀에 대해 완료되었는지 마커 파일로 확인
# Usage: validate-phase5-entry.sh
# Exit 0 = PASS, Exit 1 = FAIL

set -euo pipefail

STATE_DIR="${HIVE_STATE_DIR:-.hive-state}"
TEAMS_FILE="$STATE_DIR/teams.json"
CONSENSUS_DIR="$STATE_DIR/consensus"
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

PASS=0
FAIL=0
ERRORS=()

check() {
  local desc="$1" condition="$2"
  if eval "$condition"; then
    echo -e "  ${GREEN}[PASS]${NC} $desc"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}[FAIL]${NC} $desc"
    FAIL=$((FAIL + 1))
    ERRORS+=("$desc")
  fi
}

echo "=== PHASE 5 ENTRY VALIDATION ==="
echo ""

# 1. G3 Plan Review marker
echo "--- Gate Markers ---"
check "G3 plan-review marker exists" "[ -f '$STATE_DIR/g3-plan-review.marker' ]"

# 2. Teams registry
echo ""
echo "--- Team Registry ---"
check "teams.json exists" "[ -f '$TEAMS_FILE' ]"

if [ ! -f "$TEAMS_FILE" ]; then
  echo ""
  echo -e "${RED}BLOCKED: teams.json missing — cannot validate per-team consensus${NC}"
  echo "Create teams.json in Phase 3 with: {\"teams\":[\"T1\",\"T2\",...]}"
  exit 1
fi

# 3. Per-team consensus markers
echo ""
echo "--- Per-Team Consensus ---"
TEAM_IDS=$(cat "$TEAMS_FILE" | grep -oP '"T[0-9]+"' | tr -d '"' || true)

if [ -z "$TEAM_IDS" ]; then
  echo -e "  ${RED}[FAIL]${NC} No team IDs found in teams.json"
  FAIL=$((FAIL + 1))
  ERRORS+=("No team IDs in teams.json")
else
  for TEAM_ID in $TEAM_IDS; do
    MARKER="$CONSENSUS_DIR/${TEAM_ID}.marker"
    check "$TEAM_ID consensus marker" "[ -f '$MARKER' ]"

    if [ -f "$MARKER" ]; then
      # Verify marker has dialogue evidence (at least "round" mention)
      if grep -q "round" "$MARKER" 2>/dev/null; then
        check "$TEAM_ID has dialogue evidence" "true"
      else
        check "$TEAM_ID has dialogue evidence" "false"
      fi
    fi
  done
fi

# 4. Phase 4 complete marker
echo ""
echo "--- Phase 4 Completion ---"
check "phase4-complete.marker exists" "[ -f '$STATE_DIR/phase4-complete.marker' ]"

# Summary
echo ""
echo "==========================================="
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "==========================================="

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo -e "${RED}BLOCKED: Phase 5 entry denied. Fix these:${NC}"
  for err in "${ERRORS[@]}"; do
    echo "  - $err"
  done
  echo ""
  echo "Each team needs consensus before Phase 5."
  echo "Run Phase 4 consensus loop for missing teams."
  exit 1
else
  # Create validated marker
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) — Phase 5 entry validated" > "$STATE_DIR/phase5-entry.validated"
  echo ""
  echo -e "${GREEN}Phase 5 entry APPROVED${NC}"
  exit 0
fi
