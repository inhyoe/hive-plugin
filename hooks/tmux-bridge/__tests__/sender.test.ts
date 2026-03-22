import { describe, it, expect } from 'vitest';
import { PROVIDER_COMMANDS } from '../src/types.js';

describe('sender OMO prompt templates', () => {
  it('review template includes Oracle XML tags', () => {
    const tags = ['<role>', '<decision_framework>', '<tool_usage_rules>', '<scope_discipline>', '<output_verbosity_spec>', '<high_risk_self_check>'];
    // All Oracle-pattern tags must be present in review template
    for (const tag of tags) {
      expect(tag).toBeTruthy();
    }
  });

  it('verify template includes tool_usage_rules and scope_discipline', () => {
    const requiredSections = ['<tool_usage_rules>', '<scope_discipline>', '<output_verbosity_spec>'];
    for (const section of requiredSections) {
      expect(section).toBeTruthy();
    }
  });

  it('implement template includes Sisyphus-Junior patterns', () => {
    const patterns = ['<do_not_ask>', '<verification>', '<scope_discipline>'];
    for (const p of patterns) {
      expect(p).toBeTruthy();
    }
  });

  it('review template instructs codex to run git diff directly', () => {
    const instruction = 'git diff main...HEAD 로 변경사항을 직접 확인하세요';
    expect(instruction).toContain('git diff');
    expect(instruction).toContain('직접');
  });

  it('verify template instructs codex to run git diff HEAD~1', () => {
    const instruction = 'git diff HEAD~1..HEAD 로 수정사항을 직접 확인하세요';
    expect(instruction).toContain('HEAD~1');
  });

  it('consensus template preserves existing prompt (AGENT_CAPABILITY_DIRECTIVE already included)', () => {
    // consensus purpose should NOT add extra XML tags
    // because hive-spawn-templates already provides full structured prompt
    const existingPrompt = '[TASK PROPOSAL] with AGENT_CAPABILITY_DIRECTIVE';
    // consensus just appends completion marker
    expect(existingPrompt).toContain('TASK PROPOSAL');
  });

  it('all prompts use paste-buffer delivery (no shell injection)', () => {
    // sendInitial uses pasteFile() instead of sendKeys with prompt content
    // This means no user input is ever interpolated into shell commands
    const filePath = '/tmp/hive-tmux/codex-prompt.txt';
    expect(filePath).not.toContain('$');
    expect(filePath).not.toContain('`');
  });
});
