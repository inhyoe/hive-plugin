# Hive Plugin Install Script — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a symlink-based install/uninstall script that makes the hive plugin globally available in all Claude Code projects.

**Architecture:** Single bash script with `--uninstall` and `--dry-run` flags. Uses symlinks for skills/scripts/dashboard, `jq` for hooks JSON merge. Idempotent and safe (backs up before overwriting).

**Tech Stack:** Bash, jq

---

### Task 1: Rename existing install.sh

The current `install.sh` is for systemd auto-debug only. Rename it to avoid confusion.

**Files:**
- Rename: `install.sh` → `install-systemd.sh`
- Modify: `README.md` (update reference)

**Step 1: Rename the file**

```bash
git mv install.sh install-systemd.sh
```

**Step 2: Update README reference**

In `README.md`, change `bash install.sh` → `bash install-systemd.sh` in the Auto-Debug Timer section. Same for `uninstall.sh` → `uninstall-systemd.sh`.

```bash
git mv uninstall.sh uninstall-systemd.sh
```

**Step 3: Commit**

```bash
git add install-systemd.sh uninstall-systemd.sh README.md
git commit -m "refactor: rename systemd scripts to install-systemd.sh/uninstall-systemd.sh"
```

---

### Task 2: Write the failing test for install.sh

**Files:**
- Create: `tests/test_install.sh`

**Step 1: Write test script**

Test structure uses a sandboxed `CLAUDE_HOME` (temp dir) to avoid touching real `~/.claude/`. Tests verify:

1. Skills symlinks created (6 dirs)
2. Legacy hive command file backed up and removed
3. Scripts symlink created
4. Dashboard symlink created
5. Hooks merged into settings.json (existing hooks preserved)
6. `--uninstall` removes all symlinks and hook entries
7. `--dry-run` makes no changes
8. Idempotent (running twice is safe)
9. Real files backed up before symlink overwrite

```bash
#!/usr/bin/env bash
# tests/test_install.sh — install.sh integration tests
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PASS=0; FAIL=0; TOTAL=0

setup_sandbox() {
  SANDBOX="$(mktemp -d)"
  export CLAUDE_HOME="$SANDBOX/.claude"
  mkdir -p "$CLAUDE_HOME/commands" "$CLAUDE_HOME/skills"
  # Create a fake legacy hive command file
  echo "# old hive v1.4.0" > "$CLAUDE_HOME/commands/hive".md
  # Create a fake existing settings.json with user hooks
  cat > "$CLAUDE_HOME/settings.json" << 'SETTINGS'
{
  "permissions": {"allow": []},
  "hooks": {
    "Stop": [{"matcher": "", "hooks": [{"type": "command", "command": "echo user-hook"}]}]
  }
}
SETTINGS
}

teardown_sandbox() {
  rm -rf "$SANDBOX"
}

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL+1))
  if [ "$expected" = "$actual" ]; then
    echo "  PASS: $desc"
    PASS=$((PASS+1))
  else
    echo "  FAIL: $desc (expected='$expected' actual='$actual')"
    FAIL=$((FAIL+1))
  fi
}

assert_link() {
  local desc="$1" path="$2" target="$3"
  TOTAL=$((TOTAL+1))
  if [ -L "$path" ] && [ "$(readlink -f "$path")" = "$(readlink -f "$target")" ]; then
    echo "  PASS: $desc"
    PASS=$((PASS+1))
  else
    echo "  FAIL: $desc (path=$path not symlink to $target)"
    FAIL=$((FAIL+1))
  fi
}

assert_not_exists() {
  local desc="$1" path="$2"
  TOTAL=$((TOTAL+1))
  if [ ! -e "$path" ] && [ ! -L "$path" ]; then
    echo "  PASS: $desc"
    PASS=$((PASS+1))
  else
    echo "  FAIL: $desc ($path still exists)"
    FAIL=$((FAIL+1))
  fi
}

# --- Test 1: Install creates skill symlinks ---
echo "Test 1: Install creates skill symlinks"
setup_sandbox
bash "$REPO_ROOT/install.sh" --claude-home "$CLAUDE_HOME" >/dev/null 2>&1
for skill in hive hive-workflow hive-consensus hive-spawn-templates hive-quality-gates hive-tdd-pipeline; do
  assert_link "skill $skill" "$CLAUDE_HOME/skills/$skill" "$REPO_ROOT/skills/$skill"
done
teardown_sandbox

# --- Test 2: Legacy hive command backed up and removed ---
echo "Test 2: Legacy hive command cleanup"
setup_sandbox
bash "$REPO_ROOT/install.sh" --claude-home "$CLAUDE_HOME" >/dev/null 2>&1
assert_not_exists "legacy hive removed" "$CLAUDE_HOME/commands/hive".md
assert_eq "backup exists" "true" "$([ -f "$CLAUDE_HOME/commands/hive".md.bak ] && echo true || echo false)"
teardown_sandbox

# --- Test 3: Scripts symlink ---
echo "Test 3: Scripts symlink"
setup_sandbox
bash "$REPO_ROOT/install.sh" --claude-home "$CLAUDE_HOME" >/dev/null 2>&1
assert_link "scripts symlink" "$CLAUDE_HOME/hive-scripts" "$REPO_ROOT/scripts"
teardown_sandbox

# --- Test 4: Dashboard symlink ---
echo "Test 4: Dashboard symlink"
setup_sandbox
bash "$REPO_ROOT/install.sh" --claude-home "$CLAUDE_HOME" >/dev/null 2>&1
assert_link "dashboard symlink" "$CLAUDE_HOME/hive-dashboard" "$REPO_ROOT/dashboard"
teardown_sandbox

# --- Test 5: Hooks merged, user hooks preserved ---
echo "Test 5: Hooks merge preserves user hooks"
setup_sandbox
bash "$REPO_ROOT/install.sh" --claude-home "$CLAUDE_HOME" >/dev/null 2>&1
assert_eq "user Stop hook preserved" "true" \
  "$(jq -e '.hooks.Stop[0].hooks[0].command == "echo user-hook"' "$CLAUDE_HOME/settings.json" 2>/dev/null && echo true || echo false)"
assert_eq "SessionStart hook added" "true" \
  "$(jq -e '.hooks.SessionStart | length > 0' "$CLAUDE_HOME/settings.json" 2>/dev/null && echo true || echo false)"
assert_eq "PostToolUse hook added" "true" \
  "$(jq -e '.hooks.PostToolUse | length > 0' "$CLAUDE_HOME/settings.json" 2>/dev/null && echo true || echo false)"
teardown_sandbox

# --- Test 6: --uninstall removes everything ---
echo "Test 6: Uninstall"
setup_sandbox
bash "$REPO_ROOT/install.sh" --claude-home "$CLAUDE_HOME" >/dev/null 2>&1
bash "$REPO_ROOT/install.sh" --uninstall --claude-home "$CLAUDE_HOME" >/dev/null 2>&1
for skill in hive hive-workflow hive-consensus hive-spawn-templates hive-quality-gates hive-tdd-pipeline; do
  assert_not_exists "skill $skill removed" "$CLAUDE_HOME/skills/$skill"
done
assert_not_exists "scripts removed" "$CLAUDE_HOME/hive-scripts"
assert_not_exists "dashboard removed" "$CLAUDE_HOME/hive-dashboard"
assert_eq "user Stop hook still present" "true" \
  "$(jq -e '.hooks.Stop[0].hooks[0].command == "echo user-hook"' "$CLAUDE_HOME/settings.json" 2>/dev/null && echo true || echo false)"
teardown_sandbox

# --- Test 7: --dry-run makes no changes ---
echo "Test 7: Dry run"
setup_sandbox
bash "$REPO_ROOT/install.sh" --dry-run --claude-home "$CLAUDE_HOME" >/dev/null 2>&1
assert_eq "legacy hive still exists" "true" "$([ -f "$CLAUDE_HOME/commands/hive".md ] && echo true || echo false)"
assert_not_exists "no skill symlink" "$CLAUDE_HOME/skills/hive"
teardown_sandbox

# --- Test 8: Idempotent ---
echo "Test 8: Idempotent (run twice)"
setup_sandbox
bash "$REPO_ROOT/install.sh" --claude-home "$CLAUDE_HOME" >/dev/null 2>&1
bash "$REPO_ROOT/install.sh" --claude-home "$CLAUDE_HOME" >/dev/null 2>&1
for skill in hive hive-workflow hive-consensus hive-spawn-templates hive-quality-gates hive-tdd-pipeline; do
  assert_link "skill $skill after 2nd run" "$CLAUDE_HOME/skills/$skill" "$REPO_ROOT/skills/$skill"
done
teardown_sandbox

# --- Test 9: Real dir backed up before symlink ---
echo "Test 9: Backs up real directory"
setup_sandbox
mkdir -p "$CLAUDE_HOME/skills/hive"
echo "real content" > "$CLAUDE_HOME/skills/hive/README.md"
bash "$REPO_ROOT/install.sh" --claude-home "$CLAUDE_HOME" >/dev/null 2>&1
assert_link "hive is now symlink" "$CLAUDE_HOME/skills/hive" "$REPO_ROOT/skills/hive"
assert_eq "backup dir exists" "true" "$([ -d "$CLAUDE_HOME/skills/hive.bak" ] && echo true || echo false)"
teardown_sandbox

# --- Summary ---
echo ""
echo "Results: $PASS/$TOTAL passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
```

**Step 2: Run test to verify it fails**

```bash
bash tests/test_install.sh
```

Expected: ALL FAIL (install.sh doesn't exist yet as the new version)

**Step 3: Commit**

```bash
git add tests/test_install.sh
git commit -m "test: add install.sh integration tests (all failing — TDD red)"
```

---

### Task 3: Implement install.sh

**Files:**
- Create: `install.sh`

**Step 1: Write install.sh**

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
DRY_RUN=false
UNINSTALL=false

# --- Parse args ---
while [[ $# -gt 0 ]]; do
  case "$1" in
    --uninstall) UNINSTALL=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --claude-home) CLAUDE_HOME="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# --- Pre-check ---
if [ ! -f "$SCRIPT_DIR/.claude-plugin/plugin.json" ]; then
  echo "ERROR: Must run from hive-plugin repo root" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: sudo apt install jq" >&2
  exit 1
fi

VERSION="$(jq -r '.version' "$SCRIPT_DIR/.claude-plugin/plugin.json")"
SKILLS_DIR="$CLAUDE_HOME/skills"
SETTINGS_FILE="$CLAUDE_HOME/settings.json"
COMMANDS_DIR="$CLAUDE_HOME/commands"

SKILL_NAMES=(hive hive-workflow hive-consensus hive-spawn-templates hive-quality-gates hive-tdd-pipeline)

log() { echo "[hive] $*"; }
dry() { if $DRY_RUN; then log "(dry-run) $*"; else log "$*"; fi; }

safe_backup() {
  local path="$1"
  if [ -e "$path" ] && [ ! -L "$path" ]; then
    local bak="${path}.bak"
    dry "Backing up $path → $bak"
    if ! $DRY_RUN; then
      mv "$path" "$bak"
    fi
  fi
}

create_symlink() {
  local target="$1" link="$2"
  if [ -L "$link" ]; then
    dry "Updating symlink $link → $target"
    if ! $DRY_RUN; then
      rm "$link"
      ln -s "$target" "$link"
    fi
  elif [ -e "$link" ]; then
    safe_backup "$link"
    dry "Creating symlink $link → $target"
    if ! $DRY_RUN; then
      ln -s "$target" "$link"
    fi
  else
    dry "Creating symlink $link → $target"
    if ! $DRY_RUN; then
      ln -s "$target" "$link"
    fi
  fi
}

remove_symlink() {
  local link="$1" expected_target="$2"
  if [ -L "$link" ]; then
    local actual
    actual="$(readlink -f "$link")"
    local expected_resolved
    expected_resolved="$(readlink -f "$expected_target")"
    if [ "$actual" = "$expected_resolved" ]; then
      dry "Removing symlink $link"
      if ! $DRY_RUN; then
        rm "$link"
      fi
    else
      log "Skipping $link (points to $actual, not this repo)"
    fi
  fi
}

# =====================
# UNINSTALL
# =====================
if $UNINSTALL; then
  log "Uninstalling hive plugin..."

  # Skills
  for name in "${SKILL_NAMES[@]}"; do
    remove_symlink "$SKILLS_DIR/$name" "$SCRIPT_DIR/skills/$name"
  done

  # Scripts
  remove_symlink "$CLAUDE_HOME/hive-scripts" "$SCRIPT_DIR/scripts"

  # Dashboard
  remove_symlink "$CLAUDE_HOME/hive-dashboard" "$SCRIPT_DIR/dashboard"

  # Hooks: remove hive entries from settings.json
  if [ -f "$SETTINGS_FILE" ] && ! $DRY_RUN; then
    # Remove entries whose command contains the repo path
    local_escaped="$(printf '%s' "$SCRIPT_DIR" | sed 's/[\/&]/\\&/g')"
    TMP="$(mktemp)"
    jq --arg repo "$SCRIPT_DIR" '
      .hooks |= (if . then
        to_entries | map(
          .value |= map(
            .hooks |= map(select(.command | contains($repo) | not))
          ) | map(select(.hooks | length > 0))
        ) | from_entries
      else . end)
    ' "$SETTINGS_FILE" > "$TMP" && mv "$TMP" "$SETTINGS_FILE"
    dry "Removed hive hooks from settings.json"
  elif $DRY_RUN; then
    dry "Would remove hive hooks from settings.json"
  fi

  log "Uninstall complete."
  exit 0
fi

# =====================
# INSTALL
# =====================
log "Installing hive plugin v${VERSION}..."

# 1. Create directories
if ! $DRY_RUN; then
  mkdir -p "$SKILLS_DIR" "$COMMANDS_DIR"
fi

# 2. Legacy cleanup
if [ -f "$COMMANDS_DIR/hive.md" ]; then
  safe_backup "$COMMANDS_DIR/hive.md"
  dry "Removing legacy hive command"
  if ! $DRY_RUN; then
    rm -f "$COMMANDS_DIR/hive.md"
  fi
fi

# 3. Skills symlinks
for name in "${SKILL_NAMES[@]}"; do
  create_symlink "$SCRIPT_DIR/skills/$name" "$SKILLS_DIR/$name"
done

# 4. Hooks merge
if [ -f "$SCRIPT_DIR/hooks/hooks.json" ]; then
  dry "Merging hooks into settings.json"
  if ! $DRY_RUN; then
    # Ensure settings.json exists
    if [ ! -f "$SETTINGS_FILE" ]; then
      echo '{}' > "$SETTINGS_FILE"
    fi

    # Read plugin hooks and replace CLAUDE_PLUGIN_ROOT with actual path
    PLUGIN_HOOKS="$(sed "s|\${CLAUDE_PLUGIN_ROOT}|${SCRIPT_DIR}|g" "$SCRIPT_DIR/hooks/hooks.json")"

    # Merge: for each event type, append plugin hook entries to existing array
    TMP="$(mktemp)"
    echo "$PLUGIN_HOOKS" | jq --slurpfile settings "$SETTINGS_FILE" '
      .hooks as $new |
      ($settings[0] // {}) |
      .hooks //= {} |
      .hooks |= (
        . as $existing |
        ($new | keys[]) as $event |
        $existing |
        .[$event] = ((.[$event] // []) + $new[$event])
      )
    ' > "$TMP" && mv "$TMP" "$SETTINGS_FILE"
  fi
fi

# 5. Scripts symlink
create_symlink "$SCRIPT_DIR/scripts" "$CLAUDE_HOME/hive-scripts"

# 6. Dashboard symlink + npm install
create_symlink "$SCRIPT_DIR/dashboard" "$CLAUDE_HOME/hive-dashboard"
if ! $DRY_RUN && [ -d "$SCRIPT_DIR/dashboard" ]; then
  if [ ! -d "$SCRIPT_DIR/dashboard/node_modules" ]; then
    dry "Installing dashboard dependencies..."
    (cd "$SCRIPT_DIR/dashboard" && npm install --silent 2>/dev/null) || log "WARNING: dashboard npm install failed (non-blocking)"
  fi
  if [ -d "$SCRIPT_DIR/dashboard/server" ] && [ ! -d "$SCRIPT_DIR/dashboard/server/node_modules" ]; then
    dry "Installing event server dependencies..."
    (cd "$SCRIPT_DIR/dashboard/server" && npm install --silent 2>/dev/null) || log "WARNING: server npm install failed (non-blocking)"
  fi
fi

# 7. Done
log "Installed hive plugin v${VERSION} successfully!"
log ""
log "Components:"
log "  Skills:    $SKILLS_DIR/hive (+ 5 sub-skills)"
log "  Scripts:   $CLAUDE_HOME/hive-scripts"
log "  Dashboard: $CLAUDE_HOME/hive-dashboard"
log "  Hooks:     merged into $SETTINGS_FILE"
```

**Step 2: Run tests**

```bash
bash tests/test_install.sh
```

Expected: ALL PASS

**Step 3: Commit**

```bash
git add install.sh
git commit -m "feat: add symlink-based global install script for hive plugin"
```

---

### Task 4: Update README.md

**Files:**
- Modify: `README.md`

**Step 1: Update Installation section**

Replace the Manual Installation section with the new install.sh usage. Keep the old systemd section but reference `install-systemd.sh`.

**Step 2: Commit**

```bash
git add README.md README.ko.md README.ja.md
git commit -m "docs: update installation instructions for new install.sh"
```

---

### Task 5: Final E2E validation

**Step 1: Run full test suite**

```bash
bash tests/test_install.sh
bash scripts/validate-all.sh
```

**Step 2: Manual smoke test**

```bash
# Install to real ~/.claude
bash install.sh

# Verify in another project
cd /tmp && ls -la ~/.claude/skills/hive
```

**Step 3: Verify uninstall**

```bash
bash install.sh --uninstall
ls ~/.claude/skills/hive  # should not exist
```
