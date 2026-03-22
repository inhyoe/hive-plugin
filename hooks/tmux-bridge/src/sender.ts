import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sendKeys, clearHistory } from './tmux.js';
import { PROVIDER_COMMANDS, REGISTRY_DIR } from './types.js';

const PROMPT_FILE = 'prompt.txt';

function savePromptFile(name: string, content: string): string {
  const filePath = join(REGISTRY_DIR, `${name}-${PROMPT_FILE}`);
  writeFileSync(filePath, content);
  return filePath;
}

export function sendInitial(
  paneId: string,
  prompt: string,
  marker: string,
  provider: string,
  name: string,
): void {
  // Save full prompt (with marker instruction) to file
  const markerLine = `\n\n응답 마지막 줄에 반드시 ${marker} 를 그대로 출력해.`;
  const filePath = savePromptFile(name, prompt + markerLine);

  // Outer command uses only the fixed file path — no user input interpolated
  const providerCmd = PROVIDER_COMMANDS[provider] ?? provider;
  const safeCmd = `${providerCmd} '${filePath}'`;
  sendKeys(paneId, safeCmd);
}

export function sendFollowup(
  paneId: string,
  prompt: string,
  marker: string,
  name: string,
): void {
  clearHistory(paneId);

  // Save followup prompt to file
  const markerLine = `\n\n응답 마지막 줄에 반드시 ${marker} 를 그대로 출력해.`;
  const filePath = savePromptFile(name, prompt + markerLine);

  // Send file path as prompt text to running codex TUI
  sendKeys(paneId, `파일 ${filePath} 를 읽고 지시에 따라 작업하세요.`);

  // Extra Enter for codex TUI submission
  setTimeout(() => {
    try { sendKeys(paneId, ''); } catch { /* pane may be gone */ }
  }, 300);
}
