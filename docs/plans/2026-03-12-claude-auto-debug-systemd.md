# Claude Auto-Debug Systemd Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add rootless `systemd --user` integration for the Claude Auto-Debug deployment module, including install and uninstall scripts plus a user-editable config file.

**Architecture:** Ship a static `oneshot` service unit and a timer template with an `%%INTERVAL%%` placeholder. The installer creates `~/.config/claude-auto-debug/config.env` if needed, renders the timer into `~/.config/systemd/user/`, reloads the user daemon, and enables the timer. The uninstaller disables the timer, removes only the installed unit files, and preserves user config.

**Tech Stack:** Bash, `systemd --user`, POSIX-style unit files, repo-local shell verification

---

### Task 1: Add the static unit and config template

**Files:**
- Create: `systemd/auto-debug.service`
- Create: `systemd/auto-debug.timer.template`
- Create: `config.example.env`

**Step 1: Write the target file content**

Create a `oneshot` service that runs `%h/.local/bin/claude-auto-debug/bin/auto-debug.sh`, loads `%h/.config/claude-auto-debug/config.env`, logs to the user journal, and runs from `%h`.

Create a timer template with `OnUnitActiveSec=%%INTERVAL%%`, `Persistent=true`, and `WantedBy=timers.target`.

Create a commented config example with `PROJECT_DIR`, `VALIDATION_CMD`, `ALLOWED_TOOLS`, `MAX_FILES`, `LOG_RETENTION_DAYS`, and `INTERVAL`.

**Step 2: Verify the files are syntactically plausible**

Run: `sed -n '1,200p' systemd/auto-debug.service systemd/auto-debug.timer.template config.example.env`

Expected: all three files exist and contain the agreed fields.

### Task 2: Add the installer and uninstaller

**Files:**
- Create: `install.sh`
- Create: `uninstall.sh`

**Step 1: Write install behavior**

Implement a Bash installer that:
- creates `~/.config/claude-auto-debug/` and `~/.config/systemd/user/`
- copies `config.example.env` to `config.env` only when missing
- reads `INTERVAL` from `config.env`, defaulting to `6h`
- renders `systemd/auto-debug.timer.template` into `auto-debug.timer`
- installs the service and timer units
- runs `systemctl --user daemon-reload`
- runs `systemctl --user enable --now auto-debug.timer`
- prints the `loginctl enable-linger "$(whoami)"` guidance

**Step 2: Write uninstall behavior**

Implement a Bash uninstaller that:
- runs `systemctl --user disable --now auto-debug.timer || true`
- removes `~/.config/systemd/user/auto-debug.service` and `auto-debug.timer`
- runs `systemctl --user daemon-reload`
- prints that config remains under `~/.config/claude-auto-debug/`

### Task 3: Verify with shell checks and a smoke test

**Files:**
- Verify: `install.sh`
- Verify: `uninstall.sh`

**Step 1: Run shell syntax checks**

Run: `bash -n install.sh uninstall.sh`

Expected: no output and exit code 0.

**Step 2: Run an isolated smoke test**

Run the scripts with a temporary `HOME` and a mocked `systemctl` in `PATH` so the file-generation logic can be verified without depending on a live user systemd session.

Expected:
- `install.sh` creates `config.env`, `auto-debug.service`, and rendered `auto-debug.timer`
- rendered timer contains the configured interval
- `uninstall.sh` removes the installed unit files and preserves config
