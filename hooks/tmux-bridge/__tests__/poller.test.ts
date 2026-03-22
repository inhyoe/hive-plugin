import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';

const testDir = '/tmp/hive-tmux-test-poller';

// Mock types.ts
vi.mock('../src/types.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../src/types.js')>();
  return {
    ...orig,
    REGISTRY_DIR: testDir,
    REGISTRY_FILE: `${testDir}/sessions.json`,
    DEFAULT_POLL_INTERVAL: 50,
    DEFAULT_POLL_TIMEOUT: 1,
    responseFilePath: (name: string) => `${testDir}/${name}-response.txt`,
  };
});

// Mock tmux.ts
vi.mock('../src/tmux.js', () => ({
  capturePaneOutput: vi.fn(() => 'gpt-5.4 high · 95% left · ~/path'),
}));

const { poll } = await import('../src/poller.js');

describe('poller (real module)', () => {
  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(testDir, { recursive: true }); } catch { /* ok */ }
  });

  it('returns done when response file appears after poll starts', async () => {
    // Simulate real flow: file appears AFTER poll begins (codex writes it)
    setTimeout(() => writeFileSync(`${testDir}/test-response.txt`, 'AGREE — task complete'), 100);
    const result = await poll('%42', '', 2, 50, 'test');
    expect(result.status).toBe('done');
    expect(result.response).toContain('AGREE');
  });

  it('extracts token remaining from pane output', async () => {
    setTimeout(() => writeFileSync(`${testDir}/test-response.txt`, 'response content'), 100);
    const result = await poll('%42', '', 2, 50, 'test');
    expect(result.tokenRemaining).toBe('95% left');
  });

  it('returns timeout when no response file', async () => {
    const result = await poll('%42', '', 1, 50, 'missing');
    expect(result.status).toBe('timeout');
  });

  it('ignores empty response file', async () => {
    writeFileSync(`${testDir}/empty-response.txt`, '');
    const result = await poll('%42', '', 1, 50, 'empty');
    expect(result.status).toBe('timeout');
  });

  it('ignores whitespace-only response file', async () => {
    writeFileSync(`${testDir}/ws-response.txt`, '   \n  \n  ');
    const result = await poll('%42', '', 1, 50, 'ws');
    expect(result.status).toBe('timeout');
  });

  it('rejects stale response file (mtime before poll start)', async () => {
    const respFile = `${testDir}/stale-response.txt`;
    writeFileSync(respFile, 'old stale content');
    // Set mtime to 10 seconds ago
    const past = new Date(Date.now() - 10000);
    utimesSync(respFile, past, past);
    const result = await poll('%42', '', 1, 50, 'stale');
    expect(result.status).toBe('timeout');
  });
});
