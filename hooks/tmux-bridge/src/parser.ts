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

export function isNoiseLine(line: string): boolean {
  return NOISE_PATTERNS.some((p) => p.test(line));
}

export function parseTokenRemaining(raw: string): string | null {
  const match = raw.match(/(\d+)%\s*left/);
  return match ? `${match[1]}% left` : null;
}

export function findMarker(raw: string, marker: string): MarkerSearchResult {
  const lines = raw.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i]!.includes(marker)) continue;
    if (/gpt-\d+\.\d+.*left/.test(lines[i]!)) continue;
    if (/^\s*›\s/.test(lines[i]!)) continue;
    return { found: true, lineNumber: i };
  }
  return { found: false, lineNumber: -1 };
}
