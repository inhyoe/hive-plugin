import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { handleIntentGate } from '../src/handlers/intent-gate.js';
import { handlePhaseGuard } from '../src/handlers/phase-guard.js';
import { handleAgentDispatcher } from '../src/handlers/agent-dispatcher.js';
import { handleAgentTracker } from '../src/handlers/agent-tracker.js';
import { readSession, writeSession, advancePhase, HiveSession } from '../src/lib/state.js';

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

  it('handler + advancePhase lifecycle: G1 → G2 → P0 with completedGates', () => {
    // Initialize via real handler
    handleIntentGate('/hive lifecycle test', stateDir);
    let session = getSession(stateDir)!;
    expect(session.phase).toBe('G1');
    expect(session.completedGates).toHaveLength(0);

    // Advance through real state transitions
    session = advancePhase(stateDir); // G1 → G2
    expect(session.phase).toBe('G2');
    expect(session.completedGates).toContain('G1');

    session = advancePhase(stateDir); // G2 → P0
    expect(session.phase).toBe('P0');
    expect(session.completedGates).toEqual(['G1', 'G2']);

    // Verify phase-guard at P0: create-marker for current phase works
    const guardP0 = handlePhaseGuard('bash scripts/create-marker.sh p0', stateDir);
    expect(guardP0.exitCode).toBe(0);

    // Verify phase-guard at P0: skip to p3 blocked
    const guardSkip = handlePhaseGuard('bash scripts/create-marker.sh p3', stateDir);
    expect(guardSkip.exitCode).toBe(2);

    // Agent dispatcher at P0: Explore allowed
    const dispatchExplore = handleAgentDispatcher({
      prompt: 'explore codebase',
      subagentType: 'Explore',
      description: 'explore',
    }, stateDir);
    expect(dispatchExplore.exitCode).toBe(0);
    expect(dispatchExplore.message).toBeUndefined();
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
