#!/usr/bin/env bash
# validate-all.sh — Unified quality gate for hive-plugin SKILL files
# Runs 3 core validators sequentially. Exit 0 = PASS, non-zero = FAIL.
# This script is READ-ONLY: it never modifies any files.
#
# Usage: bash scripts/validate-all.sh
# Hook usage: called by hooks/scripts/validate-skills.sh

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS_DIR="$REPO_ROOT/scripts"

scripts_run=0
scripts_failed=0

run_validator() {
    local name="$1"
    shift
    # Remaining args are the command to execute

    scripts_run=$((scripts_run + 1))
    local output
    local exit_code=0

    output=$("$@" 2>&1) || exit_code=$?

    if [ "$exit_code" -ne 0 ]; then
        scripts_failed=$((scripts_failed + 1))
        echo "[FAIL] $name (exit code $exit_code)"
        echo "$output" | tail -20
        return 1
    else
        echo "[PASS] $name"
        return 0
    fi
}

echo "=== HIVE PLUGIN QUALITY GATE ==="
echo ""

overall_result=0

# 1. Structure validation
run_validator "Structure (validate-plugin.sh)" \
    bash "$SCRIPTS_DIR/validate-plugin.sh" || overall_result=1

echo ""

# 2. Standards validation
run_validator "Standards (validate-standards.sh)" \
    bash "$SCRIPTS_DIR/validate-standards.sh" || overall_result=1

echo ""

# 3. Marker consistency
run_validator "Markers (test_markers.py)" \
    python3 "$SCRIPTS_DIR/test_markers.py" || overall_result=1

echo ""
echo "==========================================="
echo "  QUALITY GATE SUMMARY"
echo "==========================================="
echo "  Validators run : $scripts_run"
echo "  Failed         : $scripts_failed"
echo "==========================================="

if [ "$overall_result" -ne 0 ]; then
    echo "  Result: [VALIDATE-ALL] FAIL"
    echo "==========================================="
    exit 1
else
    echo "  Result: [VALIDATE-ALL] PASS"
    echo "==========================================="
    exit 0
fi
