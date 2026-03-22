import { describe, it, expect } from 'vitest';
import { PROMPT_FILE_THRESHOLD } from '../src/types.js';

describe('sender logic', () => {
  it('PROMPT_FILE_THRESHOLD is 500', () => {
    expect(PROMPT_FILE_THRESHOLD).toBe(500);
  });

  it('marker instruction format', () => {
    const marker = '[HIVE_DONE:abc123]';
    const instruction = `응답 마지막 줄에 반드시 ${marker} 를 그대로 출력해.`;
    expect(instruction).toContain(marker);
    expect(instruction).toContain('그대로 출력해');
  });

  it('short prompt stays inline', () => {
    const prompt = '짧은 질문';
    const marker = '[HIVE_DONE:abc]';
    const full = `${prompt} 응답 마지막 줄에 반드시 ${marker} 를 그대로 출력해.`;
    expect(full.length).toBeLessThan(PROMPT_FILE_THRESHOLD);
  });

  it('long prompt triggers file delivery', () => {
    const prompt = 'A'.repeat(600);
    const marker = '[HIVE_DONE:abc]';
    const full = `${prompt} 응답 마지막 줄에 반드시 ${marker} 를 그대로 출력해.`;
    expect(full.length).toBeGreaterThan(PROMPT_FILE_THRESHOLD);
  });
});
