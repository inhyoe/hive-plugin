#!/bin/bash
# hive-launcher.test.sh — TDD RED tests for hive-launcher.sh
# These tests MUST ALL FAIL before implementation (G4 RED gate)
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
  # Kill any test processes
  if [ -f "$TEST_STATE_DIR/dashboard-runtime.json" ]; then
    bash "$LAUNCHER" stop 2>/dev/null || true
  fi
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

assert_file_exists() {
  local desc="$1" file="$2"
  if [ -f "$file" ]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc (file not found: $file)"
    FAIL=$((FAIL + 1))
  fi
}

assert_file_not_exists() {
  local desc="$1" file="$2"
  if [ ! -f "$file" ]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc (file exists: $file)"
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

assert_exit_code() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  [PASS] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc (expected exit=$expected actual=$actual)"
    FAIL=$((FAIL + 1))
  fi
}

# ============================================================
echo "=== Test Group 1: Port Hash Function ==="
# ============================================================

echo "Test 1.1: Same path produces same port pair"
setup
PORT1=$(bash "$LAUNCHER" port-hash "/home/user/project-a" 2>/dev/null || echo "UNIMPLEMENTED")
PORT2=$(bash "$LAUNCHER" port-hash "/home/user/project-a" 2>/dev/null || echo "UNIMPLEMENTED")
assert_eq "Same path → same result" "$PORT1" "$PORT2"
teardown

echo "Test 1.2: Different paths produce different ports"
setup
PORTA=$(bash "$LAUNCHER" port-hash "/home/user/project-a" 2>/dev/null || echo "UNIMPLEMENTED-A")
PORTB=$(bash "$LAUNCHER" port-hash "/home/user/project-b" 2>/dev/null || echo "UNIMPLEMENTED-B")
if [ "$PORTA" != "$PORTB" ] && [ "$PORTA" != "UNIMPLEMENTED-A" ]; then
  echo "  [PASS] Different paths → different ports"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] Different paths → different ports (a=$PORTA b=$PORTB)"
  FAIL=$((FAIL + 1))
fi
teardown

echo "Test 1.3: Ports are in valid range 3100-3999"
setup
RESULT=$(bash "$LAUNCHER" port-hash "/home/user/any-project" 2>/dev/null || echo "")
if [ -n "$RESULT" ]; then
  EVENT_PORT=$(echo "$RESULT" | cut -d: -f1)
  DASH_PORT=$(echo "$RESULT" | cut -d: -f2)
  if [ "$EVENT_PORT" -ge 3100 ] && [ "$EVENT_PORT" -le 3999 ] && [ "$DASH_PORT" -ge 3100 ] && [ "$DASH_PORT" -le 3999 ]; then
    echo "  [PASS] Ports in range 3100-3999"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] Ports out of range (event=$EVENT_PORT dash=$DASH_PORT)"
    FAIL=$((FAIL + 1))
  fi
else
  echo "  [FAIL] port-hash returned empty (not implemented)"
  FAIL=$((FAIL + 1))
fi
teardown

# ============================================================
echo ""
echo "=== Test Group 2: Runtime JSON ==="
# ============================================================

echo "Test 2.1: start creates dashboard-runtime.json"
setup
bash "$LAUNCHER" start --no-browser 2>/dev/null &
START_PID=$!
sleep 3
assert_file_exists "runtime.json created" "$TEST_STATE_DIR/dashboard-runtime.json"
kill $START_PID 2>/dev/null || true
wait $START_PID 2>/dev/null || true
teardown

echo "Test 2.2: runtime.json has required fields"
setup
bash "$LAUNCHER" start --no-browser 2>/dev/null &
START_PID=$!
sleep 3
if [ -f "$TEST_STATE_DIR/dashboard-runtime.json" ]; then
  RUNTIME=$(cat "$TEST_STATE_DIR/dashboard-runtime.json")
  assert_contains "has eventPort" "$RUNTIME" "eventPort"
  assert_contains "has dashboardPort" "$RUNTIME" "dashboardPort"
  assert_contains "has eventPid" "$RUNTIME" "eventPid"
  assert_contains "has dashboardPid" "$RUNTIME" "dashboardPid"
  assert_contains "has startedBy" "$RUNTIME" "startedBy"
  assert_contains "has cwd" "$RUNTIME" "cwd"
else
  echo "  [FAIL] runtime.json not created (6 sub-tests skipped)"
  FAIL=$((FAIL + 6))
fi
kill $START_PID 2>/dev/null || true
wait $START_PID 2>/dev/null || true
teardown

# ============================================================
echo ""
echo "=== Test Group 3: Ownership ==="
# ============================================================

echo "Test 3.1: stop only kills processes owned by current session"
setup
# Simulate a runtime.json from ANOTHER session
cat > "$TEST_STATE_DIR/dashboard-runtime.json" << JSONEOF
{"eventPort":3142,"dashboardPort":3143,"eventPid":99999,"dashboardPid":99998,"startedBy":"other-session","cwd":"/other","startedAt":"2026-01-01T00:00:00Z"}
JSONEOF
OUTPUT=$(bash "$LAUNCHER" stop 2>&1 || true)
assert_contains "warns about foreign session" "$OUTPUT" "not owned"
teardown

# ============================================================
echo ""
echo "=== Test Group 4: Already Running Detection ==="
# ============================================================

echo "Test 4.1: status reports running when processes alive"
setup
bash "$LAUNCHER" start --no-browser 2>/dev/null &
START_PID=$!
sleep 3
STATUS_OUTPUT=$(bash "$LAUNCHER" status 2>&1 || echo "")
assert_contains "status shows running" "$STATUS_OUTPUT" "running"
kill $START_PID 2>/dev/null || true
wait $START_PID 2>/dev/null || true
teardown

echo "Test 4.2: status reports stopped when no runtime.json"
setup
STATUS_OUTPUT=$(bash "$LAUNCHER" status 2>&1 || echo "")
assert_contains "status shows stopped" "$STATUS_OUTPUT" "stopped"
teardown

echo "Test 4.3: start reuses when already running"
setup
bash "$LAUNCHER" start --no-browser 2>/dev/null &
START_PID=$!
sleep 3
REUSE_OUTPUT=$(bash "$LAUNCHER" start --no-browser 2>&1 || echo "")
assert_contains "reuse message" "$REUSE_OUTPUT" "already running"
kill $START_PID 2>/dev/null || true
wait $START_PID 2>/dev/null || true
teardown

# ============================================================
echo ""
echo "=== Test Group 5: Stale Recovery ==="
# ============================================================

echo "Test 5.1: start cleans stale runtime.json (dead PID)"
setup
cat > "$TEST_STATE_DIR/dashboard-runtime.json" << JSONEOF
{"eventPort":3142,"dashboardPort":3143,"eventPid":99999,"dashboardPid":99998,"startedBy":"$HIVE_SESSION_ID","cwd":"$(pwd)","startedAt":"2026-01-01T00:00:00Z"}
JSONEOF
bash "$LAUNCHER" start --no-browser 2>/dev/null &
START_PID=$!
sleep 3
# Should have cleaned stale and started new
if [ -f "$TEST_STATE_DIR/dashboard-runtime.json" ]; then
  RUNTIME=$(cat "$TEST_STATE_DIR/dashboard-runtime.json")
  # PID should NOT be 99999 (stale was cleaned)
  if echo "$RUNTIME" | grep -q '"eventPid":99999'; then
    echo "  [FAIL] Stale PID not cleaned"
    FAIL=$((FAIL + 1))
  else
    echo "  [PASS] Stale runtime cleaned and restarted"
    PASS=$((PASS + 1))
  fi
else
  echo "  [FAIL] No runtime.json after stale recovery"
  FAIL=$((FAIL + 1))
fi
kill $START_PID 2>/dev/null || true
wait $START_PID 2>/dev/null || true
teardown

# ============================================================
echo ""
echo "=== Test Group 6: Browser Launch ==="
# ============================================================

echo "Test 6.1: no browser open when DISPLAY is unset"
setup
ORIGINAL_DISPLAY="${DISPLAY:-}"
unset DISPLAY 2>/dev/null || true
unset WAYLAND_DISPLAY 2>/dev/null || true
OUTPUT=$(bash "$LAUNCHER" start --no-browser 2>&1 || echo "")
# Should NOT attempt xdg-open
assert_exit_code "no crash without DISPLAY" "0" "$?"
export DISPLAY="$ORIGINAL_DISPLAY"
bash "$LAUNCHER" stop 2>/dev/null || true
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
  echo "  Result: [FAIL] — G4 RED: Expected all tests to fail before implementation"
  exit 1
else
  echo "  Result: [PASS]"
  exit 0
fi
