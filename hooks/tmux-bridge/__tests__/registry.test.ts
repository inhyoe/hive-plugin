import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Override registry constants before importing
const testDir = mkdtempSync(join(tmpdir(), 'hive-reg-'));
const testFile = join(testDir, 'sessions.json');

// We test the pure logic by directly manipulating the module
import * as registry from '../src/registry.js';
import { REGISTRY_FILE } from '../src/types.js';

describe('registry', () => {
  beforeEach(() => {
    // Clean up any existing registry file
    try { rmSync(REGISTRY_FILE); } catch { /* ok */ }
  });

  afterEach(() => {
    try { rmSync(REGISTRY_FILE); } catch { /* ok */ }
  });

  it('load returns empty object when file missing', () => {
    const result = registry.load();
    expect(result).toEqual({});
  });

  it('register and get', () => {
    const entry = {
      paneId: '%42',
      provider: 'codex' as const,
      startedAt: new Date().toISOString(),
    };
    registry.register('t1', entry);
    const got = registry.get('t1');
    expect(got).toEqual(entry);
  });

  it('unregister removes entry', () => {
    registry.register('t1', {
      paneId: '%42',
      provider: 'codex',
      startedAt: new Date().toISOString(),
    });
    registry.unregister('t1');
    expect(registry.get('t1')).toBeNull();
  });

  it('list returns all entries', () => {
    registry.register('t1', {
      paneId: '%42',
      provider: 'codex',
      startedAt: new Date().toISOString(),
    });
    registry.register('t2', {
      paneId: '%43',
      provider: 'gemini',
      startedAt: new Date().toISOString(),
    });
    const all = registry.list();
    expect(Object.keys(all)).toHaveLength(2);
    expect(all['t1']?.paneId).toBe('%42');
    expect(all['t2']?.paneId).toBe('%43');
  });

  it('atomic write leaves no tmp files', () => {
    registry.register('t1', {
      paneId: '%42',
      provider: 'codex',
      startedAt: new Date().toISOString(),
    });
    // Check no .tmp files exist
    const tmpFiles = existsSync(`${REGISTRY_FILE}.${process.pid}.tmp`);
    expect(tmpFiles).toBe(false);
  });

  it('saves valid JSON', () => {
    registry.register('t1', {
      paneId: '%42',
      provider: 'codex',
      startedAt: new Date().toISOString(),
    });
    const raw = readFileSync(REGISTRY_FILE, 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('overwrite existing entry', () => {
    registry.register('t1', {
      paneId: '%42',
      provider: 'codex',
      startedAt: new Date().toISOString(),
    });
    registry.register('t1', {
      paneId: '%99',
      provider: 'codex',
      startedAt: new Date().toISOString(),
      marker: '[HIVE_DONE:abc]',
    });
    const got = registry.get('t1');
    expect(got?.paneId).toBe('%99');
    expect(got?.marker).toBe('[HIVE_DONE:abc]');
  });
});
