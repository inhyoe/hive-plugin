import type { MarkerSearchResult } from './types.js';

const NOISE_PATTERNS: RegExp[] = [
  /^\s*╭─░▒▓/,              // shell prompt top
  /^\s*╰─/,                 // shell prompt bottom
  /^\s*╭──/,                // TUI frame top
  /^\s*│\s/,                // TUI frame body
  /^\s*╰──/,                // TUI frame bottom
  /^\s*Tip:/,               // Tip lines
  /^\s*›\s/,                // Prompt echo / idle suggestions
  /^\s*•\s+Explored\b/,     // Serena: explored
  /^\s*•\s+Called\s/,        // Serena: called
  /^\s*•\s+Ran\s/,           // Serena: ran command
  /^\s*•\s+Updated Plan/,   // Codex: plan update
  /^\s*Working\s/,           // Working indicator
  /^\s+└\s/,                 // Tree chars (tool output)
  /^[─\s]{10,}$/,           // Dividers (10+ dashes)
  /gpt-\d+\.\d+.*left/,     // Status bar
  /^\s*model:\s/,            // Model line in TUI
  /^\s*directory:\s/,        // Directory line in TUI
  /^\s*•\s+Starting MCP/,   // MCP server startup
  /── Worked for/,           // Work duration
];

// Lines that indicate a false-positive marker hit (prompt echo, command line)
const MARKER_FALSE_POSITIVE_PATTERNS: RegExp[] = [
  /›/,
  /╰─/,
  /codex\s/,
  /그대로 출력해/,
];

export function isNoiseLine(line: string): boolean {
  return NOISE_PATTERNS.some((p) => p.test(line));
}

export function findMarker(raw: string, marker: string): MarkerSearchResult {
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.includes(marker)) continue;
    // Exclude false positives (prompt echo, command line)
    const isFalsePositive = MARKER_FALSE_POSITIVE_PATTERNS.some((p) =>
      p.test(line),
    );
    if (!isFalsePositive) {
      return { found: true, lineNumber: i };
    }
  }
  return { found: false, lineNumber: -1 };
}

export function extractCurrentRound(
  raw: string,
  markerLineNumber: number,
): string {
  const lines = raw.split('\n');

  // Find the last prompt line (›) before the marker
  let promptLine = -1;
  for (let i = markerLineNumber - 1; i >= 0; i--) {
    if (/^\s*›\s/.test(lines[i]!)) {
      promptLine = i;
      break;
    }
  }

  // Extract lines between prompt and marker (exclusive of both)
  const start = promptLine + 1;
  const end = markerLineNumber;
  const content = lines.slice(start, end);

  // Skip prompt continuation lines (non-• lines before first • response)
  let firstResponseIdx = 0;
  for (let i = 0; i < content.length; i++) {
    const trimmed = content[i]!.trim();
    if (trimmed === '') continue;
    if (trimmed.startsWith('•')) {
      firstResponseIdx = i;
      break;
    }
    // Non-empty, non-• line before first response = prompt continuation
    firstResponseIdx = i + 1;
  }
  const responseContent = content.slice(firstResponseIdx);

  // Filter noise and clean up
  const cleaned = responseContent
    .filter((line) => !isNoiseLine(line))
    .filter((line) => line.trim() !== '');

  return cleaned.join('\n');
}

export function parseTokenRemaining(raw: string): string | null {
  const match = raw.match(/(\d+)%\s*left/);
  return match ? `${match[1]}% left` : null;
}

export function extractResponse(
  raw: string,
  marker: string,
): { response: string; tokenRemaining: string | null } | null {
  const search = findMarker(raw, marker);
  if (!search.found) return null;

  const response = extractCurrentRound(raw, search.lineNumber);
  const tokenRemaining = parseTokenRemaining(raw);

  return { response, tokenRemaining };
}
