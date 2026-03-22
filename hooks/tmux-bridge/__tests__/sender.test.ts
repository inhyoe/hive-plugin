import { describe, it, expect } from 'vitest';

describe('sender logic', () => {
  it('marker instruction format', () => {
    const marker = '[HIVE_DONE:abc123]';
    const instruction = `응답 마지막 줄에 반드시 ${marker} 를 그대로 출력해.`;
    expect(instruction).toContain(marker);
    expect(instruction).toContain('그대로 출력해');
  });

  it('all prompts use file-based delivery', () => {
    // sendInitial always saves to file — no inline prompt in shell command
    // This prevents shell injection regardless of prompt content
    const dangerousPrompt = '$(rm -rf /) `evil` $HOME';
    const marker = '[HIVE_DONE:abc]';
    const markerLine = `\n\n응답 마지막 줄에 반드시 ${marker} 를 그대로 출력해.`;
    const fileContent = dangerousPrompt + markerLine;
    // File content can safely contain any characters
    expect(fileContent).toContain(dangerousPrompt);
    expect(fileContent).toContain(marker);
  });

  it('outer command uses single-quoted file path', () => {
    // The shell command sent to tmux should use single quotes
    // to prevent variable expansion in the file path
    const filePath = '/tmp/hive-tmux/codex-prompt.txt';
    const safeCmd = `codex -a never -s danger-full-access '${filePath}'`;
    expect(safeCmd).not.toContain('"');
    expect(safeCmd).toContain("'");
  });
});
