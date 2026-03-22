import { describe, it, expect } from 'vitest';
import {
  isNoiseLine,
  findMarker,
  extractCurrentRound,
  parseTokenRemaining,
  extractResponse,
} from '../src/parser.js';

// Real codex TUI output sample (simplified from live test)
const CODEX_SAMPLE_SIMPLE = `╭─░▒▓      ~/Document/GITHUB/hive-plugin  on    feat/install-script ────── ✔  24.13.1    at 23:38:47   ▓▒░
╰─ codex -a never -s danger-full-access "스킬 목록을 알려줘. 응답 마지막 줄에 반드시 [HIVE_DONE:demo_123] 를 그대로 출력해."
╭────────────────────────────────────────────╮
│ >_ OpenAI Codex (v0.116.0)                 │
│ model:     gpt-5.4 high   /model to change │
│ directory: ~/Document/GITHUB/hive-plugin   │
╰────────────────────────────────────────────╯

  Tip: New 2x rate limits until April 2nd.


› 스킬 목록을 알려줘. 응답 마지막 줄에 반드시 [HIVE_DONE:demo_123] 를 그대로 출력해.


• 1. hive: 멀티 프로바이더 오케스트레이션
  2. hive-consensus: Phase 4 합의 프로토콜
  3. hive-workflow: Phase 0-3, 5 워크플로 엔진

  [HIVE_DONE:demo_123]


› Run /review on my current changes

  gpt-5.4 high · 96% left · ~/Document/GITHUB/hive-plugin`;

// Sample with Serena tool usage (noise-heavy)
const CODEX_SAMPLE_WITH_TOOLS = `╭─░▒▓      ~/Document/GITHUB/hive-plugin ────── ✔  at 23:19:35   ▓▒░
╰─ codex -a never -s danger-full-access "단점 3가지. [HIVE_DONE:t2_999] 를 그대로 출력해."
╭────────────────────────────────────────────╮
│ >_ OpenAI Codex (v0.116.0)                 │
╰────────────────────────────────────────────╯

› 단점 3가지. [HIVE_DONE:t2_999] 를 그대로 출력해.


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

  [HIVE_DONE:t2_999]


› Implement feature

  gpt-5.4 high · 62% left · ~/Document/GITHUB/hive-plugin`;

// Two-round sample (followup in same pane, after clear-history)
const CODEX_SAMPLE_ROUND2 = `› 상대 팀(T2)의 반대 의견이 /tmp/hive-tmux/t2-opinion.txt 에 있습니다. 반론하세요. [HIVE_DONE:r2t1_456] 를 그대로 출력해.


• 반대 의견 파일을 확인하겠습니다.

• Ran cat /tmp/hive-tmux/t2-opinion.txt
  └ 1. 출력 파싱 취약 2. 격리 약함 3. 운영 의존성

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

• 1. 파싱은 마커 프로토콜로 안정화 가능합니다.
  2. 격리는 pane 분리로 충분합니다.
  3. 운영 의존성은 tmux의 범용성으로 상쇄됩니다.

  [HIVE_DONE:r2t1_456]


› Run /review

  gpt-5.4 high · 93% left · ~/Document/GITHUB/hive-plugin`;

describe('isNoiseLine', () => {
  it('detects shell prompt lines', () => {
    expect(isNoiseLine('╭─░▒▓      ~/Document  ▓▒░')).toBe(true);
    expect(isNoiseLine('╰─ codex -a never ...')).toBe(true);
  });

  it('detects TUI frame', () => {
    expect(isNoiseLine('╭────────────────────╮')).toBe(true);
    expect(isNoiseLine('│ >_ OpenAI Codex    │')).toBe(true);
    expect(isNoiseLine('╰────────────────────╯')).toBe(true);
  });

  it('detects tips', () => {
    expect(isNoiseLine('  Tip: New 2x rate limits')).toBe(true);
  });

  it('detects prompt echo', () => {
    expect(isNoiseLine('› 질문 내용')).toBe(true);
    expect(isNoiseLine('› Run /review on my current changes')).toBe(true);
  });

  it('detects Serena logs', () => {
    expect(isNoiseLine('• Explored')).toBe(true);
    expect(isNoiseLine('• Called serena.list_dir(...)')).toBe(true);
    expect(isNoiseLine('• Ran pwd')).toBe(true);
    expect(isNoiseLine('  └ Read tmux-ask.sh')).toBe(true);
  });

  it('detects dividers', () => {
    expect(isNoiseLine('──────────────────────────')).toBe(true);
  });

  it('detects status bar', () => {
    expect(isNoiseLine('  gpt-5.4 high · 96% left · ~/path')).toBe(true);
  });

  it('detects MCP startup', () => {
    expect(isNoiseLine('• Starting MCP servers (1/2): serena')).toBe(true);
  });

  it('preserves actual response content', () => {
    expect(isNoiseLine('• 1. 구현 단순성: tmux는...')).toBe(false);
    expect(isNoiseLine('  2. 운영 안정성: 프로세스가...')).toBe(false);
    expect(isNoiseLine('  [HIVE_DONE:abc]')).toBe(false);
  });
});

describe('findMarker', () => {
  it('finds marker in clean response', () => {
    const result = findMarker(CODEX_SAMPLE_SIMPLE, '[HIVE_DONE:demo_123]');
    expect(result.found).toBe(true);
    expect(result.lineNumber).toBeGreaterThan(0);
  });

  it('ignores marker in prompt echo line', () => {
    // The prompt echo line also contains the marker text
    const lines = CODEX_SAMPLE_SIMPLE.split('\n');
    const promptLines = lines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => l.includes('[HIVE_DONE:demo_123]'));
    // Should be at least 2 occurrences: prompt echo + actual marker
    expect(promptLines.length).toBeGreaterThanOrEqual(2);

    // findMarker should return only the real marker (not the prompt echo)
    const result = findMarker(CODEX_SAMPLE_SIMPLE, '[HIVE_DONE:demo_123]');
    const markerLine = lines[result.lineNumber]!;
    expect(markerLine).not.toContain('›');
    expect(markerLine).not.toContain('codex');
  });

  it('returns not found for missing marker', () => {
    const result = findMarker(CODEX_SAMPLE_SIMPLE, '[HIVE_DONE:nonexistent]');
    expect(result.found).toBe(false);
    expect(result.lineNumber).toBe(-1);
  });

  it('finds marker in tool-heavy output', () => {
    const result = findMarker(CODEX_SAMPLE_WITH_TOOLS, '[HIVE_DONE:t2_999]');
    expect(result.found).toBe(true);
  });

  it('finds marker in plain-text response (no • bullets)', () => {
    const plainTextResponse = `› Review this code.


NO ISSUES FOUND

  [HIVE_DONE:plain_test]


› Run /review on my current changes

  gpt-5.4 high · 96% left · ~/path`;
    const result = findMarker(plainTextResponse, '[HIVE_DONE:plain_test]');
    expect(result.found).toBe(true);
    // Should NOT match the status bar line
    const lines = plainTextResponse.split('\n');
    expect(lines[result.lineNumber]).toContain('[HIVE_DONE:plain_test]');
    expect(lines[result.lineNumber]).not.toContain('gpt-');
  });

  it('ignores marker in prompt echo region', () => {
    const withPromptEcho = `╰─ codex -a never "prompt with [HIVE_DONE:echo_test]"
╭────────────────────────────────────────────╮
│ >_ OpenAI Codex (v0.116.0)                 │
╰────────────────────────────────────────────╯

› prompt with [HIVE_DONE:echo_test]


• Response content here

  [HIVE_DONE:echo_test]


› Idle prompt

  gpt-5.4 high · 96% left · ~/path`;
    const result = findMarker(withPromptEcho, '[HIVE_DONE:echo_test]');
    expect(result.found).toBe(true);
    // Must find the one AFTER the • response, not the prompt echo
    const lines = withPromptEcho.split('\n');
    const markerLine = lines[result.lineNumber]!;
    expect(markerLine.trim()).toBe('[HIVE_DONE:echo_test]');
  });
});

describe('extractCurrentRound', () => {
  it('extracts clean response from simple output', () => {
    const { lineNumber } = findMarker(
      CODEX_SAMPLE_SIMPLE,
      '[HIVE_DONE:demo_123]',
    );
    const response = extractCurrentRound(CODEX_SAMPLE_SIMPLE, lineNumber);
    expect(response).toContain('hive: 멀티 프로바이더');
    expect(response).toContain('hive-consensus');
    expect(response).toContain('hive-workflow');
    // Should NOT contain noise
    expect(response).not.toContain('╭──');
    expect(response).not.toContain('Tip:');
    expect(response).not.toContain('gpt-5.4');
    expect(response).not.toContain('›');
  });

  it('strips Serena logs from tool-heavy output', () => {
    const { lineNumber } = findMarker(
      CODEX_SAMPLE_WITH_TOOLS,
      '[HIVE_DONE:t2_999]',
    );
    const response = extractCurrentRound(
      CODEX_SAMPLE_WITH_TOOLS,
      lineNumber,
    );
    expect(response).toContain('출력 파싱');
    expect(response).toContain('동시성');
    expect(response).toContain('운영 의존성');
    // Noise stripped
    expect(response).not.toContain('Explored');
    expect(response).not.toContain('Called serena');
    expect(response).not.toContain('──────');
    expect(response).not.toContain('└');
  });

  it('extracts only current round from followup', () => {
    const { lineNumber } = findMarker(
      CODEX_SAMPLE_ROUND2,
      '[HIVE_DONE:r2t1_456]',
    );
    const response = extractCurrentRound(CODEX_SAMPLE_ROUND2, lineNumber);
    expect(response).toContain('마커 프로토콜');
    expect(response).toContain('pane 분리');
    // Should NOT contain the Ran command output
    expect(response).not.toContain('Ran cat');
    expect(response).not.toContain('└');
  });
});

describe('parseTokenRemaining', () => {
  it('extracts token percentage', () => {
    expect(parseTokenRemaining(CODEX_SAMPLE_SIMPLE)).toBe('96% left');
  });

  it('extracts from tool-heavy output', () => {
    expect(parseTokenRemaining(CODEX_SAMPLE_WITH_TOOLS)).toBe('62% left');
  });

  it('returns null when not present', () => {
    expect(parseTokenRemaining('no status bar here')).toBeNull();
  });
});

describe('extractResponse', () => {
  it('returns full result for valid marker', () => {
    const result = extractResponse(
      CODEX_SAMPLE_SIMPLE,
      '[HIVE_DONE:demo_123]',
    );
    expect(result).not.toBeNull();
    expect(result!.response).toContain('hive');
    expect(result!.tokenRemaining).toBe('96% left');
  });

  it('returns null for missing marker', () => {
    const result = extractResponse(
      CODEX_SAMPLE_SIMPLE,
      '[HIVE_DONE:missing]',
    );
    expect(result).toBeNull();
  });
});
