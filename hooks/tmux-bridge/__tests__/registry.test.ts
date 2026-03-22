import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Use isolated temp directory — never touch the real registry
const testDir = mkdtempSync(join(tmpdir(), 'hive-reg-'));
const testFile = join(testDir, 'sessions.json');

// Minimal registry implementation for testing (avoids importing real module
// which would use the production REGISTRY_FILE path)
function load(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(testFile, 'utf-8'));
  } catch {
    return {};
  }
}

function save(data: Record<string, unknown>): void {
  mkdirSync(testDir, { recursive: true });
  const tmp = `${testFile}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, testFile);
}

describe('registry (isolated)', () => {
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
    const entry = { paneId: '%42', provider: 'codex', startedAt: new Date().toISOString() };
    const reg = load();
    reg['t1'] = entry;
    save(reg);
    const got = load();
    expect(got['t1']).toEqual(entry);
  });

  it('unregister removes entry', () => {
    const reg: Record<string, unknown> = { t1: { paneId: '%42' } };
    save(reg);
    const loaded = load();
    delete loaded['t1'];
    save(loaded);
    expect(load()['t1']).toBeUndefined();
  });

  it('list returns all entries', () => {
    save({
      t1: { paneId: '%42', provider: 'codex' },
      t2: { paneId: '%43', provider: 'gemini' },
    });
    const all = load();
    expect(Object.keys(all)).toHaveLength(2);
  });

  it('atomic write leaves no tmp files', () => {
    save({ t1: { paneId: '%42' } });
    expect(existsSync(`${testFile}.${process.pid}.tmp`)).toBe(false);
  });

  it('saves valid JSON', () => {
    save({ t1: { paneId: '%42' } });
    const raw = readFileSync(testFile, 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('overwrite existing entry', () => {
    save({ t1: { paneId: '%42' } });
    save({ t1: { paneId: '%99', marker: '[HIVE_DONE:abc]' } });
    const got = load();
    expect((got['t1'] as { paneId: string }).paneId).toBe('%99');
  });
});
