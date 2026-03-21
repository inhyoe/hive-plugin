import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { handleReadGatePre, handleReadGatePost } from '../src/handlers/read-gate.js';
import { writePendingReads, readPendingReads, clearReadPath, hasPendingReads } from '../src/lib/pending-reads.js';

const TEST_STATE = join(import.meta.dirname, '.test-state-rg');

function writeSession(phase: string, mode = 'HIVE') {
  mkdirSync(TEST_STATE, { recursive: true });
  writeFileSync(join(TEST_STATE, 'session.json'), JSON.stringify({
    mode, phase, completedGates: [], agentSpawns: [], startedAt: new Date().toISOString(),
  }));
}

beforeEach(() => mkdirSync(TEST_STATE, { recursive: true }));
afterEach(() => { try { rmSync(TEST_STATE, { recursive: true, force: true }); } catch {} });

describe('pending-reads lib', () => {
  it('writePendingReads + readPendingReads', () => {
    writeSession('P0');
    writePendingReads(TEST_STATE, ['skills/a.md', 'skills/b.md']);
    expect(readPendingReads(TEST_STATE)).toEqual(['skills/a.md', 'skills/b.md']);
  });

  it('hasPendingReads returns false when empty', () => {
    expect(hasPendingReads(TEST_STATE)).toBe(false);
  });

  it('hasPendingReads returns true when populated', () => {
    writeSession('P0');
    writePendingReads(TEST_STATE, ['skills/a.md']);
    expect(hasPendingReads(TEST_STATE)).toBe(true);
  });

  it('clearReadPath removes matching path', () => {
    writeSession('P0');
    writePendingReads(TEST_STATE, ['skills/a.md', 'skills/b.md']);
    const repoRoot = join(import.meta.dirname, '../../..');
    clearReadPath(TEST_STATE, 'skills/a.md', repoRoot);
    expect(readPendingReads(TEST_STATE)).toEqual(['skills/b.md']);
  });

  it('clearReadPath handles absolute path comparison', () => {
    writeSession('P0');
    const repoRoot = join(import.meta.dirname, '../../..');
    writePendingReads(TEST_STATE, ['skills/a.md']);
    clearReadPath(TEST_STATE, join(repoRoot, 'skills/a.md'), repoRoot);
    expect(readPendingReads(TEST_STATE)).toEqual([]);
  });
});

describe('handleReadGatePre', () => {
  it('passes when no session', () => {
    expect(handleReadGatePre(TEST_STATE).exitCode).toBe(0);
  });

  it('passes in IDLE mode', () => {
    writeSession('P0', 'IDLE');
    writePendingReads(TEST_STATE, ['skills/a.md']);
    expect(handleReadGatePre(TEST_STATE).exitCode).toBe(0);
  });

  it('passes when no pending reads', () => {
    writeSession('P0');
    expect(handleReadGatePre(TEST_STATE).exitCode).toBe(0);
  });

  it('blocks when pending reads exist', () => {
    writeSession('P0');
    writePendingReads(TEST_STATE, ['skills/hive-workflow/details/phase0-prompt-engineering.md']);
    const result = handleReadGatePre(TEST_STATE);
    expect(result.exitCode).toBe(2);
    expect(result.message).toContain('BLOCKED');
    expect(result.message).toContain('phase0-prompt-engineering.md');
  });

  it('blocks with multiple pending reads', () => {
    writeSession('P4');
    writePendingReads(TEST_STATE, ['skills/a.md', 'skills/b.md']);
    const result = handleReadGatePre(TEST_STATE);
    expect(result.exitCode).toBe(2);
    expect(result.message).toContain('skills/a.md');
    expect(result.message).toContain('skills/b.md');
  });
});

describe('handleReadGatePost', () => {
  const repoRoot = join(import.meta.dirname, '../../..');

  it('passes when no session', () => {
    const stdin = JSON.stringify({ tool_input: { file_path: 'skills/a.md' } });
    expect(handleReadGatePost(stdin, TEST_STATE, repoRoot).exitCode).toBe(0);
  });

  it('passes when no pending reads', () => {
    writeSession('P0');
    const stdin = JSON.stringify({ tool_input: { file_path: 'skills/a.md' } });
    expect(handleReadGatePost(stdin, TEST_STATE, repoRoot).exitCode).toBe(0);
  });

  it('clears path on successful Read', () => {
    writeSession('P0');
    writePendingReads(TEST_STATE, ['skills/a.md', 'skills/b.md']);
    const stdin = JSON.stringify({ tool_input: { file_path: 'skills/a.md' } });
    const result = handleReadGatePost(stdin, TEST_STATE, repoRoot);
    expect(result.exitCode).toBe(0);
    expect(result.message).toContain('1 file(s) remaining');
    expect(readPendingReads(TEST_STATE)).toEqual(['skills/b.md']);
  });

  it('reports all clear when last file read', () => {
    writeSession('P0');
    writePendingReads(TEST_STATE, ['skills/a.md']);
    const stdin = JSON.stringify({ tool_input: { file_path: 'skills/a.md' } });
    const result = handleReadGatePost(stdin, TEST_STATE, repoRoot);
    expect(result.exitCode).toBe(0);
    expect(result.message).toContain('All required detail files loaded');
  });

  it('does not clear on Read error', () => {
    writeSession('P0');
    writePendingReads(TEST_STATE, ['skills/a.md']);
    const stdin = JSON.stringify({ tool_input: { file_path: 'skills/a.md' }, tool_result: { error: 'File not found' } });
    const result = handleReadGatePost(stdin, TEST_STATE, repoRoot);
    expect(result.exitCode).toBe(0);
    expect(readPendingReads(TEST_STATE)).toEqual(['skills/a.md']);
  });
});
