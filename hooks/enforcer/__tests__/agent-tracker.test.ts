import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { handleAgentTracker } from '../src/handlers/agent-tracker.js';
import { createSession, writeSession, readSession } from '../src/lib/state.js';

describe('Agent Tracker handler', () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), 'hive-tracker-'));
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it('ignores when no session', () => {
    const result = handleAgentTracker({
      prompt: 'test',
      subagentType: 'Explore',
      description: 'test',
    }, stateDir);
    expect(result.exitCode).toBe(0);
  });

  it('records agentSpawns in session', () => {
    createSession(stateDir);
    handleAgentTracker({
      prompt: 'explore code',
      subagentType: 'Explore',
      description: 'explore',
    }, stateDir);
    const result = readSession(stateDir);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.session.agentSpawns).toHaveLength(1);
      expect(result.session.agentSpawns[0].type).toBe('Explore');
    }
  });

  it('saves conversation log at P4', () => {
    const s = createSession(stateDir);
    s.phase = 'P4';
    writeSession(stateDir, s);

    handleAgentTracker({
      prompt: 'consensus for team-alpha module',
      subagentType: 'general-purpose',
      description: 'consensus team-alpha',
    }, stateDir);

    const convDir = join(stateDir, 'conversations');
    expect(existsSync(convDir)).toBe(true);
  });

  it('saves implementation log at P5', () => {
    const s = createSession(stateDir);
    s.phase = 'P5';
    writeSession(stateDir, s);

    handleAgentTracker({
      prompt: 'implement feature for team-beta',
      subagentType: 'general-purpose',
      description: 'implement team-beta',
    }, stateDir);

    const implDir = join(stateDir, 'implementations');
    expect(existsSync(implDir)).toBe(true);
  });

  it('extracts team ID from prompt', () => {
    const s = createSession(stateDir);
    s.phase = 'P4';
    writeSession(stateDir, s);

    handleAgentTracker({
      prompt: 'consensus review for team-alpha',
      subagentType: 'general-purpose',
      description: 'consensus',
    }, stateDir);

    const result = readSession(stateDir);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.session.agentSpawns[0].teamId).toBe('team-alpha');
    }
  });

  it('always exits 0', () => {
    createSession(stateDir);
    const result = handleAgentTracker({
      prompt: 'anything',
      subagentType: 'Explore',
      description: 'test',
    }, stateDir);
    expect(result.exitCode).toBe(0);
  });
});
