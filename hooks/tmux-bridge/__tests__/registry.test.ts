import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const testDir = mkdtempSync(join(tmpdir(), 'hive-reg-'));
const testFile = join(testDir, 'sessions.json');

// Mock types.ts to redirect registry to temp directory
vi.mock('../src/types.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../src/types.js')>();
  return { ...orig, REGISTRY_DIR: testDir, REGISTRY_FILE: testFile };
});

// Mock tmux.ts paneExists to avoid real tmux calls
vi.mock('../src/tmux.js', () => ({
  paneExists: vi.fn((id: string) => id !== '%dead'),
}));

// Import AFTER mocks are set up
const { load, save, register, unregister, get, list, reconcile } = await import('../src/registry.js');

describe('registry (real module)', () => {
  beforeEach(() => {
    try { rmSync(testFile); } catch { /* ok */ }
  });

  afterEach(() => {
    try { rmSync(testFile); } catch { /* ok */ }
  });

  it('load returns empty object when file missing', () => {
    expect(load()).toEqual({});
  });

  it('register and get', () => {
    const entry = { paneId: '%42', provider: 'codex' as const, startedAt: new Date().toISOString() };
    register('t1', entry);
    const got = get('t1');
    expect(got).toEqual(entry);
  });

  it('unregister removes entry', () => {
    register('t1', { paneId: '%42', provider: 'codex', startedAt: '' });
    unregister('t1');
    expect(get('t1')).toBeNull();
  });

  it('list returns all entries', () => {
    register('t1', { paneId: '%42', provider: 'codex', startedAt: '' });
    register('t2', { paneId: '%43', provider: 'gemini', startedAt: '' });
    expect(Object.keys(list())).toHaveLength(2);
  });

  it('overwrite existing entry', () => {
    register('t1', { paneId: '%42', provider: 'codex', startedAt: '' });
    register('t1', { paneId: '%99', provider: 'codex', startedAt: '', marker: '[HIVE_DONE:abc]' });
    expect(get('t1')!.paneId).toBe('%99');
  });

  it('reconcile removes dead panes', () => {
    register('alive', { paneId: '%42', provider: 'codex', startedAt: '' });
    register('dead', { paneId: '%dead', provider: 'gemini', startedAt: '' });
    const result = reconcile();
    expect(result['alive']).toBeDefined();
    expect(result['dead']).toBeUndefined();
  });

  it('reconcile preserves live panes', () => {
    register('a1', { paneId: '%10', provider: 'codex', startedAt: '' });
    register('a2', { paneId: '%20', provider: 'codex', startedAt: '' });
    const result = reconcile();
    expect(Object.keys(result)).toHaveLength(2);
  });
});
