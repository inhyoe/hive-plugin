import { describe, it, expect } from 'vitest';
import {
  isNoiseLine,
  isIdle,
  extractLatestResponse,
  parseTokenRemaining,
  extractResponse,
} from '../src/parser.js';

// Codex TUI output with idle prompt at end (completed response)
const CODEX_COMPLETED = `╭─░▒▓      ~/Document/GITHUB/hive-plugin ────── ✔  24.13.1    at 23:38:47   ▓▒░
╰─ codex -a never -s danger-full-access
╭────────────────────────────────────────────╮
│ >_ OpenAI Codex (v0.116.0)                 │
╰────────────────────────────────────────────╯

  Tip: New 2x rate limits until April 2nd.


› [Pasted Content 500 chars]


• 1. hive: 멀티 프로바이더 오케스트레이션
  2. hive-consensus: Phase 4 합의 프로토콜
  3. hive-workflow: Phase 0-3, 5 워크플로 엔진


› Run /review on my current changes

  gpt-5.4 high · 96% left · ~/Document/GITHUB/hive-plugin`;

// Codex TUI output still working (no idle prompt)
const CODEX_WORKING = `╭────────────────────────────────────────────╮
│ >_ OpenAI Codex (v0.116.0)                 │
╰────────────────────────────────────────────╯

› [Pasted Content 500 chars]


• 리뷰 범위를 확인하고 있습니다.

• Working (12s • esc to interrupt)


› Implement {feature}

  gpt-5.4 high · 97% left · ~/Document/GITHUB/hive-plugin`;

// Tool-heavy response
const CODEX_WITH_TOOLS = `╭────────────────────────────────────────────╮
│ >_ OpenAI Codex (v0.116.0)                 │
╰────────────────────────────────────────────╯

› [Pasted Content 800 chars]


• 먼저 코드를 확인하겠습니다.

• Explored
  └ Read tmux-ask.sh, tmux-pend.sh

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• Called serena.search_for_pattern({"substring_pattern":"tmux"})
  └ The answer is too long

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• 1. 출력 파싱이 매우 취약합니다.
  2. 요청 격리와 동시성이 약합니다.
  3. 운영 의존성이 큽니다.


› Implement {feature}

  gpt-5.4 high · 62% left · ~/Document/GITHUB/hive-plugin`;

// NO ISSUES FOUND response
const CODEX_NO_ISSUES = `› [Pasted Content 1000 chars]


• NO ISSUES FOUND


› Run /review on my current changes

  gpt-5.4 high · 96% left · ~/path`;

describe('isNoiseLine', () => {
  it('detects shell prompt lines', () => {
    expect(isNoiseLine('╭─░▒▓      ~/Document  ▓▒░')).toBe(true);
    expect(isNoiseLine('╰─ codex -a never ...')).toBe(true);
  });

  it('detects TUI frame', () => {
    expect(isNoiseLine('╭────────────────────╮')).toBe(true);
    expect(isNoiseLine('│ >_ OpenAI Codex    │')).toBe(true);
  });

  it('detects Serena logs', () => {
    expect(isNoiseLine('• Explored')).toBe(true);
    expect(isNoiseLine('• Called serena.list_dir(...)')).toBe(true);
    expect(isNoiseLine('• Ran pwd')).toBe(true);
  });

  it('preserves actual response content', () => {
    expect(isNoiseLine('• 1. 구현 단순성: tmux는...')).toBe(false);
    expect(isNoiseLine('  2. 운영 안정성: 프로세스가...')).toBe(false);
  });
});

describe('isIdle', () => {
  it('detects completed response (idle prompt + status bar)', () => {
    expect(isIdle(CODEX_COMPLETED)).toBe(true);
  });

  it('detects working state as NOT idle', () => {
    // Working state shows idle prompt placeholder but "Working" indicator
    // means codex is still processing — should NOT be detected as idle
    expect(isIdle(CODEX_WORKING)).toBe(false);
  });

  it('detects tool-heavy completed response', () => {
    expect(isIdle(CODEX_WITH_TOOLS)).toBe(true);
  });

  it('detects NO ISSUES FOUND response as idle', () => {
    expect(isIdle(CODEX_NO_ISSUES)).toBe(true);
  });

  it('returns false for output without idle prompt', () => {
    const noIdle = `› Some prompt


• Still working on it...`;
    expect(isIdle(noIdle)).toBe(false);
  });
});

describe('extractLatestResponse', () => {
  it('extracts clean response from completed output', () => {
    const response = extractLatestResponse(CODEX_COMPLETED);
    expect(response).not.toBeNull();
    expect(response).toContain('hive: 멀티 프로바이더');
    expect(response).toContain('hive-consensus');
    expect(response).not.toContain('╭──');
    expect(response).not.toContain('Tip:');
    expect(response).not.toContain('gpt-5.4');
    expect(response).not.toContain('›');
  });

  it('strips Serena logs from tool-heavy output', () => {
    const response = extractLatestResponse(CODEX_WITH_TOOLS);
    expect(response).not.toBeNull();
    expect(response).toContain('출력 파싱');
    expect(response).toContain('동시성');
    expect(response).not.toContain('Explored');
    expect(response).not.toContain('Called serena');
  });

  it('extracts NO ISSUES FOUND', () => {
    const response = extractLatestResponse(CODEX_NO_ISSUES);
    expect(response).not.toBeNull();
    expect(response).toContain('NO ISSUES FOUND');
  });

  it('returns null when no idle prompt', () => {
    const noIdle = `› prompt\n\n• still working...`;
    expect(extractLatestResponse(noIdle)).toBeNull();
  });
});

describe('parseTokenRemaining', () => {
  it('extracts token percentage', () => {
    expect(parseTokenRemaining(CODEX_COMPLETED)).toBe('96% left');
  });

  it('returns null when not present', () => {
    expect(parseTokenRemaining('no status bar here')).toBeNull();
  });
});

describe('extractResponse', () => {
  it('returns response when idle (marker ignored)', () => {
    const result = extractResponse(CODEX_COMPLETED, 'ignored');
    expect(result).not.toBeNull();
    expect(result!.response).toContain('hive');
    expect(result!.tokenRemaining).toBe('96% left');
  });

  it('returns null when not idle', () => {
    const notIdle = `› prompt\n\n• working...\n\n• Starting MCP servers`;
    expect(extractResponse(notIdle, 'ignored')).toBeNull();
  });
});
