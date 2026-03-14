#!/bin/bash
# hive-launcher.test.sh — Unit tests for hive-launcher.sh functions
# Tests pure functions only (no server startup). Server lifecycle tested in G7 E2E.
# Run: bash dashboard/scripts/__tests__/hive-launcher.test.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAUNCHER="$SCRIPT_DIR/../hive-launcher.sh"
TEST_STATE_DIR="/tmp/hive-launcher-test-$$"
PASS=0
FAIL=0

setup() {
  rm -rf "$TEST_STATE_DIR"
  mkdir -p "$TEST_STATE_DIR"
  export HIVE_STATE_DIR="$TEST_STATE_DIR"
  export HIVE_SESSION_ID="test-session-$$"
}

teardown() {
  rm -rf "$TEST_STATE_DIR"
}

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc (expected='$expected' actual='$actual')"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  local desc="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -q "$needle"; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc (not found: '$needle')"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_contains() {
  local desc="$1" haystack="$2" needle="$3"
  if ! echo "$haystack" | grep -q "$needle"; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc (should not contain: '$needle')"
    FAIL=$((FAIL + 1))
  fi
}

# ============================================================
echo "=== Test 1: Port Hash — deterministic ==="
# ============================================================
setup
PORT1=$(bash "$LAUNCHER" port-hash "/home/user/project-a" 2>/dev/null)
PORT2=$(bash "$LAUNCHER" port-hash "/home/user/project-a" 2>/dev/null)
assert_eq "Same path → same port pair" "$PORT1" "$PORT2"
teardown

# ============================================================
echo "=== Test 2: Port Hash — different paths ==="
# ============================================================
setup
PORTA=$(bash "$LAUNCHER" port-hash "/home/user/project-a" 2>/dev/null)
PORTB=$(bash "$LAUNCHER" port-hash "/home/user/project-b" 2>/dev/null)
if [ "$PORTA" != "$PORTB" ]; then
  echo "  [PASS] Different paths → different ports ($PORTA vs $PORTB)"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] Same ports for different paths ($PORTA)"
  FAIL=$((FAIL + 1))
fi
teardown

# ============================================================
echo "=== Test 3: Port Hash — valid range ==="
# ============================================================
setup
RESULT=$(bash "$LAUNCHER" port-hash "/home/user/any-project" 2>/dev/null)
EVENT_PORT=$(echo "$RESULT" | cut -d: -f1)
DASH_PORT=$(echo "$RESULT" | cut -d: -f2)
if [ "$EVENT_PORT" -ge 3100 ] && [ "$EVENT_PORT" -le 3999 ] && [ "$DASH_PORT" -ge 3100 ] && [ "$DASH_PORT" -le 3999 ]; then
  echo "  [PASS] Ports in range 3100-3999 (event=$EVENT_PORT dash=$DASH_PORT)"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] Ports out of range (event=$EVENT_PORT dash=$DASH_PORT)"
  FAIL=$((FAIL + 1))
fi
teardown

# ============================================================
echo "=== Test 4: Port Hash — event and dash are consecutive ==="
# ============================================================
setup
RESULT=$(bash "$LAUNCHER" port-hash "/test/path" 2>/dev/null)
EVENT_PORT=$(echo "$RESULT" | cut -d: -f1)
DASH_PORT=$(echo "$RESULT" | cut -d: -f2)
DIFF=$((DASH_PORT - EVENT_PORT))
assert_eq "Dashboard port = event port + 1" "1" "$DIFF"
teardown

# ============================================================
echo "=== Test 5: Status — stopped when no runtime ==="
# ============================================================
setup
STATUS=$(bash "$LAUNCHER" status 2>/dev/null)
assert_contains "Reports stopped" "$STATUS" "stopped"
teardown

# ============================================================
echo "=== Test 6: Stop — no-op when no runtime ==="
# ============================================================
setup
OUTPUT=$(bash "$LAUNCHER" stop 2>&1)
assert_contains "No dashboard running" "$OUTPUT" "No dashboard running"
teardown

# ============================================================
echo "=== Test 7: Stop — refuses to kill foreign session ==="
# ============================================================
setup
cat > "$TEST_STATE_DIR/dashboard-runtime.json" << 'JSONEOF'
{"eventPort":3142,"dashboardPort":3143,"eventPid":99999,"dashboardPid":99998,"startedBy":"other-session","cwd":"/other","startedAt":"2026-01-01T00:00:00Z"}
JSONEOF
OUTPUT=$(bash "$LAUNCHER" stop 2>&1 || true)
assert_contains "Warns about foreign session" "$OUTPUT" "not owned"
# File should still exist (not deleted)
if [ -f "$TEST_STATE_DIR/dashboard-runtime.json" ]; then
  echo "  [PASS] Runtime file preserved (not deleted)"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] Runtime file was deleted (should be preserved)"
  FAIL=$((FAIL + 1))
fi
teardown

# ============================================================
echo "=== Test 8: Status — stale when PIDs dead + ports free ==="
# ============================================================
setup
cat > "$TEST_STATE_DIR/dashboard-runtime.json" << 'JSONEOF'
{"eventPort":3998,"dashboardPort":3999,"eventPid":99999,"dashboardPid":99998,"startedBy":"test","cwd":"/test","startedAt":"2026-01-01T00:00:00Z"}
JSONEOF
STATUS=$(bash "$LAUNCHER" status 2>/dev/null)
assert_contains "Reports stale" "$STATUS" "stale"
teardown

# ============================================================
echo "=== Test 9: Help command ==="
# ============================================================
setup
OUTPUT=$(bash "$LAUNCHER" help 2>&1)
assert_contains "Shows usage" "$OUTPUT" "Usage"
assert_contains "Shows start command" "$OUTPUT" "start"
assert_contains "Shows stop command" "$OUTPUT" "stop"
assert_contains "Shows status command" "$OUTPUT" "status"
teardown

# ============================================================
echo "=== Test 10: Port Hash — many projects no collision ==="
# ============================================================
setup
COLLISION=0
declare -A SEEN_PORTS
for i in $(seq 1 20); do
  P=$(bash "$LAUNCHER" port-hash "/project/path-$i" 2>/dev/null)
  if [ -n "${SEEN_PORTS[$P]:-}" ]; then
    COLLISION=$((COLLISION + 1))
  fi
  SEEN_PORTS[$P]=1
done
if [ "$COLLISION" -le 2 ]; then
  echo "  [PASS] Low collision rate ($COLLISION/20)"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] High collision rate ($COLLISION/20)"
  FAIL=$((FAIL + 1))
fi
teardown

# ============================================================
echo ""
echo "==========================================="
echo "  TEST SUMMARY"
echo "==========================================="
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
echo "  Total:  $((PASS + FAIL))"
echo "==========================================="

if [ "$FAIL" -gt 0 ]; then
  echo "  Result: [FAIL]"
  exit 1
else
  echo "  Result: [PASS]"
  exit 0
fi
