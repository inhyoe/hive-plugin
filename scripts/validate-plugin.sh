#!/usr/bin/env bash
# validate-plugin.sh — Hive Plugin Structure Validator
# Validates 6 checks per R2 TASK PROPOSAL:
#   1. Directory structure: auto-detect skill dirs with SKILL.md
#   2. SKILL.md frontmatter: name + description + user-invocable required
#   3. commands/*.md frontmatter: name + description + allowed-tools (exists + non-empty)
#   4. Line count: SKILL.md/commands = 500, templates = 200
#   5. Supporting files: Markdown link regex -> relative path resolution -> file existence
#   6. Frontmatter values: name matches directory name, user-invocable is boolean

set -euo pipefail

# --- Config ---
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL_CMD_LINE_LIMIT=500
TEMPLATE_LINE_LIMIT=200

# --- Counters ---
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

# --- Output helpers ---
pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  echo "  [PASS] $1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  echo "  [FAIL] $1"
}

header() {
  echo ""
  echo "=== $1 ==="
}

# --- Frontmatter parser ---
# Extracts a frontmatter field value from a file.
# Usage: get_frontmatter_field <file> <field_name>
# Returns the value (trimmed) or empty string if not found.
get_frontmatter_field() {
  local file="$1"
  local field="$2"
  local in_frontmatter=false
  local value=""

  while IFS= read -r line; do
    if [[ "$line" == "---" ]]; then
      if $in_frontmatter; then
        break  # end of frontmatter
      else
        in_frontmatter=true
        continue
      fi
    fi
    if $in_frontmatter; then
      # Match field: value (field is kebab-case)
      if [[ "$line" =~ ^${field}:(.*)$ ]]; then
        value="${BASH_REMATCH[1]}"
        # Trim leading/trailing whitespace
        value="$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
      fi
    fi
  done < "$file"

  echo "$value"
}

# Check if frontmatter field exists (even if empty)
has_frontmatter_field() {
  local file="$1"
  local field="$2"
  local in_frontmatter=false

  while IFS= read -r line; do
    if [[ "$line" == "---" ]]; then
      if $in_frontmatter; then
        break
      else
        in_frontmatter=true
        continue
      fi
    fi
    if $in_frontmatter; then
      if [[ "$line" =~ ^${field}: ]]; then
        return 0
      fi
    fi
  done < "$file"

  return 1
}

# ============================================================
# CHECK 1: Directory structure — auto-detect skill dirs
# ============================================================
header "Check 1: Directory Structure (auto-detect skills with SKILL.md)"

SKILL_DIRS=()
if [[ -d "$REPO_ROOT/skills" ]]; then
  for dir in "$REPO_ROOT/skills"/*/; do
    if [[ -d "$dir" ]]; then
      dir_name="$(basename "$dir")"
      if [[ -f "$dir/SKILL.md" ]]; then
        pass "skills/$dir_name/ has SKILL.md"
        SKILL_DIRS+=("$dir")
      else
        fail "skills/$dir_name/ missing SKILL.md"
      fi
    fi
  done
else
  fail "skills/ directory not found"
fi

# commands/ is legacy (migrated to skills/) — skip if absent
if [[ -d "$REPO_ROOT/commands" ]]; then
  cmd_files=("$REPO_ROOT/commands"/*.md)
  if [[ -e "${cmd_files[0]}" ]]; then
    for f in "${cmd_files[@]}"; do
      pass "commands/$(basename "$f") exists"
    done
  else
    echo "  (commands/ directory is empty — skipped)"
  fi
else
  pass "commands/ directory absent (migrated to skills/) — OK"
fi

# ============================================================
# CHECK 2: SKILL.md frontmatter — name + description + user-invocable
# ============================================================
header "Check 2: SKILL.md Frontmatter (name + description + user-invocable)"

for skill_dir in "${SKILL_DIRS[@]}"; do
  skill_file="$skill_dir/SKILL.md"
  dir_name="$(basename "$skill_dir")"

  # Check name field
  if has_frontmatter_field "$skill_file" "name"; then
    name_val="$(get_frontmatter_field "$skill_file" "name")"
    if [[ -n "$name_val" ]]; then
      pass "skills/$dir_name/SKILL.md: 'name' field present and non-empty"
    else
      fail "skills/$dir_name/SKILL.md: 'name' field is empty"
    fi
  else
    fail "skills/$dir_name/SKILL.md: 'name' field missing"
  fi

  # Check description field
  if has_frontmatter_field "$skill_file" "description"; then
    desc_val="$(get_frontmatter_field "$skill_file" "description")"
    if [[ -n "$desc_val" ]]; then
      pass "skills/$dir_name/SKILL.md: 'description' field present and non-empty"
    else
      fail "skills/$dir_name/SKILL.md: 'description' field is empty"
    fi
  else
    fail "skills/$dir_name/SKILL.md: 'description' field missing"
  fi

  # Check user-invocable field (optional per spec — defaults to true if absent)
  if has_frontmatter_field "$skill_file" "user-invocable"; then
    ui_val="$(get_frontmatter_field "$skill_file" "user-invocable")"
    if [[ -n "$ui_val" ]]; then
      pass "skills/$dir_name/SKILL.md: 'user-invocable' field present and non-empty"
    else
      fail "skills/$dir_name/SKILL.md: 'user-invocable' field is empty"
    fi
  else
    pass "skills/$dir_name/SKILL.md: 'user-invocable' field absent (defaults to true per spec)"
  fi
done

# ============================================================
# CHECK 3: commands/*.md frontmatter — name + description + allowed-tools
# ============================================================
header "Check 3: commands/*.md Frontmatter (name + description + allowed-tools)"

if [[ -d "$REPO_ROOT/commands" ]]; then
  for cmd_file in "$REPO_ROOT/commands"/*.md; do
    [[ -e "$cmd_file" ]] || continue
    cmd_name="$(basename "$cmd_file")"

    # Check name field
    if has_frontmatter_field "$cmd_file" "name"; then
      name_val="$(get_frontmatter_field "$cmd_file" "name")"
      if [[ -n "$name_val" ]]; then
        pass "commands/$cmd_name: 'name' field present and non-empty"
      else
        fail "commands/$cmd_name: 'name' field is empty"
      fi
    else
      fail "commands/$cmd_name: 'name' field missing"
    fi

    # Check description field
    if has_frontmatter_field "$cmd_file" "description"; then
      desc_val="$(get_frontmatter_field "$cmd_file" "description")"
      if [[ -n "$desc_val" ]]; then
        pass "commands/$cmd_name: 'description' field present and non-empty"
      else
        fail "commands/$cmd_name: 'description' field is empty"
      fi
    else
      fail "commands/$cmd_name: 'description' field missing"
    fi

    # Check allowed-tools field (must exist AND be non-empty)
    if has_frontmatter_field "$cmd_file" "allowed-tools"; then
      at_val="$(get_frontmatter_field "$cmd_file" "allowed-tools")"
      if [[ -n "$at_val" ]]; then
        pass "commands/$cmd_name: 'allowed-tools' field present and non-empty"
      else
        fail "commands/$cmd_name: 'allowed-tools' field is empty"
      fi
    else
      fail "commands/$cmd_name: 'allowed-tools' field missing"
    fi
  done
fi

# ============================================================
# CHECK 4: Line count limits
#   SKILL.md + commands/*.md: 500 lines
#   templates/*.md: 200 lines
# ============================================================
header "Check 4: Line Count Limits (SKILL.md/commands: ${SKILL_CMD_LINE_LIMIT}, templates: ${TEMPLATE_LINE_LIMIT})"

# SKILL.md files
for skill_dir in "${SKILL_DIRS[@]}"; do
  skill_file="$skill_dir/SKILL.md"
  dir_name="$(basename "$skill_dir")"
  line_count="$(wc -l < "$skill_file")"

  if [[ "$line_count" -le "$SKILL_CMD_LINE_LIMIT" ]]; then
    pass "skills/$dir_name/SKILL.md: ${line_count} lines (<= ${SKILL_CMD_LINE_LIMIT})"
  else
    fail "skills/$dir_name/SKILL.md: ${line_count} lines (> ${SKILL_CMD_LINE_LIMIT})"
  fi
done

# commands/*.md files
if [[ -d "$REPO_ROOT/commands" ]]; then
  for cmd_file in "$REPO_ROOT/commands"/*.md; do
    [[ -e "$cmd_file" ]] || continue
    cmd_name="$(basename "$cmd_file")"
    line_count="$(wc -l < "$cmd_file")"

    if [[ "$line_count" -le "$SKILL_CMD_LINE_LIMIT" ]]; then
      pass "commands/$cmd_name: ${line_count} lines (<= ${SKILL_CMD_LINE_LIMIT})"
    else
      fail "commands/$cmd_name: ${line_count} lines (> ${SKILL_CMD_LINE_LIMIT})"
    fi
  done
fi

# templates/*.md files (search recursively under skills/)
template_found=false
while IFS= read -r -d '' tpl_file; do
  template_found=true
  tpl_rel="${tpl_file#$REPO_ROOT/}"
  line_count="$(wc -l < "$tpl_file")"

  if [[ "$line_count" -le "$TEMPLATE_LINE_LIMIT" ]]; then
    pass "$tpl_rel: ${line_count} lines (<= ${TEMPLATE_LINE_LIMIT})"
  else
    fail "$tpl_rel: ${line_count} lines (> ${TEMPLATE_LINE_LIMIT})"
  fi
done < <(find "$REPO_ROOT/skills" -path "*/templates/*.md" -print0 2>/dev/null)

if ! $template_found; then
  echo "  (no template files found — skipped)"
fi

# ============================================================
# CHECK 5: Supporting file references
#   Parse Markdown links [text](path) in SKILL.md -> resolve relative -> check existence
#   No references = "no refs — PASS"
# ============================================================
header "Check 5: Supporting File References (Markdown link target existence)"

for skill_dir in "${SKILL_DIRS[@]}"; do
  skill_file="$skill_dir/SKILL.md"
  dir_name="$(basename "$skill_dir")"
  ref_count=0

  # Extract Markdown links: [text](path) — exclude URLs (http/https)
  while IFS= read -r link_target; do
    # Skip URLs
    if [[ "$link_target" =~ ^https?:// ]]; then
      continue
    fi
    # Skip anchor-only links
    if [[ "$link_target" =~ ^# ]]; then
      continue
    fi
    # Strip anchor from path (e.g., file.md#section -> file.md)
    link_path="${link_target%%#*}"
    if [[ -z "$link_path" ]]; then
      continue
    fi

    ref_count=$((ref_count + 1))

    # Resolve relative to the SKILL.md's directory
    resolved_path="$(cd "$skill_dir" && realpath -m "$link_path")"

    if [[ -e "$resolved_path" ]]; then
      pass "skills/$dir_name/SKILL.md -> $link_target (exists)"
    else
      fail "skills/$dir_name/SKILL.md -> $link_target (file not found: $resolved_path)"
    fi
  done < <(grep -oP '\[(?:[^\]]*)\]\(\K[^)]+(?=\))' "$skill_file" 2>/dev/null || true)

  if [[ "$ref_count" -eq 0 ]]; then
    pass "skills/$dir_name/SKILL.md: no file references — PASS"
  fi
done

# ============================================================
# CHECK 6: Frontmatter value validation
#   - name matches directory name (for SKILL.md)
#   - user-invocable is boolean (true/false)
# ============================================================
header "Check 6: Frontmatter Value Validation (name=dirname, user-invocable=boolean)"

for skill_dir in "${SKILL_DIRS[@]}"; do
  skill_file="$skill_dir/SKILL.md"
  dir_name="$(basename "$skill_dir")"

  # Check name matches directory name
  name_val="$(get_frontmatter_field "$skill_file" "name")"
  if [[ "$name_val" == "$dir_name" ]]; then
    pass "skills/$dir_name/SKILL.md: name='$name_val' matches directory name"
  else
    fail "skills/$dir_name/SKILL.md: name='$name_val' does not match directory name '$dir_name'"
  fi

  # Check user-invocable is boolean (or absent = defaults to true)
  if has_frontmatter_field "$skill_file" "user-invocable"; then
    ui_val="$(get_frontmatter_field "$skill_file" "user-invocable")"
    if [[ "$ui_val" == "true" || "$ui_val" == "false" ]]; then
      pass "skills/$dir_name/SKILL.md: user-invocable='$ui_val' is valid boolean"
    else
      fail "skills/$dir_name/SKILL.md: user-invocable='$ui_val' is not a boolean (expected true/false)"
    fi
  else
    pass "skills/$dir_name/SKILL.md: user-invocable absent (defaults to true per spec)"
  fi
done

# ============================================================
# Summary
# ============================================================
echo ""
echo "==========================================="
echo "  VALIDATION SUMMARY"
echo "==========================================="
echo "  Total checks : $TOTAL_COUNT"
echo "  Passed       : $PASS_COUNT"
echo "  Failed       : $FAIL_COUNT"
echo "==========================================="

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  echo "  Result: [FAIL]"
  echo "==========================================="
  exit 1
else
  echo "  Result: [PASS]"
  echo "==========================================="
  exit 0
fi
