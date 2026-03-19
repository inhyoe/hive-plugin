import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  HiveSession,
  readSession,
  createSession,
  writeSession,
  advancePhase,
  addAgentSpawn,
} from '../src/lib/state.js';

describe('Session state manager', () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), 'hive-state-'));
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  describe('readSession', () => {
    it('returns not_found when no session file exists', () => {
      expect(readSession(stateDir).status).toBe('not_found');
    });

    it('returns parsed session when file exists', () => {
      createSession(stateDir);
      const result = readSession(stateDir);
      expect(result.status).toBe('ok');
      if (result.status === 'ok') {
        expect(result.session.mode).toBe('HIVE');
      }
    });
  });

  describe('createSession', () => {
    it('creates session with mode HIVE and phase G1', () => {
      const session = createSession(stateDir);
      expect(session.mode).toBe('HIVE');
      expect(session.phase).toBe('G1');
      expect(session.completedGates).toEqual([]);
      expect(session.agentSpawns).toEqual([]);
      expect(session.startedAt).toBeDefined();
    });

    it('writes session.json to stateDir', () => {
      createSession(stateDir);
      expect(existsSync(join(stateDir, 'session.json'))).toBe(true);
    });
  });

  describe('writeSession', () => {
    it('persists session changes', () => {
      const session = createSession(stateDir);
      session.phase = 'G2';
      writeSession(stateDir, session);
      const result = readSession(stateDir);
      expect(result.status).toBe('ok');
      if (result.status === 'ok') {
        expect(result.session.phase).toBe('G2');
      }
    });
  });

  describe('advancePhase', () => {
    it('advances to next phase', () => {
      createSession(stateDir);
      const updated = advancePhase(stateDir);
      expect(updated.phase).toBe('G2');
    });

    it('records completed gate', () => {
      createSession(stateDir);
      const updated = advancePhase(stateDir);
      expect(updated.completedGates).toContain('G1');
    });

    it('throws when no session exists', () => {
      expect(() => advancePhase(stateDir)).toThrow();
    });

    it('throws when already at last phase', () => {
      const session = createSession(stateDir);
      session.phase = 'P5';
      writeSession(stateDir, session);
      expect(() => advancePhase(stateDir)).toThrow();
    });

    it('reads fresh state (no stale cache)', () => {
      createSession(stateDir);
      advancePhase(stateDir); // G1 → G2
      const updated = advancePhase(stateDir); // G2 → P0
      expect(updated.phase).toBe('P0');
      expect(updated.completedGates).toEqual(['G1', 'G2']);
    });
  });

  describe('addAgentSpawn', () => {
    it('records agent spawn info', () => {
      createSession(stateDir);
      const updated = addAgentSpawn(stateDir, {
        type: 'Explore',
        phase: 'P0',
        timestamp: new Date().toISOString(),
      });
      expect(updated.agentSpawns).toHaveLength(1);
      expect(updated.agentSpawns[0].type).toBe('Explore');
    });

    it('appends multiple spawns', () => {
      createSession(stateDir);
      addAgentSpawn(stateDir, { type: 'Explore', phase: 'P0', timestamp: new Date().toISOString() });
      const updated = addAgentSpawn(stateDir, { type: 'Plan', phase: 'P1', timestamp: new Date().toISOString() });
      expect(updated.agentSpawns).toHaveLength(2);
    });
  });
});
