#!/usr/bin/env bash
# install.sh — Symlink-based global installer for hive-plugin
#
# Makes the hive plugin available in all Claude Code projects by creating
# symlinks in ~/.claude/ (or a custom CLAUDE_HOME).
#
# Usage:
#   ./install.sh                        # Install to ~/.claude/
#   ./install.sh --claude-home PATH     # Install to custom directory
#   ./install.sh --uninstall            # Remove all installed components
#   ./install.sh --dry-run              # Preview without changes
#   ./install.sh --uninstall --claude-home PATH

set -euo pipefail

###############################################################################
# Constants
###############################################################################

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"

SKILL_NAMES=(
  hive
  hive-workflow
  hive-consensus
  hive-spawn-templates
  hive-quality-gates
  hive-tdd-pipeline
)

HOOKS_JSON="$REPO_ROOT/hooks/hooks.json"

###############################################################################
# Defaults
###############################################################################

CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
DRY_RUN=false
UNINSTALL=false

###############################################################################
# Parse arguments
###############################################################################

while [[ $# -gt 0 ]]; do
  case "$1" in
    --claude-home)
      CLAUDE_HOME="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --uninstall)
      UNINSTALL=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--claude-home PATH] [--uninstall] [--dry-run]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

###############################################################################
# Pre-checks
###############################################################################

if [[ ! -f "$REPO_ROOT/.claude-plugin/plugin.json" ]]; then
  echo "ERROR: Must run from hive-plugin repo root (.claude-plugin/plugin.json not found)" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: sudo apt install jq" >&2
  exit 1
fi

VERSION="$(jq -r '.version' "$REPO_ROOT/.claude-plugin/plugin.json")"

###############################################################################
# Helpers
###############################################################################

info() {
  echo "[hive-plugin] $*"
}

dry_info() {
  echo "[dry-run] would: $*"
}

# safe_symlink TARGET LINK_PATH
# Creates a symlink at LINK_PATH pointing to TARGET.
# If LINK_PATH exists as a real directory, backs it up to .bak first.
# If LINK_PATH exists as a symlink, removes it first.
safe_symlink() {
  local target="$1"
  local link_path="$2"

  if $DRY_RUN; then
    if [[ -d "$link_path" && ! -L "$link_path" ]]; then
      dry_info "backup directory $link_path -> ${link_path}.bak"
    fi
    dry_info "symlink $link_path -> $target"
    return
  fi

  # If it's a real directory (not a symlink), back it up
  if [[ -d "$link_path" && ! -L "$link_path" ]]; then
    info "Backing up existing directory: $link_path -> ${link_path}.bak"
    mv "$link_path" "${link_path}.bak"
  fi

  # If it's an existing symlink, remove it
  if [[ -L "$link_path" ]]; then
    rm "$link_path"
  fi

  ln -s "$target" "$link_path"
  info "Symlinked: $link_path -> $target"
}

# safe_remove_symlink LINK_PATH
# Removes a symlink only if it points into REPO_ROOT
safe_remove_symlink() {
  local link_path="$1"

  if [[ ! -L "$link_path" ]]; then
    return
  fi

  local actual_target
  actual_target="$(readlink -f "$link_path" 2>/dev/null || true)"

  # Only remove if it points into our repo
  if [[ "$actual_target" == "$REPO_ROOT"* ]]; then
    if $DRY_RUN; then
      dry_info "remove symlink $link_path"
    else
      rm "$link_path"
      info "Removed symlink: $link_path"
    fi
  fi
}

###############################################################################
# Install: Skills
###############################################################################

install_skills() {
  local skills_dir="$CLAUDE_HOME/skills"

  if $DRY_RUN; then
    dry_info "create directory $skills_dir"
  else
    mkdir -p "$skills_dir"
  fi

  for skill in "${SKILL_NAMES[@]}"; do
    safe_symlink "$REPO_ROOT/skills/$skill" "$skills_dir/$skill"
  done
}

uninstall_skills() {
  local skills_dir="$CLAUDE_HOME/skills"

  for skill in "${SKILL_NAMES[@]}"; do
    safe_remove_symlink "$skills_dir/$skill"
  done
}

###############################################################################
# Install: Legacy cleanup
###############################################################################

cleanup_legacy() {
  local legacy="$CLAUDE_HOME/commands/hive.md"

  if [[ -f "$legacy" ]]; then
    if $DRY_RUN; then
      dry_info "backup and remove legacy $legacy"
    else
      cp "$legacy" "${legacy}.bak"
      rm "$legacy"
      info "Legacy hive.md backed up and removed"
    fi
  fi
}

###############################################################################
# Install: Scripts & Dashboard symlinks
###############################################################################

install_scripts_symlink() {
  safe_symlink "$REPO_ROOT/scripts" "$CLAUDE_HOME/hive-scripts"
}

install_dashboard_symlink() {
  safe_symlink "$REPO_ROOT/dashboard" "$CLAUDE_HOME/hive-dashboard"
}

uninstall_scripts_symlink() {
  safe_remove_symlink "$CLAUDE_HOME/hive-scripts"
}

uninstall_dashboard_symlink() {
  safe_remove_symlink "$CLAUDE_HOME/hive-dashboard"
}

###############################################################################
# Install: Dashboard npm install (non-fatal)
###############################################################################

install_dashboard_deps() {
  local dashboard_dir="$REPO_ROOT/dashboard"
  if [[ -f "$dashboard_dir/package.json" && ! -d "$dashboard_dir/node_modules" ]]; then
    if $DRY_RUN; then
      dry_info "npm install in $dashboard_dir"
    else
      info "Installing dashboard dependencies..."
      (cd "$dashboard_dir" && npm install 2>/dev/null) || info "npm install skipped (non-fatal)"
    fi
  fi
}

###############################################################################
# Install: Hooks merge
###############################################################################

# Merge plugin hooks into settings.json, preserving existing user hooks.
# Idempotent: skips hooks whose command already contains the repo path.
install_hooks() {
  local settings="$CLAUDE_HOME/settings.json"

  if $DRY_RUN; then
    dry_info "merge hooks into $settings"
    return
  fi

  # Read current settings or start with empty object
  local current_settings
  if [[ -f "$settings" ]]; then
    current_settings="$(cat "$settings")"
  else
    current_settings='{}'
  fi

  # Ensure .hooks exists
  current_settings="$(echo "$current_settings" | jq 'if .hooks == null then .hooks = {} else . end')"

  # Read hooks.json template and substitute CLAUDE_PLUGIN_ROOT
  local plugin_hooks
  plugin_hooks="$(sed "s|\${CLAUDE_PLUGIN_ROOT}|$REPO_ROOT|g" "$HOOKS_JSON")"

  # Get the list of event types from plugin hooks
  local event_types
  event_types="$(echo "$plugin_hooks" | jq -r '.hooks | keys[]')"

  for event_type in $event_types; do
    # Get plugin entries for this event type
    local plugin_entries
    plugin_entries="$(echo "$plugin_hooks" | jq -c ".hooks[\"$event_type\"][]")"

    # Ensure the event type array exists in current settings
    current_settings="$(echo "$current_settings" | jq \
      --arg et "$event_type" \
      'if .hooks[$et] == null then .hooks[$et] = [] else . end')"

    # For each plugin entry, check if it already exists (by repo path in command)
    while IFS= read -r entry; do
      # Check if any hook in current settings for this event type has a command containing REPO_ROOT
      local already_exists
      already_exists="$(echo "$current_settings" | jq \
        --arg et "$event_type" \
        --arg repo "$REPO_ROOT" \
        '[.hooks[$et][] | select(.hooks[]?.command | contains($repo))] | length')"

      if [[ "$already_exists" -eq 0 ]]; then
        # Add the entry
        current_settings="$(echo "$current_settings" | jq \
          --arg et "$event_type" \
          --argjson entry "$entry" \
          '.hooks[$et] += [$entry]')"
        info "Added $event_type hook"
      else
        info "$event_type hook already exists, skipping"
      fi
    done <<< "$plugin_entries"
  done

  echo "$current_settings" | jq '.' > "$settings"
  info "Hooks merged into $settings"
}

# Remove plugin hooks from settings.json (entries whose command contains REPO_ROOT).
# Preserves user hooks. Removes empty event type arrays.
uninstall_hooks() {
  local settings="$CLAUDE_HOME/settings.json"

  if [[ ! -f "$settings" ]]; then
    return
  fi

  if $DRY_RUN; then
    dry_info "remove plugin hooks from $settings"
    return
  fi

  local current_settings
  current_settings="$(cat "$settings")"

  # Get all event types
  local event_types
  event_types="$(echo "$current_settings" | jq -r '.hooks // {} | keys[]' 2>/dev/null || true)"

  for event_type in $event_types; do
    # Filter out entries whose any hook command contains REPO_ROOT
    current_settings="$(echo "$current_settings" | jq \
      --arg et "$event_type" \
      --arg repo "$REPO_ROOT" \
      '.hooks[$et] = [.hooks[$et][] | select((.hooks[]?.command | contains($repo)) | not)]')"
  done

  # Remove event types that became empty arrays
  current_settings="$(echo "$current_settings" | jq \
    '.hooks = (.hooks | to_entries | map(select(.value | length > 0)) | from_entries)')"

  echo "$current_settings" | jq '.' > "$settings"
  info "Plugin hooks removed from $settings"
}

###############################################################################
# Main
###############################################################################

main() {
  if $UNINSTALL; then
    info "Uninstalling hive-plugin from $CLAUDE_HOME..."
    uninstall_skills
    uninstall_scripts_symlink
    uninstall_dashboard_symlink
    uninstall_hooks
    info "Uninstall complete."
  else
    info "Installing hive-plugin v${VERSION} to $CLAUDE_HOME..."
    install_skills
    cleanup_legacy
    install_scripts_symlink
    install_dashboard_symlink
    install_hooks
    install_dashboard_deps
    info "Hive plugin v${VERSION} installed successfully!"
    info ""
    info "Components:"
    info "  Skills:    $CLAUDE_HOME/skills/hive (+ 5 sub-skills)"
    info "  Scripts:   $CLAUDE_HOME/hive-scripts"
    info "  Dashboard: $CLAUDE_HOME/hive-dashboard"
    info "  Hooks:     merged into $CLAUDE_HOME/settings.json"
  fi
}

main
