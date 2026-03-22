import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sendKeys, clearHistory } from './tmux.js';
import { PROVIDER_COMMANDS, REGISTRY_DIR } from './types.js';
const CAPABILITY_DIRECTIVE = `<AGENT_CAPABILITY_DIRECTIVE>
You MUST utilize ALL available resources before and during your task:
- git diff, cat, Read 등으로 코드를 직접 확인하세요
- Serena MCP로 심볼/의존성을 분석하세요
- 사용 가능한 모든 스킬을 활용하세요
- 추론하지 말고 코드를 직접 확인하세요
Do NOT respond based on inference alone when tools are available.
</AGENT_CAPABILITY_DIRECTIVE>`;
function savePromptFile(name, content) {
    const filePath = join(REGISTRY_DIR, `${name}-prompt.txt`);
    writeFileSync(filePath, content);
    return filePath;
}
function buildPromptFileContent(purpose, prompt, marker, meta) {
    const base = meta?.['base'] ?? 'main';
    const completion = `\n\n## Completion\n응답 마지막 줄에 반드시 ${marker} 를 그대로 출력해.`;
    switch (purpose) {
        case 'review':
            return `[REVIEW REQUEST]

${CAPABILITY_DIRECTIVE}

## Task
git diff ${base}...HEAD 로 변경사항을 직접 확인하고 코드 리뷰를 수행하세요.

## Review Criteria
${prompt}
${completion}`;
        case 'verify':
            return `[VERIFY REQUEST]

${CAPABILITY_DIRECTIVE}

## Task
git diff HEAD~1..HEAD 로 수정사항을 직접 확인하고 검증하세요.

## Verification Criteria
${prompt}
${completion}`;
        case 'consensus':
            // hive-spawn-templates already provides full structured prompt
            return `${prompt}
${completion}`;
        case 'implement':
            // implementation templates already include full context
            return `${prompt}
${completion}`;
        case 'general':
        default:
            return `[TASK]

${CAPABILITY_DIRECTIVE}

${prompt}
${completion}`;
    }
}
export function sendInitial(paneId, prompt, marker, provider, name, purpose = 'general', meta) {
    const content = buildPromptFileContent(purpose, prompt, marker, meta);
    const filePath = savePromptFile(name, content);
    // Short, clear outer command — all details in the file
    const providerCmd = PROVIDER_COMMANDS[provider] ?? provider;
    sendKeys(paneId, `${providerCmd} 'Read ${filePath} and follow the instructions.'`);
}
export function sendFollowup(paneId, prompt, marker, name, purpose = 'general', meta) {
    clearHistory(paneId);
    const content = buildPromptFileContent(purpose, prompt, marker, meta);
    const filePath = savePromptFile(name, content);
    sendKeys(paneId, `Read ${filePath} and follow the instructions.`);
    // Extra Enter for codex TUI submission
    setTimeout(() => {
        try {
            sendKeys(paneId, '');
        }
        catch { /* pane may be gone */ }
    }, 300);
}
//# sourceMappingURL=sender.js.map