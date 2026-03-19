import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { handleIntentGate } from '../src/handlers/intent-gate.js';
import { readSession } from '../src/lib/state.js';

describe('Intent Gate handler', () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), 'hive-intent-'));
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it('creates session on /hive command', () => {
    const result = handleIntentGate('/hive implement feature X', stateDir);
    expect(result.exitCode).toBe(0);
    const session = readSession(stateDir);
    expect(session).not.toBeNull();
    expect(session!.mode).toBe('HIVE');
    expect(session!.phase).toBe('G1');
  });

  it('creates session on /hive with no args', () => {
    const result = handleIntentGate('/hive', stateDir);
    expect(result.exitCode).toBe(0);
    const session = readSession(stateDir);
    expect(session).not.toBeNull();
  });

  it('ignores non-hive prompts', () => {
    const result = handleIntentGate('just a normal question', stateDir);
    expect(result.exitCode).toBe(0);
    expect(readSession(stateDir)).toBeNull();
  });

  it('warns on duplicate /hive when session exists', () => {
    handleIntentGate('/hive first', stateDir);
    const result = handleIntentGate('/hive second', stateDir);
    expect(result.exitCode).toBe(0);
    expect(result.message).toMatch(/already active/i);
  });

  it('always exits 0 (never blocks user input)', () => {
    const result1 = handleIntentGate('/hive test', stateDir);
    const result2 = handleIntentGate('normal prompt', stateDir);
    const result3 = handleIntentGate('/hive again', stateDir);
    expect(result1.exitCode).toBe(0);
    expect(result2.exitCode).toBe(0);
    expect(result3.exitCode).toBe(0);
  });
});
