import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sendKeys, clearHistory } from './tmux.js';
import { PROVIDER_COMMANDS, PROMPT_FILE_THRESHOLD, REGISTRY_DIR } from './types.js';

function buildMarkerInstruction(marker: string): string {
  return `응답 마지막 줄에 반드시 ${marker} 를 그대로 출력해.`;
}

function savePromptFile(name: string, content: string): string {
  const filePath = join(REGISTRY_DIR, `${name}-prompt.txt`);
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
  const fullPrompt = `${prompt} ${buildMarkerInstruction(marker)}`;
  const providerCmd = PROVIDER_COMMANDS[provider] ?? provider;

  if (fullPrompt.length > PROMPT_FILE_THRESHOLD) {
    const filePath = savePromptFile(name, fullPrompt);
    const fileCmd = `${providerCmd} "파일 ${filePath} 의 내용을 읽고 그 지시에 따라 작업하세요. ${buildMarkerInstruction(marker)}"`;
    sendKeys(paneId, fileCmd);
  } else {
    const escaped = fullPrompt.replace(/"/g, '\\"');
    sendKeys(paneId, `${providerCmd} "${escaped}"`);
  }
}

export function sendFollowup(
  paneId: string,
  prompt: string,
  marker: string,
  name: string,
): void {
  clearHistory(paneId);

  const fullPrompt = `${prompt} ${buildMarkerInstruction(marker)}`;

  if (fullPrompt.length > PROMPT_FILE_THRESHOLD) {
    const filePath = savePromptFile(name, fullPrompt);
    sendKeys(paneId, `파일 ${filePath} 를 읽고 그 지시에 따라 작업하세요. ${buildMarkerInstruction(marker)}`);
  } else {
    sendKeys(paneId, fullPrompt);
  }

  // Extra Enter for codex TUI submission
  setTimeout(() => {
    try { sendKeys(paneId, ''); } catch { /* pane may be gone */ }
  }, 300);
}
