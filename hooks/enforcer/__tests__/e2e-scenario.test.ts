import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { handleIntentGate } from '../src/handlers/intent-gate.js';
import { handlePhaseGuard } from '../src/handlers/phase-guard.js';
import { handleAgentDispatcher } from '../src/handlers/agent-dispatcher.js';
import { handleAgentTracker } from '../src/handlers/agent-tracker.js';
import { readSession, writeSession, HiveSession } from '../src/lib/state.js';

function getSession(stateDir: string): HiveSession | null {
  const r = readSession(stateDir);
  return r.status === 'ok' ? r.session : null;
}

describe('E2E scenario: full lifecycle', () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), 'hive-e2e-'));
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it('IDLE → /hive → G1 session', () => {
    expect(readSession(stateDir).status).toBe('not_found');
    handleIntentGate('/hive implement auth', stateDir);
    const session = getSession(stateDir);
    expect(session).not.toBeNull();
    expect(session!.mode).toBe('HIVE');
    expect(session!.phase).toBe('G1');
  });

  it('blocks marker forgery during HIVE mode', () => {
    handleIntentGate('/hive test', stateDir);
    const result = handlePhaseGuard('echo fake > .hive-state/g1.marker', stateDir);
    expect(result.exitCode).toBe(2);
    expect(result.message).toMatch(/forgery/i);
  });

  it('allows create-marker.sh for current gate', () => {
    handleIntentGate('/hive test', stateDir);
    const result = handlePhaseGuard('bash scripts/create-marker.sh g1', stateDir);
    expect(result.exitCode).toBe(0);
  });

  it('blocks phase skip (g3 at G1)', () => {
    handleIntentGate('/hive test', stateDir);
    const result = handlePhaseGuard('bash scripts/create-marker.sh g3', stateDir);
    expect(result.exitCode).toBe(2);
    expect(result.message).toMatch(/phase.*order|skip/i);
  });

  it('blocks git commit before P5', () => {
    handleIntentGate('/hive test', stateDir);
    const session = getSession(stateDir)!;
    session.phase = 'P3';
    writeSession(stateDir, session);

    const result = handlePhaseGuard('git commit -m "wip"', stateDir);
    expect(result.exitCode).toBe(2);
    expect(result.message).toMatch(/commit.*P5/i);
  });

  it('allows git commit at P5', () => {
    handleIntentGate('/hive test', stateDir);
    const session = getSession(stateDir)!;
    session.phase = 'P5';
    writeSession(stateDir, session);

    const result = handlePhaseGuard('git commit -m "feat: done"', stateDir);
    expect(result.exitCode).toBe(0);
  });

  it('warns about non-consensus agent at P4', () => {
    handleIntentGate('/hive test', stateDir);
    const session = getSession(stateDir)!;
    session.phase = 'P4';
    writeSession(stateDir, session);

    const result = handleAgentDispatcher({
      prompt: 'implement something',
      subagentType: 'general-purpose',
      description: 'implement',
    }, stateDir);
    expect(result.exitCode).toBe(0);
    expect(result.message).toMatch(/warn|consensus/i);
  });

  it('tracks agent spawns with team ID', () => {
    handleIntentGate('/hive test', stateDir);
    const session = getSession(stateDir)!;
    session.phase = 'P4';
    writeSession(stateDir, session);

    handleAgentTracker({
      prompt: 'consensus for team-alpha',
      subagentType: 'general-purpose',
      description: 'consensus team-alpha',
    }, stateDir);

    const updated = getSession(stateDir)!;
    expect(updated.agentSpawns).toHaveLength(1);
    expect(updated.agentSpawns[0].teamId).toBe('team-alpha');
    expect(existsSync(join(stateDir, 'conversations'))).toBe(true);
  });

  it('P5 implementation agent tracked and allowed', () => {
    handleIntentGate('/hive test', stateDir);
    const session = getSession(stateDir)!;
    session.phase = 'P5';
    writeSession(stateDir, session);

    const dispatchResult = handleAgentDispatcher({
      prompt: 'implement feature',
      subagentType: 'general-purpose',
      description: 'implement',
    }, stateDir);
    expect(dispatchResult.exitCode).toBe(0);
    expect(dispatchResult.message).toBeUndefined();

    handleAgentTracker({
      prompt: 'implement for team-beta',
      subagentType: 'general-purpose',
      description: 'team-beta implementation',
    }, stateDir);

    expect(existsSync(join(stateDir, 'implementations'))).toBe(true);
  });
});
