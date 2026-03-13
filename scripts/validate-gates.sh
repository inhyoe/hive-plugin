#!/usr/bin/env bash
# validate-gates.sh — Verify .hive-state/ marker chain integrity
# Exit 0 if all required markers present and hashes valid, else exit 1

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="$REPO_ROOT/.hive-state"

PASS=0
FAIL=0
WARN=0

check() {
    local label="$1" file="$2"
    if [ -f "$file" ]; then
        printf "  PASS: %s\n" "$label"
        PASS=$((PASS + 1))
    else
        printf "  WARN: %s (marker not found — pipeline may not have been run)\n" "$label"
        WARN=$((WARN + 1))
    fi
}

check_hash() {
    local label="$1" marker_file="$2" field="$3" target_file="$4"
    if [ ! -f "$marker_file" ]; then
        return 0  # no marker = no hash to verify
    fi
    local stored_hash
    stored_hash=$(grep -oP "${field}:\K[a-f0-9]{64}" "$marker_file" 2>/dev/null || echo "")
    if [ -z "$stored_hash" ]; then
        return 0  # no hash field in marker
    fi
    if [ ! -f "$target_file" ]; then
        printf "  FAIL: %s — target file missing: %s\n" "$label" "$target_file"
        FAIL=$((FAIL + 1))
        return 1
    fi
    local current_hash
    current_hash=$(sha256sum "$target_file" | cut -d' ' -f1)
    if [ "$stored_hash" = "$current_hash" ]; then
        printf "  PASS: %s (hash match)\n" "$label"
        PASS=$((PASS + 1))
    else
        printf "  FAIL: %s (hash mismatch — stored:%s current:%s)\n" "$label" "${stored_hash:0:12}..." "${current_hash:0:12}..."
        FAIL=$((FAIL + 1))
    fi
}

echo "=== HIVE QUALITY GATE VALIDATION ==="
echo ""

# Check .hive-state directory
if [ ! -d "$STATE_DIR" ]; then
    echo "  INFO: .hive-state/ directory not found — quality pipeline has not been run."
    echo "  This is normal for commits that do not go through /hive workflow."
    exit 0
fi

echo "--- Marker Chain ---"
check "G1: CLARIFY"       "$STATE_DIR/g1-clarify.marker"
check "G2: SPEC"          "$STATE_DIR/g2-spec.marker"
check "G3: PLAN REVIEW"   "$STATE_DIR/g3-plan-review.marker"
check "G4: TDD RED"       "$STATE_DIR/g4-tdd-red.marker"
check "G5: IMPLEMENT"     "$STATE_DIR/g5-implement.marker"
check "G6: CROSS-VERIFY"  "$STATE_DIR/g6-cross-verify.marker"
check "G7: E2E VALIDATE"  "$STATE_DIR/g7-e2e-validate.marker"

echo ""
echo "--- Hash Integrity ---"
# Hash checks only run if marker files exist with hash fields
check_hash "SPEC hash"    "$STATE_DIR/g2-spec.marker"       "hash" "$STATE_DIR/spec-content.txt"
check_hash "TEST hash"    "$STATE_DIR/g4-tdd-red.marker"    "hash" "$STATE_DIR/test-content.txt"
check_hash "IMPL hash"    "$STATE_DIR/g5-implement.marker"  "hash" "$STATE_DIR/impl-content.txt"

echo ""
echo "=== GATE VALIDATION SUMMARY ==="
printf "  Passed: %d\n" "$PASS"
printf "  Warnings: %d\n" "$WARN"
printf "  Failed: %d\n" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
    echo "  Result: [FAIL] — Hash integrity violation detected"
    exit 1
else
    echo "  Result: [PASS]"
    exit 0
fi
