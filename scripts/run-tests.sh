#!/bin/sh
# run-tests.sh — POSIX sh test runner for hive-plugin
# Runs all test scripts and reports a synthesized summary.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS_DIR="$REPO_ROOT/scripts"

passed=0
failed=0
total=0

run_test() {
    name="$1"
    shift
    total=$((total + 1))

    printf '\n--- %s ---\n' "$name"
    if "$@"; then
        passed=$((passed + 1))
    else
        failed=$((failed + 1))
    fi
}

echo "=== HIVE PLUGIN TEST SUITE ==="

# Structure validation (bash script — must invoke directly)
run_test "[Structure] validate-plugin.sh" "$SCRIPTS_DIR/validate-plugin.sh"

# Marker consistency (python)
run_test "[Markers]   test_markers.py"    python3 "$SCRIPTS_DIR/test_markers.py"

# CCB connectivity (python, always exit 0)
run_test "[CCB]       test_ccb.py"        python3 "$SCRIPTS_DIR/test_ccb.py"

# Gate marker validation
run_test "[Gates]     validate-gates.sh"  "$SCRIPTS_DIR/validate-gates.sh"

# Summary
echo ""
echo "=== TEST SUITE SUMMARY ==="
echo "  Passed: $passed"
echo "  Failed: $failed"
echo "  Total:  $total"

if [ "$failed" -gt 0 ]; then
    echo "  Result: [FAIL]"
    exit 1
else
    echo "  Result: [PASS]"
    exit 0
fi
