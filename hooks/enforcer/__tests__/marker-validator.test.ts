import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { handleMarkerValidator } from '../src/handlers/marker-validator.js';
import type { MarkerValidatorInput } from '../src/handlers/marker-validator.js';

const TEST_STATE = join(import.meta.dirname, '.test-state-mv');

function writeSession(phase: string, mode = 'HIVE') {
  mkdirSync(TEST_STATE, { recursive: true });
  writeFileSync(join(TEST_STATE, 'session.json'), JSON.stringify({
    mode, phase, completedGates: [], agentSpawns: [], startedAt: new Date().toISOString(),
  }));
}

beforeEach(() => mkdirSync(TEST_STATE, { recursive: true }));
afterEach(() => { try { rmSync(TEST_STATE, { recursive: true, force: true }); } catch {} });

describe('handleMarkerValidator', () => {
  it('passes through when no session', () => {
    const input: MarkerValidatorInput = { output: '[AGREE — T1]', toolName: 'Bash' };
    expect(handleMarkerValidator(input, TEST_STATE).exitCode).toBe(0);
  });

  it('passes through in IDLE mode', () => {
    writeSession('P4', 'IDLE');
    const input: MarkerValidatorInput = { output: '[AGREE — T1]', toolName: 'Bash' };
    expect(handleMarkerValidator(input, TEST_STATE).exitCode).toBe(0);
  });

  it('warns on incomplete TASK PROPOSAL', () => {
    writeSession('P4');
    const output = `[TASK PROPOSAL — T1 — R1]
- 목표: test
- 담당 모듈: auth`;
    const input: MarkerValidatorInput = { output, toolName: 'Bash' };
    const result = handleMarkerValidator(input, TEST_STATE);
    expect(result.message).toContain('missing required sections');
    expect(result.message).toContain('제안 접근방식');
  });

  it('passes on complete TASK PROPOSAL', () => {
    writeSession('P4');
    const output = `[TASK PROPOSAL — T1 — R1]
- 목표: build auth
- 담당 모듈: auth module
- 제안 접근방식: JWT tokens
- 컨텍스트: serena analysis
- 제약사항: none
- 예상 산출물: auth.ts
- 질문: agree?`;
    const input: MarkerValidatorInput = { output, toolName: 'Bash' };
    const result = handleMarkerValidator(input, TEST_STATE);
    expect(result.message).toBeUndefined();
  });

  it('warns on unresolved template team ID', () => {
    writeSession('P4');
    const input: MarkerValidatorInput = { output: '[AGREE — {팀ID}]', toolName: 'Bash' };
    const result = handleMarkerValidator(input, TEST_STATE);
    expect(result.message).toContain('unresolved template variable');
  });

  it('reports missing consensus teams in P4', () => {
    writeSession('P4');
    mkdirSync(join(TEST_STATE, 'consensus'), { recursive: true });
    writeFileSync(join(TEST_STATE, 'teams.json'), JSON.stringify({ teams: ['T1', 'T2', 'T3'] }));
    writeFileSync(join(TEST_STATE, 'consensus', 'T1.marker'), 'type:CONSENSUS round:1 provider:claude');

    const input: MarkerValidatorInput = { output: 'checking status', toolName: 'Bash' };
    const result = handleMarkerValidator(input, TEST_STATE);
    expect(result.message).toContain('T2');
    expect(result.message).toContain('T3');
  });
});
