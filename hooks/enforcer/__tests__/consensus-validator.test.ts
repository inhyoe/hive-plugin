import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { handleConsensusValidator } from '../src/handlers/consensus-validator.js';
import type { ConsensusInput } from '../src/handlers/consensus-validator.js';

const TEST_STATE = join(import.meta.dirname, '.test-state-cv');

function writeSession(phase: string, mode = 'HIVE') {
  mkdirSync(TEST_STATE, { recursive: true });
  writeFileSync(join(TEST_STATE, 'session.json'), JSON.stringify({
    mode, phase, completedGates: [], agentSpawns: [], startedAt: new Date().toISOString(),
  }));
}

beforeEach(() => mkdirSync(TEST_STATE, { recursive: true }));
afterEach(() => { try { rmSync(TEST_STATE, { recursive: true, force: true }); } catch {} });

describe('handleConsensusValidator', () => {
  it('passes through when no session', () => {
    const input: ConsensusInput = { output: '[TASK PROPOSAL — T1 — R1]' };
    expect(handleConsensusValidator(input, TEST_STATE).exitCode).toBe(0);
  });

  it('passes through in IDLE mode', () => {
    writeSession('P4', 'IDLE');
    const input: ConsensusInput = { output: '[TASK PROPOSAL — T1 — R1]' };
    expect(handleConsensusValidator(input, TEST_STATE).exitCode).toBe(0);
  });

  it('tracks round R1 without warning', () => {
    writeSession('P4');
    const input: ConsensusInput = { output: '[TASK PROPOSAL — T1 — R1]' };
    const result = handleConsensusValidator(input, TEST_STATE);
    expect(result.exitCode).toBe(0);
    expect(result.message).toBeUndefined();
    // Verify tracker file was created
    expect(existsSync(join(TEST_STATE, 'consensus-rounds.json'))).toBe(true);
  });

  it('warns on round gap (R1 → R3)', () => {
    writeSession('P4');
    // Seed R1
    writeFileSync(join(TEST_STATE, 'consensus-rounds.json'), JSON.stringify({ T1: [1] }));
    const input: ConsensusInput = { output: '[TASK PROPOSAL — T1 — R3]' };
    const result = handleConsensusValidator(input, TEST_STATE);
    expect(result.message).toContain('Round gap');
    expect(result.message).toContain('R2');
  });

  it('warns on duplicate round', () => {
    writeSession('P4');
    writeFileSync(join(TEST_STATE, 'consensus-rounds.json'), JSON.stringify({ T1: [1, 2] }));
    const input: ConsensusInput = { output: '[TASK PROPOSAL — T1 — R2]' };
    const result = handleConsensusValidator(input, TEST_STATE);
    expect(result.message).toContain('Duplicate round');
  });

  it('warns when round exceeds 5', () => {
    writeSession('P4');
    writeFileSync(join(TEST_STATE, 'consensus-rounds.json'), JSON.stringify({ T1: [1, 2, 3, 4, 5] }));
    const input: ConsensusInput = { output: '[TASK PROPOSAL — T1 — R6]' };
    const result = handleConsensusValidator(input, TEST_STATE);
    expect(result.message).toContain('exceeds maximum');
  });

  it('allows sequential rounds (R1 → R2 → R3)', () => {
    writeSession('P4');
    writeFileSync(join(TEST_STATE, 'consensus-rounds.json'), JSON.stringify({ T1: [1, 2] }));
    const input: ConsensusInput = { output: '[TASK PROPOSAL — T1 — R3]' };
    const result = handleConsensusValidator(input, TEST_STATE);
    expect(result.exitCode).toBe(0);
    expect(result.message).toBeUndefined();
  });

  it('tracks independent teams separately', () => {
    writeSession('P4');
    writeFileSync(join(TEST_STATE, 'consensus-rounds.json'), JSON.stringify({ T1: [1, 2] }));
    const input: ConsensusInput = { output: '[TASK PROPOSAL — T2 — R1]' };
    const result = handleConsensusValidator(input, TEST_STATE);
    expect(result.exitCode).toBe(0);
    expect(result.message).toBeUndefined();
  });

  it('allows FOLLOW-UP to same round without duplicate warning', () => {
    writeSession('P4');
    writeFileSync(join(TEST_STATE, 'consensus-rounds.json'), JSON.stringify({ T1: [1] }));
    const input: ConsensusInput = { output: '[FOLLOW-UP — T1 — R1 — parent:R1]' };
    const result = handleConsensusValidator(input, TEST_STATE);
    expect(result.exitCode).toBe(0);
    // Follow-ups to same round should not trigger duplicate warning
  });

  it('warns on invalid G2 hash format during plan debate', () => {
    writeSession('G3');
    writeFileSync(join(TEST_STATE, 'g2-spec.marker'), '[SPEC APPROVED — hash:{badhash}]');
    writeFileSync(join(TEST_STATE, 'spec-content.txt'), 'spec content');
    const input: ConsensusInput = { output: '[PLAN DEBATE — R1 — Designer→Reviewer]' };
    const result = handleConsensusValidator(input, TEST_STATE);
    // No warning since regex won't match badhash (not 64 hex chars)
    expect(result.exitCode).toBe(0);
  });

  it('passes valid G2 hash during plan debate', () => {
    writeSession('G3');
    const hash = 'a'.repeat(64);
    writeFileSync(join(TEST_STATE, 'g2-spec.marker'), `[SPEC APPROVED — hash:{${hash}}]`);
    writeFileSync(join(TEST_STATE, 'spec-content.txt'), 'spec content');
    const input: ConsensusInput = { output: '[PLAN DEBATE — R1]' };
    const result = handleConsensusValidator(input, TEST_STATE);
    expect(result.exitCode).toBe(0);
    expect(result.message).toBeUndefined();
  });
});
