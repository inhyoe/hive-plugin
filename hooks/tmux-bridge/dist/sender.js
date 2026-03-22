import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sendKeys, clearHistory } from './tmux.js';
import { PROVIDER_COMMANDS, PROMPT_FILE_THRESHOLD, REGISTRY_DIR } from './types.js';
function buildMarkerInstruction(marker) {
    return `응답 마지막 줄에 반드시 ${marker} 를 그대로 출력해.`;
}
function savePromptFile(name, content) {
    const filePath = join(REGISTRY_DIR, `${name}-prompt.txt`);
    writeFileSync(filePath, content);
    return filePath;
}
export function sendInitial(paneId, prompt, marker, provider, name) {
    const fullPrompt = `${prompt} ${buildMarkerInstruction(marker)}`;
    const providerCmd = PROVIDER_COMMANDS[provider] ?? provider;
    // Always use file-based delivery to avoid shell injection
    const filePath = savePromptFile(name, fullPrompt);
    const fileCmd = `${providerCmd} "파일 ${filePath} 의 내용을 읽고 그 지시에 따라 작업하세요. ${buildMarkerInstruction(marker)}"`;
    sendKeys(paneId, fileCmd);
}
export function sendFollowup(paneId, prompt, marker, name) {
    clearHistory(paneId);
    const fullPrompt = `${prompt} ${buildMarkerInstruction(marker)}`;
    if (fullPrompt.length > PROMPT_FILE_THRESHOLD) {
        const filePath = savePromptFile(name, fullPrompt);
        sendKeys(paneId, `파일 ${filePath} 를 읽고 그 지시에 따라 작업하세요. ${buildMarkerInstruction(marker)}`);
    }
    else {
        sendKeys(paneId, fullPrompt);
    }
    // Extra Enter for codex TUI submission
    setTimeout(() => {
        try {
            sendKeys(paneId, '');
        }
        catch { /* pane may be gone */ }
    }, 300);
}
//# sourceMappingURL=sender.js.map