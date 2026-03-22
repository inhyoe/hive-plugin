import { execSync } from 'node:child_process';

function exec(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', timeout: 10_000 }).trim();
}

function execSafe(cmd: string): string | null {
  try {
    return exec(cmd);
  } catch {
    return null;
  }
}

export function spawnPane(
  name: string,
  session?: string,
  historyLimit = 10_000,
): string {
  const target = session ? `-t ${session}:1` : '';
  const paneId = exec(
    `tmux split-window -v ${target} -l 12 -d -P -F '#{pane_id}'`,
  );
  exec(`tmux set-option -t ${paneId} history-limit ${historyLimit}`);
  exec(`tmux select-pane -t ${paneId} -T "${name}"`);
  return paneId;
}

export function sendKeys(paneId: string, text: string): void {
  // Use tmux load-buffer + paste-buffer for reliable text delivery
  const escaped = text.replace(/'/g, "'\\''");
  exec(`tmux send-keys -t ${paneId} '${escaped}' Enter`);
}

export function capturePaneOutput(
  paneId: string,
  scrollback = 5000,
): string {
  return execSafe(
    `tmux capture-pane -t ${paneId} -p -S -${scrollback}`,
  ) ?? '';
}

export function clearHistory(paneId: string): void {
  execSafe(`tmux clear-history -t ${paneId}`);
}

export function sendCtrlC(paneId: string): void {
  execSafe(`tmux send-keys -t ${paneId} C-c`);
}

export function killPane(paneId: string): void {
  execSafe(`tmux kill-pane -t ${paneId}`);
}

export function pasteFile(paneId: string, filePath: string): void {
  exec(`tmux load-buffer '${filePath}'`);
  exec(`tmux paste-buffer -t ${paneId}`);
}

export function paneExists(paneId: string): boolean {
  const result = execSafe(
    `tmux list-panes -a -F '#{pane_id}'`,
  );
  if (!result) return false;
  return result.split('\n').includes(paneId);
}
