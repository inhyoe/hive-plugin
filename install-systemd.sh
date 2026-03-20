#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${HOME}/.config/claude-auto-debug"
CONFIG_FILE="${CONFIG_DIR}/config.env"
SYSTEMD_USER_DIR="${HOME}/.config/systemd/user"
SERVICE_SOURCE="${SCRIPT_DIR}/systemd/auto-debug.service"
TIMER_TEMPLATE_SOURCE="${SCRIPT_DIR}/systemd/auto-debug.timer.template"
SERVICE_TARGET="${SYSTEMD_USER_DIR}/auto-debug.service"
TIMER_TARGET="${SYSTEMD_USER_DIR}/auto-debug.timer"

read_config_value() {
    local key="$1"
    local file="$2"
    local default_value="$3"
    local line

    line="$(grep -E "^${key}=" "$file" | tail -n 1 || true)"
    if [[ -z "$line" ]]; then
        printf '%s\n' "$default_value"
        return
    fi

    printf '%s\n' "${line#*=}"
}

escape_sed_replacement() {
    printf '%s' "$1" | sed 's/[\/&]/\\&/g'
}

mkdir -p "$CONFIG_DIR" "$SYSTEMD_USER_DIR"

if [[ ! -f "$CONFIG_FILE" ]]; then
    install -m 0644 "${SCRIPT_DIR}/config.example.env" "$CONFIG_FILE"
    echo "Created default config at $CONFIG_FILE"
fi

INTERVAL="$(read_config_value "INTERVAL" "$CONFIG_FILE" "6h")"
INTERVAL="${INTERVAL%$'\r'}"

if [[ -z "$INTERVAL" ]]; then
    INTERVAL="6h"
fi

if [[ "$INTERVAL" == \"*\" && "$INTERVAL" == *\" ]]; then
    INTERVAL="${INTERVAL:1:-1}"
elif [[ "$INTERVAL" == \'*\' && "$INTERVAL" == *\' ]]; then
    INTERVAL="${INTERVAL:1:-1}"
fi

if [[ "$INTERVAL" == *$'\n'* ]]; then
    echo "INTERVAL must be a single-line value" >&2
    exit 1
fi

escaped_interval="$(escape_sed_replacement "$INTERVAL")"
rendered_timer="$(mktemp)"
trap 'rm -f "$rendered_timer"' EXIT

sed "s/%%INTERVAL%%/${escaped_interval}/g" "$TIMER_TEMPLATE_SOURCE" > "$rendered_timer"

install -m 0644 "$SERVICE_SOURCE" "$SERVICE_TARGET"
install -m 0644 "$rendered_timer" "$TIMER_TARGET"

systemctl --user daemon-reload
systemctl --user enable --now auto-debug.timer

echo "Installed user units:"
echo "  $SERVICE_TARGET"
echo "  $TIMER_TARGET"
echo "For 24/7 operation outside an active login session, run:"
echo '  loginctl enable-linger $(whoami)'
echo "Config is stored at $CONFIG_FILE"
echo "Set PROJECT_DIR in that file before relying on automated runs."
