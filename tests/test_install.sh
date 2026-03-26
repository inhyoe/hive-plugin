#!/usr/bin/env bash
# test_install.sh — Integration tests for hive-plugin install.sh
# Uses sandboxed CLAUDE_HOME (temp dir) to avoid touching real ~/.claude/
#
# Usage: ./tests/test_install.sh
#
# All tests are expected to FAIL until install.sh is implemented (TDD Red).

set -euo pipefail

###############################################################################
# Configuration
###############################################################################

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INSTALL_SCRIPT="$REPO_ROOT/install.sh"

SKILL_NAMES=(
  hive
  hive-workflow
  hive-consensus
  hive-spawn-templates
  hive-quality-gates
  hive-tdd-pipeline
)

# Counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
FAILURES=()

###############################################################################
# Colors
###############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

###############################################################################
# Test Framework Helpers
###############################################################################

setup_sandbox() {
  CLAUDE_HOME="$(mktemp -d)"
  export CLAUDE_HOME
  # Create the base directories that would exist in a real ~/.claude/
  mkdir -p "$CLAUDE_HOME"
}

teardown_sandbox() {
  if [[ -n "${CLAUDE_HOME:-}" && -d "$CLAUDE_HOME" ]]; then
    rm -rf "$CLAUDE_HOME"
  fi
  unset CLAUDE_HOME
}

# assert_eq VALUE_A VALUE_B MESSAGE
# Passes if VALUE_A == VALUE_B
assert_eq() {
  local actual="$1"
  local expected="$2"
  local msg="${3:-assert_eq}"
  if [[ "$actual" == "$expected" ]]; then
    return 0
  else
    echo -e "    ${RED}ASSERT_EQ FAILED${NC}: $msg"
    echo "      expected: '$expected'"
    echo "      actual:   '$actual'"
    return 1
  fi
}

# assert_link PATH [TARGET]
# Passes if PATH is a symlink (and optionally points to TARGET)
assert_link() {
  local path="$1"
  local target="${2:-}"
  if [[ ! -L "$path" ]]; then
    echo -e "    ${RED}ASSERT_LINK FAILED${NC}: '$path' is not a symlink"
    return 1
  fi
  if [[ -n "$target" ]]; then
    local actual_target
    actual_target="$(readlink -f "$path")"
    local expected_target
    expected_target="$(readlink -f "$target")"
    if [[ "$actual_target" != "$expected_target" ]]; then
      echo -e "    ${RED}ASSERT_LINK FAILED${NC}: '$path' points to '$actual_target', expected '$expected_target'"
      return 1
    fi
  fi
  return 0
}

# assert_not_exists PATH
# Passes if PATH does not exist
assert_not_exists() {
  local path="$1"
  if [[ -e "$path" || -L "$path" ]]; then
    echo -e "    ${RED}ASSERT_NOT_EXISTS FAILED${NC}: '$path' exists but should not"
    return 1
  fi
  return 0
}

# assert_file_exists PATH
# Passes if PATH exists as a regular file
assert_file_exists() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo -e "    ${RED}ASSERT_FILE_EXISTS FAILED${NC}: '$path' does not exist or is not a file"
    return 1
  fi
  return 0
}

# assert_dir_exists PATH
# Passes if PATH exists as a directory
assert_dir_exists() {
  local path="$1"
  if [[ ! -d "$path" ]]; then
    echo -e "    ${RED}ASSERT_DIR_EXISTS FAILED${NC}: '$path' does not exist or is not a directory"
    return 1
  fi
  return 0
}

# assert_json_has JSONFILE JQ_FILTER MESSAGE
# Passes if jq filter returns a non-null, non-empty result
assert_json_has() {
  local jsonfile="$1"
  local filter="$2"
  local msg="${3:-assert_json_has}"
  local result
  result="$(jq -r "$filter" "$jsonfile" 2>/dev/null)" || {
    echo -e "    ${RED}ASSERT_JSON_HAS FAILED${NC}: $msg — jq error or file not found"
    return 1
  }
  if [[ -z "$result" || "$result" == "null" ]]; then
    echo -e "    ${RED}ASSERT_JSON_HAS FAILED${NC}: $msg — result is empty/null"
    return 1
  fi
  return 0
}

# assert_json_eq JSONFILE JQ_FILTER EXPECTED MESSAGE
# Passes if jq filter result equals EXPECTED
assert_json_eq() {
  local jsonfile="$1"
  local filter="$2"
  local expected="$3"
  local msg="${4:-assert_json_eq}"
  local result
  result="$(jq -r "$filter" "$jsonfile" 2>/dev/null)" || {
    echo -e "    ${RED}ASSERT_JSON_EQ FAILED${NC}: $msg — jq error or file not found"
    return 1
  }
  if [[ "$result" != "$expected" ]]; then
    echo -e "    ${RED}ASSERT_JSON_EQ FAILED${NC}: $msg"
    echo "      expected: '$expected'"
    echo "      actual:   '$result'"
    return 1
  fi
  return 0
}

# run_test TEST_NAME TEST_FUNCTION
# Wraps a test with setup/teardown and error handling
run_test() {
  local name="$1"
  local func="$2"
  TESTS_RUN=$((TESTS_RUN + 1))
  echo -e "\n${YELLOW}TEST ${TESTS_RUN}${NC}: $name"

  setup_sandbox
  local result=0
  # Run the test function; capture failure
  if "$func"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "  ${GREEN}PASSED${NC}"
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    FAILURES+=("$name")
    echo -e "  ${RED}FAILED${NC}"
  fi
  teardown_sandbox
}

###############################################################################
# Precondition: install.sh must exist
###############################################################################

preflight_check() {
  if [[ ! -x "$INSTALL_SCRIPT" ]]; then
    echo -e "${RED}FATAL${NC}: install.sh not found or not executable at: $INSTALL_SCRIPT"
    echo "All tests will fail (TDD Red state)."
    echo ""
    echo "========================================="
    echo "  RESULTS: 0 passed / 9 failed / 9 total"
    echo "========================================="
    exit 1
  fi
}

###############################################################################
# Test 1: Install creates skill symlinks
###############################################################################
test_skill_symlinks() {
  bash "$INSTALL_SCRIPT" --claude-home "$CLAUDE_HOME"

  local all_ok=true
  for skill in "${SKILL_NAMES[@]}"; do
    if ! assert_link "$CLAUDE_HOME/skills/$skill" "$REPO_ROOT/skills/$skill"; then
      all_ok=false
    fi
  done

  # Verify count — exactly 6 skill symlinks
  local count
  count="$(find "$CLAUDE_HOME/skills" -maxdepth 1 -type l | wc -l)"
  if ! assert_eq "$count" "6" "Expected 6 skill symlinks"; then
    all_ok=false
  fi

  $all_ok
}

###############################################################################
# Test 2: Legacy hive.md backed up and removed
###############################################################################
test_legacy_hive_md_backup() {
  # Set up legacy file
  mkdir -p "$CLAUDE_HOME/commands"
  echo "# Legacy hive command" > "$CLAUDE_HOME/commands/hive.md"

  bash "$INSTALL_SCRIPT" --claude-home "$CLAUDE_HOME"

  local all_ok=true

  # Legacy file should be backed up
  if ! assert_file_exists "$CLAUDE_HOME/commands/hive.md.bak"; then
    all_ok=false
  fi

  # Legacy file should be removed
  if ! assert_not_exists "$CLAUDE_HOME/commands/hive.md"; then
    all_ok=false
  fi

  $all_ok
}

###############################################################################
# Test 3: Scripts symlink
###############################################################################
test_scripts_symlink() {
  bash "$INSTALL_SCRIPT" --claude-home "$CLAUDE_HOME"

  assert_link "$CLAUDE_HOME/hive-scripts" "$REPO_ROOT/scripts"
}

###############################################################################
# Test 4: Dashboard symlink
###############################################################################
test_dashboard_symlink() {
  bash "$INSTALL_SCRIPT" --claude-home "$CLAUDE_HOME"

  assert_link "$CLAUDE_HOME/hive-dashboard" "$REPO_ROOT/dashboard"
}

###############################################################################
# Test 5: Hooks merged, user hooks preserved
###############################################################################
test_hooks_merge_preserves_user() {
  # Create existing settings.json with user hooks
  mkdir -p "$CLAUDE_HOME"
  cat > "$CLAUDE_HOME/settings.json" <<'SETTINGS'
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "echo user-pre-tool-hook"
          }
        ]
      }
    ]
  }
}
SETTINGS

  bash "$INSTALL_SCRIPT" --claude-home "$CLAUDE_HOME"

  local all_ok=true
  local settings="$CLAUDE_HOME/settings.json"

  # User's PreToolUse hook must still exist
  if ! assert_json_has "$settings" \
    '.hooks.PreToolUse[] | select(.hooks[].command == "echo user-pre-tool-hook")' \
    "User PreToolUse hook preserved"; then
    all_ok=false
  fi

  # Plugin SessionStart hook must be added
  if ! assert_json_has "$settings" \
    '.hooks.SessionStart[] | select(.hooks[].command | contains("setup-dashboard"))' \
    "Plugin SessionStart hook added"; then
    all_ok=false
  fi

  # Plugin PostToolUse hook must be added
  if ! assert_json_has "$settings" \
    '.hooks.PostToolUse[] | select(.hooks[].command | contains("validate-skills"))' \
    "Plugin PostToolUse hook added"; then
    all_ok=false
  fi

  $all_ok
}

###############################################################################
# Test 6: --uninstall removes everything
###############################################################################
test_uninstall() {
  # First install
  bash "$INSTALL_SCRIPT" --claude-home "$CLAUDE_HOME"

  # Add a user hook before uninstall to verify it's preserved
  local settings="$CLAUDE_HOME/settings.json"
  # Merge a user hook into the installed settings
  local tmp
  tmp="$(mktemp)"
  jq '.hooks.PreToolUse = [{"matcher": "Bash", "hooks": [{"type": "command", "command": "echo user-hook"}]}]' \
    "$settings" > "$tmp" && mv "$tmp" "$settings"

  # Now uninstall
  bash "$INSTALL_SCRIPT" --uninstall --claude-home "$CLAUDE_HOME"

  local all_ok=true

  # All skill symlinks removed
  for skill in "${SKILL_NAMES[@]}"; do
    if ! assert_not_exists "$CLAUDE_HOME/skills/$skill"; then
      all_ok=false
    fi
  done

  # Scripts symlink removed
  if ! assert_not_exists "$CLAUDE_HOME/hive-scripts"; then
    all_ok=false
  fi

  # Dashboard symlink removed
  if ! assert_not_exists "$CLAUDE_HOME/hive-dashboard"; then
    all_ok=false
  fi

  # Plugin hooks removed from settings.json
  if [[ -f "$settings" ]]; then
    # SessionStart plugin hook should be gone
    local ss_count
    ss_count="$(jq '[.hooks.SessionStart[]? | select(.hooks[]?.command | contains("setup-dashboard"))] | length' "$settings" 2>/dev/null || echo "0")"
    if ! assert_eq "$ss_count" "0" "Plugin SessionStart hook removed after uninstall"; then
      all_ok=false
    fi

    # PostToolUse plugin hook should be gone
    local ptu_count
    ptu_count="$(jq '[.hooks.PostToolUse[]? | select(.hooks[]?.command | contains("validate-skills"))] | length' "$settings" 2>/dev/null || echo "0")"
    if ! assert_eq "$ptu_count" "0" "Plugin PostToolUse hook removed after uninstall"; then
      all_ok=false
    fi

    # User hook must survive
    if ! assert_json_has "$settings" \
      '.hooks.PreToolUse[] | select(.hooks[].command == "echo user-hook")' \
      "User hook preserved after uninstall"; then
      all_ok=false
    fi
  fi

  $all_ok
}

###############################################################################
# Test 7: --dry-run makes no changes
###############################################################################
test_dry_run() {
  bash "$INSTALL_SCRIPT" --dry-run --claude-home "$CLAUDE_HOME"

  local all_ok=true

  # No skill symlinks created
  for skill in "${SKILL_NAMES[@]}"; do
    if ! assert_not_exists "$CLAUDE_HOME/skills/$skill"; then
      all_ok=false
    fi
  done

  # No scripts symlink
  if ! assert_not_exists "$CLAUDE_HOME/hive-scripts"; then
    all_ok=false
  fi

  # No dashboard symlink
  if ! assert_not_exists "$CLAUDE_HOME/hive-dashboard"; then
    all_ok=false
  fi

  # No settings.json created/modified
  if ! assert_not_exists "$CLAUDE_HOME/settings.json"; then
    all_ok=false
  fi

  $all_ok
}

###############################################################################
# Test 8: Idempotent — running twice doesn't break anything
###############################################################################
test_idempotent() {
  # Run install twice
  bash "$INSTALL_SCRIPT" --claude-home "$CLAUDE_HOME"
  bash "$INSTALL_SCRIPT" --claude-home "$CLAUDE_HOME"

  local all_ok=true

  # All skill symlinks still valid
  for skill in "${SKILL_NAMES[@]}"; do
    if ! assert_link "$CLAUDE_HOME/skills/$skill" "$REPO_ROOT/skills/$skill"; then
      all_ok=false
    fi
  done

  # Scripts symlink still valid
  if ! assert_link "$CLAUDE_HOME/hive-scripts" "$REPO_ROOT/scripts"; then
    all_ok=false
  fi

  # Dashboard symlink still valid
  if ! assert_link "$CLAUDE_HOME/hive-dashboard" "$REPO_ROOT/dashboard"; then
    all_ok=false
  fi

  # Hooks not duplicated — count plugin SessionStart entries
  local settings="$CLAUDE_HOME/settings.json"
  local ss_count
  ss_count="$(jq '[.hooks.SessionStart[]? | select(.hooks[]?.command | contains("setup-dashboard"))] | length' "$settings" 2>/dev/null || echo "0")"
  if ! assert_eq "$ss_count" "1" "SessionStart hook not duplicated after double install"; then
    all_ok=false
  fi

  local ptu_count
  ptu_count="$(jq '[.hooks.PostToolUse[]? | select(.hooks[]?.command | contains("validate-skills"))] | length' "$settings" 2>/dev/null || echo "0")"
  if ! assert_eq "$ptu_count" "1" "PostToolUse hook not duplicated after double install"; then
    all_ok=false
  fi

  $all_ok
}

###############################################################################
# Test 9: Real dir backed up before symlink
###############################################################################
test_real_dir_backed_up() {
  # Create a real directory where a symlink should go
  mkdir -p "$CLAUDE_HOME/hive-scripts"
  echo "user-file" > "$CLAUDE_HOME/hive-scripts/my-script.sh"

  bash "$INSTALL_SCRIPT" --claude-home "$CLAUDE_HOME"

  local all_ok=true

  # Original dir should be backed up
  if ! assert_dir_exists "$CLAUDE_HOME/hive-scripts.bak"; then
    all_ok=false
  fi

  # Backup should contain the original file
  if ! assert_file_exists "$CLAUDE_HOME/hive-scripts.bak/my-script.sh"; then
    all_ok=false
  fi

  # New symlink should exist and point to repo scripts
  if ! assert_link "$CLAUDE_HOME/hive-scripts" "$REPO_ROOT/scripts"; then
    all_ok=false
  fi

  $all_ok
}

###############################################################################
# Main
###############################################################################

main() {
  echo "============================================"
  echo "  hive-plugin install.sh — Integration Tests"
  echo "============================================"
  echo "  REPO_ROOT: $REPO_ROOT"
  echo "  INSTALL:   $INSTALL_SCRIPT"
  echo ""

  # Preflight: install.sh must exist and be executable
  preflight_check

  # Run all tests
  run_test "Install creates skill symlinks"            test_skill_symlinks
  run_test "Legacy hive.md backed up and removed"      test_legacy_hive_md_backup
  run_test "Scripts symlink"                           test_scripts_symlink
  run_test "Dashboard symlink"                         test_dashboard_symlink
  run_test "Hooks merged, user hooks preserved"        test_hooks_merge_preserves_user
  run_test "--uninstall removes everything"            test_uninstall
  run_test "--dry-run makes no changes"                test_dry_run
  run_test "Idempotent (double install)"               test_idempotent
  run_test "Real dir backed up before symlink"         test_real_dir_backed_up

  # Summary
  echo ""
  echo "========================================="
  echo -e "  RESULTS: ${GREEN}${TESTS_PASSED} passed${NC} / ${RED}${TESTS_FAILED} failed${NC} / ${TESTS_RUN} total"
  echo "========================================="

  if [[ ${#FAILURES[@]} -gt 0 ]]; then
    echo ""
    echo "Failed tests:"
    for f in "${FAILURES[@]}"; do
      echo -e "  ${RED}✗${NC} $f"
    done
  fi

  # Exit with failure if any test failed
  if [[ $TESTS_FAILED -gt 0 ]]; then
    exit 1
  fi
}

main "$@"
