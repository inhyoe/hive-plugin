import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { handlePhaseGuard } from '../src/handlers/phase-guard.js';
import { createSession, writeSession, readSession } from '../src/lib/state.js';

describe('Phase Guard handler', () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), 'hive-guard-'));
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  describe('IDLE mode (no session)', () => {
    it('passes through all commands when no session', () => {
      const result = handlePhaseGuard('echo hello', stateDir);
      expect(result.exitCode).toBe(0);
    });

    it('passes through git commit when no session', () => {
      const result = handlePhaseGuard('git commit -m "test"', stateDir);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('marker forgery detection', () => {
    it('blocks echo to .marker file', () => {
      createSession(stateDir);
      const result = handlePhaseGuard('echo test > .hive-state/g1.marker', stateDir);
      expect(result.exitCode).toBe(2);
      expect(result.message).toMatch(/forgery|direct marker/i);
    });

    it('blocks printf to .marker file', () => {
      createSession(stateDir);
      const result = handlePhaseGuard('printf "data" > .hive-state/p0.marker', stateDir);
      expect(result.exitCode).toBe(2);
    });

    it('blocks cat heredoc to .marker', () => {
      createSession(stateDir);
      const result = handlePhaseGuard('cat <<EOF > .hive-state/g2.marker', stateDir);
      expect(result.exitCode).toBe(2);
    });

    it('allows create-marker.sh', () => {
      createSession(stateDir);
      const result = handlePhaseGuard('bash scripts/create-marker.sh g1', stateDir);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('phase order enforcement', () => {
    it('allows create-marker.sh for current phase gate', () => {
      createSession(stateDir); // phase: G1
      const result = handlePhaseGuard('bash scripts/create-marker.sh g1', stateDir);
      expect(result.exitCode).toBe(0);
    });

    it('blocks create-marker.sh for future gate', () => {
      createSession(stateDir); // phase: G1
      const result = handlePhaseGuard('bash scripts/create-marker.sh g3', stateDir);
      expect(result.exitCode).toBe(2);
      expect(result.message).toMatch(/phase.*order|skip/i);
    });

    it('blocks backward gate', () => {
      const session = createSession(stateDir);
      session.phase = 'P3';
      session.completedGates = ['G1', 'G2', 'P0', 'P1', 'P2'];
      writeSession(stateDir, session);
      const result = handlePhaseGuard('bash scripts/create-marker.sh g1', stateDir);
      expect(result.exitCode).toBe(2);
    });
  });

  describe('git commit gating', () => {
    it('blocks git commit before P5', () => {
      const session = createSession(stateDir);
      session.phase = 'P3';
      writeSession(stateDir, session);
      const result = handlePhaseGuard('git commit -m "wip"', stateDir);
      expect(result.exitCode).toBe(2);
      expect(result.message).toMatch(/commit.*P5|not allowed/i);
    });

    it('allows git commit at P5', () => {
      const session = createSession(stateDir);
      session.phase = 'P5';
      writeSession(stateDir, session);
      const result = handlePhaseGuard('git commit -m "feat: done"', stateDir);
      expect(result.exitCode).toBe(0);
    });

    it('blocks git commit at G1', () => {
      createSession(stateDir); // phase: G1
      const result = handlePhaseGuard('git commit -m "test"', stateDir);
      expect(result.exitCode).toBe(2);
    });
  });

  describe('hive-state write protection (C1)', () => {
    it('blocks direct write to session.json', () => {
      createSession(stateDir);
      const result = handlePhaseGuard('echo \'{"mode":"IDLE"}\' > .hive-state/session.json', stateDir);
      expect(result.exitCode).toBe(2);
      expect(result.message).toMatch(/\.hive-state/);
    });

    it('blocks cp to hive-state', () => {
      createSession(stateDir);
      const result = handlePhaseGuard('cp fake.json .hive-state/session.json', stateDir);
      expect(result.exitCode).toBe(2);
    });

    it('blocks rm of hive-state files', () => {
      createSession(stateDir);
      const result = handlePhaseGuard('rm .hive-state/session.json', stateDir);
      expect(result.exitCode).toBe(2);
    });

    it('allows cat (read) of hive-state files', () => {
      createSession(stateDir);
      const result = handlePhaseGuard('cat .hive-state/session.json', stateDir);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('shell chaining prevention (C2)', () => {
    it('blocks create-marker.sh with && chain', () => {
      createSession(stateDir);
      const result = handlePhaseGuard('bash scripts/create-marker.sh g1 && git commit -m x', stateDir);
      expect(result.exitCode).toBe(2);
      expect(result.message).toMatch(/chaining|standalone/i);
    });

    it('blocks create-marker.sh with ; chain', () => {
      createSession(stateDir);
      const result = handlePhaseGuard('bash scripts/create-marker.sh g1; rm -rf /', stateDir);
      expect(result.exitCode).toBe(2);
    });

    it('blocks create-marker.sh with pipe', () => {
      createSession(stateDir);
      const result = handlePhaseGuard('bash scripts/create-marker.sh g1 | tee log', stateDir);
      expect(result.exitCode).toBe(2);
    });

    it('allows standalone create-marker.sh', () => {
      createSession(stateDir);
      const result = handlePhaseGuard('bash scripts/create-marker.sh g1', stateDir);
      expect(result.exitCode).toBe(0);
    });

    it('allows create-marker.sh with flags', () => {
      createSession(stateDir);
      const result = handlePhaseGuard('bash scripts/create-marker.sh g1 --team-id alpha --evidence-file spec.md', stateDir);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('non-matching commands', () => {
    it('allows git add during HIVE mode', () => {
      createSession(stateDir);
      const result = handlePhaseGuard('git add .', stateDir);
      expect(result.exitCode).toBe(0);
    });

    it('allows ls during HIVE mode', () => {
      createSession(stateDir);
      const result = handlePhaseGuard('ls -la', stateDir);
      expect(result.exitCode).toBe(0);
    });
  });
});
