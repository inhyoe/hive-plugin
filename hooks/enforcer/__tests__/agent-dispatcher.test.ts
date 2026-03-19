import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { handleAgentDispatcher } from '../src/handlers/agent-dispatcher.js';
import { createSession, writeSession } from '../src/lib/state.js';

describe('Agent Dispatcher handler', () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), 'hive-dispatch-'));
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  describe('IDLE mode', () => {
    it('passes through when no session', () => {
      const result = handleAgentDispatcher({
        prompt: 'do something',
        subagentType: 'general-purpose',
        description: 'test',
      }, stateDir);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('P0 — Research only', () => {
    it('allows Explore agent', () => {
      createSession(stateDir);
      const s = createSession(stateDir);
      s.phase = 'P0';
      writeSession(stateDir, s);

      const result = handleAgentDispatcher({
        prompt: 'explore codebase',
        subagentType: 'Explore',
        description: 'explore code',
      }, stateDir);
      expect(result.exitCode).toBe(0);
    });

    it('warns on implementation agent at P0', () => {
      const s = createSession(stateDir);
      s.phase = 'P0';
      writeSession(stateDir, s);

      const result = handleAgentDispatcher({
        prompt: 'implement feature',
        subagentType: 'general-purpose',
        description: 'implement',
      }, stateDir);
      expect(result.exitCode).toBe(0);
      expect(result.message).toMatch(/warn|not recommended/i);
    });
  });

  describe('P3 — Agent warning', () => {
    it('warns when spawning agents at P3', () => {
      const s = createSession(stateDir);
      s.phase = 'P3';
      writeSession(stateDir, s);

      const result = handleAgentDispatcher({
        prompt: 'decompose tasks',
        subagentType: 'general-purpose',
        description: 'decompose',
      }, stateDir);
      expect(result.exitCode).toBe(0);
      expect(result.message).toMatch(/warn|P3/i);
    });
  });

  describe('P4 — Consensus phase', () => {
    it('requires consensus keyword and team ID', () => {
      const s = createSession(stateDir);
      s.phase = 'P4';
      writeSession(stateDir, s);

      const result = handleAgentDispatcher({
        prompt: 'consensus review for team-alpha',
        subagentType: 'general-purpose',
        description: 'consensus team-alpha',
      }, stateDir);
      expect(result.exitCode).toBe(0);
    });

    it('warns when missing consensus keyword', () => {
      const s = createSession(stateDir);
      s.phase = 'P4';
      writeSession(stateDir, s);

      const result = handleAgentDispatcher({
        prompt: 'implement something',
        subagentType: 'general-purpose',
        description: 'implement',
      }, stateDir);
      expect(result.exitCode).toBe(0);
      expect(result.message).toMatch(/warn|consensus/i);
    });

    it('warns when missing team ID', () => {
      const s = createSession(stateDir);
      s.phase = 'P4';
      writeSession(stateDir, s);

      const result = handleAgentDispatcher({
        prompt: 'consensus review',
        subagentType: 'general-purpose',
        description: 'consensus',
      }, stateDir);
      expect(result.exitCode).toBe(0);
      expect(result.message).toMatch(/warn|team/i);
    });
  });

  describe('P5 — Implementation phase', () => {
    it('allows implementation agents', () => {
      const s = createSession(stateDir);
      s.phase = 'P5';
      writeSession(stateDir, s);

      const result = handleAgentDispatcher({
        prompt: 'implement the feature',
        subagentType: 'general-purpose',
        description: 'implement feature',
      }, stateDir);
      expect(result.exitCode).toBe(0);
      expect(result.message).toBeUndefined();
    });
  });

  it('always exits 0 (advisory only)', () => {
    const s = createSession(stateDir);
    s.phase = 'P0';
    writeSession(stateDir, s);

    const result = handleAgentDispatcher({
      prompt: 'do bad thing',
      subagentType: 'general-purpose',
      description: 'bad',
    }, stateDir);
    expect(result.exitCode).toBe(0);
  });
});
