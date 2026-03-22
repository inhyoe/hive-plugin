import { describe, it, expect } from 'vitest';
import {
  isNoiseLine,
  parseTokenRemaining,
  findMarker,
} from '../src/parser.js';

// Codex TUI output with status bar
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

describe('parseTokenRemaining', () => {
  it('extracts token percentage', () => {
    expect(parseTokenRemaining(CODEX_COMPLETED)).toBe('96% left');
  });

  it('returns null when not present', () => {
    expect(parseTokenRemaining('no status bar here')).toBeNull();
  });
});

describe('findMarker', () => {
  it('finds marker in response', () => {
    const raw = `› prompt\n\n• response with [HIVE_DONE:123]\n\n› idle`;
    const result = findMarker(raw, '[HIVE_DONE:123]');
    expect(result.found).toBe(true);
    expect(result.lineNumber).toBeGreaterThan(0);
  });

  it('ignores marker in status bar', () => {
    const raw = `gpt-5.4 high · 96% left · [HIVE_DONE:123]`;
    const result = findMarker(raw, '[HIVE_DONE:123]');
    expect(result.found).toBe(false);
  });

  it('ignores marker in prompt echo', () => {
    const raw = `› [HIVE_DONE:123]`;
    const result = findMarker(raw, '[HIVE_DONE:123]');
    expect(result.found).toBe(false);
  });

  it('returns not found for missing marker', () => {
    const raw = `• some response content`;
    const result = findMarker(raw, '[HIVE_DONE:999]');
    expect(result.found).toBe(false);
    expect(result.lineNumber).toBe(-1);
  });
});
