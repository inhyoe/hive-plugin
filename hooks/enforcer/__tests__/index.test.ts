import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const CLI = join(import.meta.dirname, '..', 'dist', 'index.js');

function run(handler: string, stdin: string, stateDir: string): { exitCode: number; stderr: string } {
  try {
    const result = execSync(`echo '${stdin.replace(/'/g, "'\\''")}' | node ${CLI} ${handler}`, {
      env: { ...process.env, HIVE_STATE_DIR: stateDir },
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stderr: '' };
  } catch (err: any) {
    return { exitCode: err.status ?? 1, stderr: err.stderr ?? '' };
  }
}

describe('CLI entry point', () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = mkdtempSync(join(tmpdir(), 'hive-cli-'));
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it('intent-gate activates on /hive', () => {
    const { exitCode } = run('intent-gate', JSON.stringify({ prompt: '/hive test' }), stateDir);
    expect(exitCode).toBe(0);
  });

  it('phase-guard blocks forgery', () => {
    // First create a session
    run('intent-gate', JSON.stringify({ prompt: '/hive test' }), stateDir);
    // Then try forgery
    const { exitCode } = run('phase-guard',
      JSON.stringify({ tool_input: { command: 'echo x > .hive-state/g1.marker' } }),
      stateDir);
    expect(exitCode).toBe(2);
  });

  it('phase-guard allows create-marker.sh', () => {
    run('intent-gate', JSON.stringify({ prompt: '/hive test' }), stateDir);
    const { exitCode } = run('phase-guard',
      JSON.stringify({ tool_input: { command: 'bash scripts/create-marker.sh g1' } }),
      stateDir);
    expect(exitCode).toBe(0);
  });

  it('unknown handler exits 0', () => {
    const { exitCode } = run('nonexistent', '{}', stateDir);
    expect(exitCode).toBe(0);
  });
});
