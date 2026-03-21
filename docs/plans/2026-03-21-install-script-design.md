# Hive Plugin Install Script Design

Date: 2026-03-21

## Goal

Create `install.sh` that installs the hive plugin globally via symlinks, so all Claude Code projects can use `/hive` and its full component set.

## Approach: Symlink

The repo remains the source of truth. `git pull` updates all projects instantly.

## Usage

```bash
bash install.sh              # Install
bash install.sh --uninstall  # Remove
bash install.sh --dry-run    # Preview without changes
```

## Install Steps

1. **Pre-check**: Verify script runs from repo root (plugin.json exists). Create `~/.claude/skills/` if missing.
2. **Legacy cleanup**: If legacy hive command file exists under `~/.claude/commands/`, back up and remove.
3. **Skills symlink**: For each of 6 directories in `skills/`, create symlink in `~/.claude/skills/`. If target exists as a real directory, warn and back up.
4. **Hooks registration**: Read `hooks/hooks.json`, replace `${CLAUDE_PLUGIN_ROOT}` with actual repo path, merge into `~/.claude/settings.json` hooks section (preserve existing user hooks).
5. **Scripts symlink**: `scripts/` -> `~/.claude/hive-scripts`
6. **Dashboard symlink + install**: `dashboard/` -> `~/.claude/hive-dashboard`, run `npm install` in both `dashboard/` and `dashboard/server/`.
7. **Version display**: Read version from `.claude-plugin/plugin.json` and print.

## Uninstall Steps

Reverse of install:
1. Remove skill symlinks (only if they point to this repo)
2. Remove hooks entries from settings.json
3. Remove scripts and dashboard symlinks
4. Do NOT remove backups

## Safety

- Idempotent: re-running updates existing symlinks
- Backs up real files/directories before overwriting with symlinks
- `--dry-run` shows all actions without executing
- Only removes symlinks that point to THIS repo (prevents deleting unrelated files)

## Components

| Component | Source | Target | Method |
|-----------|--------|--------|--------|
| skills (6) | `skills/*` | `~/.claude/skills/` | symlink per dir |
| hooks | `hooks/hooks.json` | `~/.claude/settings.json` | JSON merge |
| scripts | `scripts/` | `~/.claude/hive-scripts` | symlink dir |
| dashboard | `dashboard/` | `~/.claude/hive-dashboard` | symlink dir + npm install |
| legacy cmd | - | `~/.claude/commands/hive.*` | remove + backup |
