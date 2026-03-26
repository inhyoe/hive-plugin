import { execSync } from 'node:child_process';
function exec(cmd) {
    return execSync(cmd, { encoding: 'utf-8', timeout: 10_000 }).trim();
}
function execSafe(cmd) {
    try {
        return exec(cmd);
    }
    catch {
        return null;
    }
}
/** Sanitize shell argument — only allow alphanumeric, dash, underscore, dot, colon, percent */
function sanitize(input) {
    if (!/^[a-zA-Z0-9._:%\/-]+$/.test(input)) {
        throw new Error(`Unsafe shell argument: ${input}`);
    }
    return input;
}
/** Escape single quotes for shell embedding */
function shellEscape(input) {
    return input.replace(/'/g, "'\\''");
}
export function spawnPane(name, session, historyLimit = 10_000) {
    const target = session ? `-t ${sanitize(session)}:1` : '';
    const safeName = shellEscape(name);
    const paneId = exec(`tmux split-window -v ${target} -l 12 -d -P -F '#{pane_id}'`);
    exec(`tmux set-option -t ${sanitize(paneId)} history-limit ${historyLimit}`);
    exec(`tmux select-pane -t ${sanitize(paneId)} -T '${safeName}'`);
    return paneId;
}
export function sendKeys(paneId, text) {
    const escaped = shellEscape(text);
    exec(`tmux send-keys -t ${sanitize(paneId)} '${escaped}' Enter`);
}
export function capturePaneOutput(paneId, scrollback = 5000) {
    return execSafe(`tmux capture-pane -t ${sanitize(paneId)} -p -S -${scrollback}`) ?? '';
}
export function clearHistory(paneId) {
    execSafe(`tmux clear-history -t ${sanitize(paneId)}`);
}
export function sendCtrlC(paneId) {
    execSafe(`tmux send-keys -t ${sanitize(paneId)} C-c`);
}
export function killPane(paneId) {
    execSafe(`tmux kill-pane -t ${sanitize(paneId)}`);
}
export function pasteFile(paneId, filePath) {
    const safePaneId = sanitize(paneId);
    const safeFilePath = sanitize(filePath);
    // Use named buffer per pane to prevent concurrent paste collisions
    const bufName = `hive-${safePaneId.replace('%', '')}`;
    exec(`tmux load-buffer -b '${bufName}' '${safeFilePath}'`);
    exec(`tmux paste-buffer -b '${bufName}' -t ${safePaneId} -d`);
    // Codex TUI needs multiple Enter presses after multi-line paste
    // Extra delay + 3rd Enter to ensure prompt submission (v0.116.0 timing issue)
    execSync('sleep 1', { timeout: 5000 });
    exec(`tmux send-keys -t ${safePaneId} Enter`);
    execSync('sleep 0.5', { timeout: 5000 });
    exec(`tmux send-keys -t ${safePaneId} Enter`);
    execSync('sleep 0.3', { timeout: 5000 });
    exec(`tmux send-keys -t ${safePaneId} Enter`);
}
export function paneExists(paneId) {
    const result = execSafe(`tmux list-panes -a -F '#{pane_id}'`);
    if (!result)
        return false;
    return result.split('\n').includes(paneId);
}
//# sourceMappingURL=tmux.js.map