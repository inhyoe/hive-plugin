#!/usr/bin/env bash
# validate-standards.sh — Validate hive-plugin against official Claude Code standards
# Run: bash scripts/validate-standards.sh
set -euo pipefail

cd "$(dirname "$0")/.."
PASS=0
FAIL=0
WARN=0
ITERATION="${1:-0}"

log_pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
log_fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }
log_warn() { echo "  WARN: $1"; WARN=$((WARN+1)); }

echo "=== Hive Plugin Standards Validation (iteration $ITERATION) ==="
echo ""

# ─── 1. Plugin Manifest ───
echo "--- 1. Plugin Manifest (.claude-plugin/plugin.json) ---"
if [ -f ".claude-plugin/plugin.json" ]; then
    log_pass "plugin.json exists"

    # Validate JSON
    if python3 -c "import json; json.load(open('.claude-plugin/plugin.json'))" 2>/dev/null; then
        log_pass "Valid JSON"
    else
        log_fail "Invalid JSON"
    fi

    # Required field: name
    if python3 -c "import json; d=json.load(open('.claude-plugin/plugin.json')); assert 'name' in d" 2>/dev/null; then
        log_pass "Has 'name' field"
    else
        log_fail "Missing 'name' field"
    fi

    # Semver
    if python3 -c "
import json, re
d=json.load(open('.claude-plugin/plugin.json'))
assert re.match(r'^\d+\.\d+\.\d+$', d.get('version',''))
" 2>/dev/null; then
        log_pass "Semantic versioning"
    else
        log_warn "Version not semver format"
    fi
else
    log_fail "plugin.json missing"
fi
echo ""

# ─── 2. Skill Structure ───
echo "--- 2. Skill Directory Structure ---"
for skill_dir in skills/*/; do
    skill_name=$(basename "$skill_dir")
    if [ -f "$skill_dir/SKILL.md" ]; then
        log_pass "$skill_name/SKILL.md exists"
    else
        log_fail "$skill_name/SKILL.md missing"
    fi
done

# Legacy commands check
if [ -d "commands" ]; then
    log_fail "Legacy commands/ directory exists (should migrate to skills/)"
else
    log_pass "No legacy commands/ directory"
fi
echo ""

# ─── 3. Frontmatter Validation ───
echo "--- 3. Frontmatter Validation ---"
python3 << 'PYEOF'
import os, re, sys

valid_fields = {
    'name', 'description', 'argument-hint', 'disable-model-invocation',
    'user-invocable', 'allowed-tools', 'model', 'context', 'agent', 'hooks'
}
passes = 0
fails = 0

for skill_name in sorted(os.listdir('skills')):
    sp = os.path.join('skills', skill_name, 'SKILL.md')
    if not os.path.exists(sp):
        continue
    with open(sp) as f:
        content = f.read()

    if not content.startswith('---'):
        print(f'  FAIL: {skill_name} missing frontmatter')
        fails += 1
        continue

    fm_end = content.index('---', 3)
    fm = content[3:fm_end].strip()

    # Parse fields
    fields = {}
    for line in fm.split('\n'):
        if ':' in line and not line.startswith(' '):
            key = line.split(':')[0].strip()
            fields[key] = True

    # Name validation
    name_match = re.search(r'^name:\s*(.+)$', fm, re.MULTILINE)
    if name_match:
        name = name_match.group(1).strip()
        if len(name) <= 64 and re.match(r'^[a-z0-9][a-z0-9-]*$', name):
            print(f'  PASS: {skill_name} name="{name}" (valid kebab-case)')
            passes += 1
        else:
            print(f'  FAIL: {skill_name} name="{name}" (invalid)')
            fails += 1

    # Description validation
    desc_match = re.search(r'^description:\s*(.+)$', fm, re.MULTILINE)
    if desc_match:
        desc = desc_match.group(1).strip()
        if '<' in desc or '>' in desc:
            print(f'  FAIL: {skill_name} description contains XML')
            fails += 1
        elif len(desc) > 1024:
            print(f'  FAIL: {skill_name} description too long ({len(desc)})')
            fails += 1
        else:
            print(f'  PASS: {skill_name} description ({len(desc)} chars, no XML)')
            passes += 1

    # Unknown fields
    for key in fields:
        if key not in valid_fields:
            print(f'  WARN: {skill_name} unknown field: {key}')

print(f'  Frontmatter: {passes} pass, {fails} fail')
if fails > 0:
    sys.exit(1)
PYEOF
FM_RESULT=$?
if [ $FM_RESULT -eq 0 ]; then
    log_pass "All frontmatter valid"
else
    log_fail "Frontmatter validation failed"
fi
echo ""

# ─── 4. File Size Check ───
echo "--- 4. File Size (< 500 lines) ---"
for skill_dir in skills/*/; do
    skill_name=$(basename "$skill_dir")
    skill_md="$skill_dir/SKILL.md"
    if [ -f "$skill_md" ]; then
        lines=$(wc -l < "$skill_md")
        if [ "$lines" -lt 500 ]; then
            log_pass "$skill_name/SKILL.md: $lines lines"
        else
            log_fail "$skill_name/SKILL.md: $lines lines (exceeds 500)"
        fi
    fi
done
echo ""

# ─── 5. Description Quality ───
echo "--- 5. Description Quality ---"
python3 << 'PYEOF'
import os, re, sys
passes = 0
fails = 0

for skill_name in sorted(os.listdir('skills')):
    sp = os.path.join('skills', skill_name, 'SKILL.md')
    if not os.path.exists(sp):
        continue
    with open(sp) as f:
        content = f.read()

    fm_end = content.index('---', 3)
    fm = content[3:fm_end]

    desc_match = re.search(r'^description:\s*(.+)$', fm, re.MULTILINE)
    if not desc_match:
        continue
    desc = desc_match.group(1).strip()

    # 3rd person check
    first_word = desc.split()[0].lower() if desc else ''
    if first_word in ('i', 'you', 'we', 'my', 'your'):
        print(f'  FAIL: {skill_name} uses {first_word}-person')
        fails += 1
    else:
        print(f'  PASS: {skill_name} 3rd person')
        passes += 1

    # Trigger check for user-invocable
    user_inv = 'user-invocable: false' not in fm
    has_trigger = any(kw in desc.lower() for kw in ['use when', 'loaded when', 'loaded automatically'])
    if user_inv and not has_trigger:
        print(f'  WARN: {skill_name} missing "when to use" trigger')
    elif has_trigger:
        print(f'  PASS: {skill_name} has trigger words')
        passes += 1

print(f'  Quality: {passes} pass, {fails} fail')
if fails > 0:
    sys.exit(1)
PYEOF
DQ_RESULT=$?
if [ $DQ_RESULT -eq 0 ]; then
    log_pass "All descriptions quality check"
else
    log_fail "Description quality failed"
fi
echo ""

# ─── 6. Cross-References ───
echo "--- 6. Cross-Reference Integrity ---"
python3 << 'PYEOF'
import os, re, sys
errors = 0

# Check markdown links resolve
for root, dirs, files in os.walk('skills'):
    dirs[:] = [d for d in dirs if not d.startswith('.')]
    for fname in files:
        if not fname.endswith('.md'):
            continue
        fpath = os.path.join(root, fname)
        with open(fpath) as f:
            content = f.read()
        links = re.findall(r'\[([^\]]*)\]\(([^)]+)\)', content)
        for text, link in links:
            if link.startswith('http') or link.startswith('#'):
                continue
            target = os.path.normpath(os.path.join(os.path.dirname(fpath), link))
            if not os.path.exists(target):
                print(f'  FAIL: {fpath} broken link: {link}')
                errors += 1
            else:
                print(f'  PASS: {fpath} -> {link}')

# Check referenced skills exist
with open('skills/hive/SKILL.md') as f:
    hc = f.read()
refs = set(re.findall(r'`(hive-[a-z-]+)`', hc))
refs.update(re.findall(r'(hive-[a-z-]+)\s*§', hc))
for ref in sorted(refs):
    if os.path.exists(os.path.join('skills', ref, 'SKILL.md')):
        print(f'  PASS: skill ref {ref}')
    else:
        print(f'  FAIL: skill ref {ref} not found')
        errors += 1

if errors > 0:
    sys.exit(1)
PYEOF
CR_RESULT=$?
if [ $CR_RESULT -eq 0 ]; then
    log_pass "All cross-references valid"
else
    log_fail "Broken cross-references"
fi
echo ""

# ─── 7. Anti-Patterns ───
echo "--- 7. Anti-Pattern Check ---"
# No absolute paths in skills
ABSPATH=$(grep -rn '/home/\|/usr/\|/etc/\|/var/\|/tmp/' skills/ --include='*.md' || true)
if [ -z "$ABSPATH" ]; then
    log_pass "No absolute paths in skills"
else
    log_fail "Absolute paths found: $ABSPATH"
fi

# No Windows paths
WINPATH=$(grep -rn '[A-Z]:\\\\' skills/ --include='*.md' || true)
if [ -z "$WINPATH" ]; then
    log_pass "No Windows paths"
else
    log_fail "Windows paths found"
fi

# No stale references to commands/
STALE=$(grep -rn 'commands/hive\.md' . --include='*.md' || true)
if [ -z "$STALE" ]; then
    log_pass "No stale commands/ references"
else
    log_fail "Stale reference to commands/hive.md: $STALE"
fi
echo ""

# ─── 8. Variable Convention ───
echo "--- 8. Variable Conventions ---"
# $ARGUMENTS in main skill
if grep -q '\$ARGUMENTS' skills/hive/SKILL.md; then
    log_pass "Main skill uses \$ARGUMENTS"
else
    log_fail "Main skill missing \$ARGUMENTS"
fi

# {{VAR}} documentation in spawn-templates
if grep -q '리드.*런타임\|런타임.*치환\|리드.*치환' skills/hive-spawn-templates/SKILL.md; then
    log_pass "{{VAR}} documented as custom runtime substitution"
else
    log_fail "{{VAR}} not documented as custom"
fi
echo ""

# ─── 9. XML Tag Compliance ───
echo "--- 9. XML Tag Compliance ---"
python3 << 'PYEOF'
import os, re, sys
errors = 0

for skill_name in sorted(os.listdir('skills')):
    sp = os.path.join('skills', skill_name, 'SKILL.md')
    if not os.path.exists(sp):
        continue
    with open(sp) as f:
        content = f.read()

    fm_end = content.index('---', 3)
    fm = content[3:fm_end]
    body = content[fm_end+3:]

    # XML in frontmatter = prohibited
    if re.search(r'<[^>]+>', fm):
        print(f'  FAIL: {skill_name} XML in frontmatter')
        errors += 1
    else:
        print(f'  PASS: {skill_name} no XML in frontmatter')

    # XML in body = allowed (just check well-formedness)

if errors > 0:
    sys.exit(1)
PYEOF
XML_RESULT=$?
if [ $XML_RESULT -eq 0 ]; then
    log_pass "XML tag compliance"
else
    log_fail "XML tag violation"
fi
echo ""

# ─── 10. Open Standard Naming ───
echo "--- 10. Agent Skills Open Standard ---"
python3 << 'PYEOF'
import os, re, sys
errors = 0
reserved = {'anthropic', 'claude', 'openai', 'gpt', 'copilot'}

for skill_name in sorted(os.listdir('skills')):
    sp = os.path.join('skills', skill_name, 'SKILL.md')
    if not os.path.exists(sp):
        continue
    with open(sp) as f:
        content = f.read()

    fm_end = content.index('---', 3)
    fm = content[3:fm_end]
    name_match = re.search(r'^name:\s*(.+)$', fm, re.MULTILINE)
    if name_match:
        name = name_match.group(1).strip()
        if name.lower() in reserved:
            print(f'  FAIL: {name} is reserved')
            errors += 1
        else:
            print(f'  PASS: {name} not reserved')

if errors > 0:
    sys.exit(1)
PYEOF
OS_RESULT=$?
if [ $OS_RESULT -eq 0 ]; then
    log_pass "Open standard naming compliance"
else
    log_fail "Reserved name used"
fi
echo ""

# ─── Summary ───
echo "═══════════════════════════════════════"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "  WARN: $WARN"
echo "═══════════════════════════════════════"

if [ $FAIL -eq 0 ]; then
    echo "  RESULT: ALL PASS"
    exit 0
else
    echo "  RESULT: $FAIL FAILURES"
    exit 1
fi
