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
// Lines that indicate a false-positive marker hit (prompt echo, command line)
const MARKER_FALSE_POSITIVE_PATTERNS = [
    /›/,
    /╰─/,
    /codex\s/,
    /그대로 출력해/,
];
export function isNoiseLine(line) {
    return NOISE_PATTERNS.some((p) => p.test(line));
}
export function findMarker(raw, marker) {
    const lines = raw.split('\n');
    // Collect all prompt line (›) indices
    const promptLines = [];
    for (let i = 0; i < lines.length; i++) {
        if (/^\s*›\s/.test(lines[i])) {
            promptLines.push(i);
        }
    }
    // Determine response region boundaries
    // The response lives between the user's prompt (› line) and the next idle › line.
    // With ≥2 prompt lines: search between second-to-last and last › line
    // With 1 prompt line: search after that › line to end
    // With 0 prompt lines: search entire output
    let responseStart = 0;
    let responseEnd = lines.length - 1;
    if (promptLines.length >= 2) {
        const userPromptLine = promptLines[promptLines.length - 2];
        const idlePromptLine = promptLines[promptLines.length - 1];
        // Response starts after the user prompt line + empty lines
        responseStart = userPromptLine + 1;
        for (let i = responseStart; i < idlePromptLine; i++) {
            const trimmed = lines[i].trim();
            if (trimmed === '') {
                responseStart = i + 1;
                continue;
            }
            break;
        }
        responseEnd = idlePromptLine - 1;
    }
    else if (promptLines.length === 1) {
        responseStart = promptLines[0] + 1;
        for (let i = responseStart; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (trimmed === '') {
                responseStart = i + 1;
                continue;
            }
            break;
        }
    }
    // Search for marker in response region only (reverse)
    for (let i = responseEnd; i >= responseStart; i--) {
        if (lines[i].includes(marker)) {
            if (/gpt-\d+\.\d+.*left/.test(lines[i]))
                continue;
            return { found: true, lineNumber: i };
        }
    }
    return { found: false, lineNumber: -1 };
}
export function extractCurrentRound(raw, markerLineNumber) {
    const lines = raw.split('\n');
    // Find the last prompt line (›) before the marker
    let promptLine = -1;
    for (let i = markerLineNumber - 1; i >= 0; i--) {
        if (/^\s*›\s/.test(lines[i])) {
            promptLine = i;
            break;
        }
    }
    // Extract lines between prompt and marker (exclusive of both)
    const start = promptLine + 1;
    const end = markerLineNumber;
    const content = lines.slice(start, end);
    // Skip leading empty lines
    let firstContentIdx = 0;
    for (let i = 0; i < content.length; i++) {
        if (content[i].trim() !== '') {
            firstContentIdx = i;
            break;
        }
    }
    const responseContent = content.slice(firstContentIdx);
    // Filter noise and clean up
    const cleaned = responseContent
        .filter((line) => !isNoiseLine(line))
        .filter((line) => line.trim() !== '');
    return cleaned.join('\n');
}
export function parseTokenRemaining(raw) {
    const match = raw.match(/(\d+)%\s*left/);
    return match ? `${match[1]}% left` : null;
}
export function extractResponse(raw, marker) {
    const search = findMarker(raw, marker);
    if (!search.found)
        return null;
    const response = extractCurrentRound(raw, search.lineNumber);
    const tokenRemaining = parseTokenRemaining(raw);
    return { response, tokenRemaining };
}
//# sourceMappingURL=parser.js.map