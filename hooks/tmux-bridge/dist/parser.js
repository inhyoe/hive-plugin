const NOISE_PATTERNS = [
    /^\s*╭─░▒▓/, // shell prompt top
    /^\s*╰─/, // shell prompt bottom
    /^\s*╭──/, // TUI frame top
    /^\s*│\s/, // TUI frame body
    /^\s*╰──/, // TUI frame bottom
    /^\s*Tip:/, // Tip lines
    /^\s*›\s/, // Prompt echo / idle suggestions
    /^\s*•\s+Explored\b/, // Serena: explored
    /^\s*•\s+Called\s/, // Serena: called
    /^\s*•\s+Ran\s/, // Serena: ran command
    /^\s*•\s+Updated Plan/, // Codex: plan update
    /^\s*Working\s/, // Working indicator
    /^\s+└\s/, // Tree chars (tool output)
    /^[─\s]{10,}$/, // Dividers (10+ dashes)
    /gpt-\d+\.\d+.*left/, // Status bar
    /^\s*model:\s/, // Model line in TUI
    /^\s*directory:\s/, // Directory line in TUI
    /^\s*•\s+Starting MCP/, // MCP server startup
    /── Worked for/, // Work duration
];
// Codex TUI idle prompt patterns — appear ONLY when codex is waiting for input
const IDLE_PROMPT_PATTERNS = [
    /^\s*›\s+Implement\s/,
    /^\s*›\s+Run\s+\/review/,
    /^\s*›\s+Find\s+and\s+fix/,
    /^\s*›\s+Summarize\s+recent/,
    /^\s*›\s+Improve\s+documentation/,
    /^\s*›\s+Use\s+\/skills/,
    /^\s*›\s+Explain\s/,
    /^\s*›\s+Write\s+tests/,
    /^\s*›\s+Refactor\s/,
    /^\s*›\s+Add\s/,
];
export function isNoiseLine(line) {
    return NOISE_PATTERNS.some((p) => p.test(line));
}
/**
 * Detect if codex TUI is idle (finished responding, waiting for next input).
 * Idle state = last non-empty lines contain an idle prompt (› Implement...)
 * followed by a status bar (gpt-X.Y ... N% left).
 */
export function isIdle(raw) {
    const lines = raw.split('\n');
    // Check last 8 non-empty lines for idle pattern
    const nonEmpty = lines.filter((l) => l.trim() !== '').slice(-8);
    const hasIdlePrompt = nonEmpty.some((l) => IDLE_PROMPT_PATTERNS.some((p) => p.test(l)));
    const hasStatusBar = nonEmpty.some((l) => /gpt-\d+\.\d+.*\d+%\s*left/.test(l));
    // NOT idle if "Working" or "Starting MCP" is visible — codex is still processing
    const isWorking = nonEmpty.some((l) => /Working\s*\(|Starting MCP/.test(l));
    return hasIdlePrompt && hasStatusBar && !isWorking;
}
/**
 * Extract the response from the LAST completed exchange in the pane.
 * Works by finding the last idle prompt (› Implement...) and extracting
 * everything between the user's prompt and that idle prompt.
 */
export function extractLatestResponse(raw) {
    const lines = raw.split('\n');
    // Find the last idle prompt line
    let idleLine = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (IDLE_PROMPT_PATTERNS.some((p) => p.test(lines[i]))) {
            idleLine = i;
            break;
        }
    }
    if (idleLine === -1)
        return null;
    // Find the user's prompt (› with pasted content or actual prompt) before idle
    // It's the second-to-last › line (the one before idle)
    let userPromptLine = -1;
    for (let i = idleLine - 1; i >= 0; i--) {
        if (/^\s*›\s/.test(lines[i])) {
            userPromptLine = i;
            break;
        }
    }
    // Find first • response line after user prompt (skip prompt echo continuation)
    let responseStart = userPromptLine + 1;
    for (let i = userPromptLine + 1; i < idleLine; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('•')) {
            responseStart = i;
            break;
        }
    }
    // Extract between responseStart and idleLine
    const content = lines.slice(responseStart, idleLine);
    const cleaned = content
        .filter((line) => !isNoiseLine(line))
        .filter((line) => line.trim() !== '');
    return cleaned.length > 0 ? cleaned.join('\n') : null;
}
export function parseTokenRemaining(raw) {
    const match = raw.match(/(\d+)%\s*left/);
    return match ? `${match[1]}% left` : null;
}
// Legacy marker-based API (kept for backwards compatibility)
export function findMarker(raw, marker) {
    // With idle detection, markers are no longer needed.
    // But if a marker IS present in the response, find it.
    const lines = raw.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].includes(marker))
            continue;
        if (/gpt-\d+\.\d+.*left/.test(lines[i]))
            continue;
        if (/^\s*›\s/.test(lines[i]))
            continue;
        return { found: true, lineNumber: i };
    }
    return { found: false, lineNumber: -1 };
}
export function extractCurrentRound(raw, markerLineNumber) {
    const lines = raw.split('\n');
    let promptLine = -1;
    for (let i = markerLineNumber - 1; i >= 0; i--) {
        if (/^\s*›\s/.test(lines[i])) {
            promptLine = i;
            break;
        }
    }
    const start = promptLine + 1;
    const end = markerLineNumber;
    const content = lines.slice(start, end);
    let firstContentIdx = 0;
    for (let i = 0; i < content.length; i++) {
        if (content[i].trim() !== '') {
            firstContentIdx = i;
            break;
        }
    }
    const responseContent = content.slice(firstContentIdx);
    const cleaned = responseContent
        .filter((line) => !isNoiseLine(line))
        .filter((line) => line.trim() !== '');
    return cleaned.join('\n');
}
export function extractResponse(raw, _marker) {
    // Primary: use idle detection
    if (!isIdle(raw))
        return null;
    const response = extractLatestResponse(raw);
    if (!response)
        return null;
    const tokenRemaining = parseTokenRemaining(raw);
    return { response, tokenRemaining };
}
//# sourceMappingURL=parser.js.map