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
    // Find the last • response line — marker must be AFTER a response block
    let lastResponseLine = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (/^\s*•\s/.test(lines[i])) {
            lastResponseLine = i;
            break;
        }
    }
    // Search backwards from the end, but only accept markers AFTER last • line
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line.includes(marker))
            continue;
        // Must be after at least one response line
        if (lastResponseLine === -1 || i < lastResponseLine)
            continue;
        return { found: true, lineNumber: i };
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
    // Skip prompt echo continuation lines:
    // After ›, codex TUI may wrap the prompt across multiple lines.
    // These are non-• lines that appear before the first • response line.
    // Also skip leading empty lines.
    let firstResponseIdx = 0;
    let foundResponse = false;
    for (let i = 0; i < content.length; i++) {
        const trimmed = content[i].trim();
        if (trimmed === '')
            continue;
        if (trimmed.startsWith('•')) {
            firstResponseIdx = i;
            foundResponse = true;
            break;
        }
    }
    // If no • found, the response is plain text — find first non-empty line
    // after the prompt echo block (lines that look like continuation of ›)
    if (!foundResponse) {
        // Take all non-empty content as response
        firstResponseIdx = 0;
        for (let i = 0; i < content.length; i++) {
            if (content[i].trim() !== '') {
                firstResponseIdx = i;
                break;
            }
        }
    }
    const responseContent = content.slice(firstResponseIdx);
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