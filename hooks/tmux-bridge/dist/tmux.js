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
export function spawnPane(name, session, historyLimit = 10_000) {
    const target = session ? `-t ${session}:1` : '';
    const paneId = exec(`tmux split-window -v ${target} -l 12 -d -P -F '#{pane_id}'`);
    exec(`tmux set-option -t ${paneId} history-limit ${historyLimit}`);
    exec(`tmux select-pane -t ${paneId} -T "${name}"`);
    return paneId;
}
export function sendKeys(paneId, text) {
    // Use tmux load-buffer + paste-buffer for reliable text delivery
    const escaped = text.replace(/'/g, "'\\''");
    exec(`tmux send-keys -t ${paneId} '${escaped}' Enter`);
}
export function capturePaneOutput(paneId, scrollback = 5000) {
    return execSafe(`tmux capture-pane -t ${paneId} -p -S -${scrollback}`) ?? '';
}
export function clearHistory(paneId) {
    execSafe(`tmux clear-history -t ${paneId}`);
}
export function sendCtrlC(paneId) {
    execSafe(`tmux send-keys -t ${paneId} C-c`);
}
export function killPane(paneId) {
    execSafe(`tmux kill-pane -t ${paneId}`);
}
export function pasteFile(paneId, filePath) {
    exec(`tmux load-buffer '${filePath}'`);
    exec(`tmux paste-buffer -t ${paneId}`);
    // Codex TUI needs multiple Enter presses after multi-line paste:
    // 1st Enter: may be consumed as line break in input
    // 2nd Enter: submits the prompt
    execSync('sleep 0.5', { timeout: 5000 });
    exec(`tmux send-keys -t ${paneId} Enter`);
    execSync('sleep 0.3', { timeout: 5000 });
    exec(`tmux send-keys -t ${paneId} Enter`);
}
export function paneExists(paneId) {
    const result = execSafe(`tmux list-panes -a -F '#{pane_id}'`);
    if (!result)
        return false;
    return result.split('\n').includes(paneId);
}
//# sourceMappingURL=tmux.js.map