import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const testDir = '/tmp/hive-tmux-test-sender';

// Mock types.ts to use test directory
vi.mock('../src/types.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../src/types.js')>();
  return {
    ...orig,
    REGISTRY_DIR: testDir,
    responseFilePath: (name: string) => `${testDir}/${name}-response.txt`,
  };
});

// Mock tmux.ts to avoid real tmux calls
const mockPasteFile = vi.fn();
const mockClearHistory = vi.fn();
vi.mock('../src/tmux.js', () => ({
  pasteFile: mockPasteFile,
  clearHistory: mockClearHistory,
  sendKeys: vi.fn(),
}));

const { sendInitial, sendFollowup } = await import('../src/sender.js');

describe('sender (real module)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure test dir exists
    const { mkdirSync } = require('node:fs');
    mkdirSync(testDir, { recursive: true });
  });

  it('sendInitial calls pasteFile with prompt file', () => {
    sendInitial('%42', 'test prompt', 'marker1', 'codex', 'test-worker');
    expect(mockPasteFile).toHaveBeenCalledOnce();
    const [paneId, filePath] = mockPasteFile.mock.calls[0]!;
    expect(paneId).toBe('%42');
    expect(filePath).toContain('test-worker-prompt.txt');
  });

  it('sendInitial writes prompt file with content', () => {
    sendInitial('%42', 'hello world', 'marker1', 'codex', 'test-worker', 'general');
    const [, filePath] = mockPasteFile.mock.calls[0]!;
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('hello world');
    expect(content).toContain('Completion');
  });

  it('review purpose includes Oracle XML tags', () => {
    sendInitial('%42', 'review this', 'marker1', 'codex', 'test-worker', 'review');
    const [, filePath] = mockPasteFile.mock.calls[0]!;
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('<role>');
    expect(content).toContain('<decision_framework>');
    expect(content).toContain('<scope_discipline>');
    expect(content).toContain('git diff');
  });

  it('implement purpose includes do_not_ask directive', () => {
    sendInitial('%42', 'implement this', 'marker1', 'codex', 'test-worker', 'implement');
    const [, filePath] = mockPasteFile.mock.calls[0]!;
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('<do_not_ask>');
    expect(content).toContain('KEEP GOING');
  });

  it('consensus purpose preserves prompt as-is', () => {
    sendInitial('%42', '[TASK PROPOSAL] my proposal', 'marker1', 'codex', 'test-worker', 'consensus');
    const [, filePath] = mockPasteFile.mock.calls[0]!;
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('[TASK PROPOSAL] my proposal');
    expect(content).not.toContain('<role>');
  });

  it('sendFollowup clears history before sending', () => {
    sendFollowup('%42', 'followup msg', 'marker2', 'test-worker');
    expect(mockClearHistory).toHaveBeenCalledWith('%42');
    expect(mockPasteFile).toHaveBeenCalledOnce();
  });

  it('sendInitial includes response file path in completion instruction', () => {
    sendInitial('%42', 'test', 'marker1', 'codex', 'my-worker', 'general');
    const [, filePath] = mockPasteFile.mock.calls[0]!;
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('my-worker-response.txt');
  });
});
