import { describe, it, expect } from 'vitest';
import {
  G1_CLARIFY_RE, G2_SPEC_RE, G3_PLAN_RE,
  G4_TDD_RED_RE, G5_IMPLEMENT_RE, G6_CROSS_VERIFY_RE, G7_E2E_RE,
  TASK_PROPOSAL_RE, AGREE_RE, COUNTER_RE, CLARIFY_RE,
  FOLLOW_UP_RE, HIVE_IMPL_RE, CROSS_FEEDBACK_RE,
  validateTaskProposalSections, extractTeamId, extractRound,
} from '../src/lib/marker-formats.js';

describe('Gate marker regexes', () => {
  it('G1 CLARIFY', () => {
    expect(G1_CLARIFY_RE.test('[CLARIFY PASSED — scope:{auth} criteria:{tests pass} constraints:{none}]')).toBe(true);
    expect(G1_CLARIFY_RE.test('[CLARIFY FAILED]')).toBe(false);
  });

  it('G2 SPEC', () => {
    const hash = 'a'.repeat(64);
    expect(G2_SPEC_RE.test(`[SPEC APPROVED — hash:{${hash}}]`)).toBe(true);
    expect(G2_SPEC_RE.test('[SPEC APPROVED — hash:{short}]')).toBe(false);
  });

  it('G3 PLAN', () => {
    expect(G3_PLAN_RE.test('[PLAN DEBATE — CONSENSUS — overall:7.5]')).toBe(true);
    expect(G3_PLAN_RE.test('[PLAN DEBATE — CONSENSUS — overall:{7.5}]')).toBe(true);
  });

  it('G4 TDD RED', () => {
    expect(G4_TDD_RED_RE.test('[TDD RED PASSED — test_count:7 fail_count:7]')).toBe(true);
    expect(G4_TDD_RED_RE.test('[TDD RED PASSED — test_count:{7} fail_count:{7}]')).toBe(true);
  });

  it('G5 IMPLEMENT', () => {
    expect(G5_IMPLEMENT_RE.test('[IMPLEMENT GREEN PASSED — pass:7/7 iterations:3]')).toBe(true);
  });

  it('G6 CROSS-VERIFY', () => {
    expect(G6_CROSS_VERIFY_RE.test('[CROSS-VERIFY PASSED — mutation:65% pbt:pass review:PASS]')).toBe(true);
    expect(G6_CROSS_VERIFY_RE.test('[CROSS-VERIFY PASSED — mutation:{65} pbt:{pass} review:{CONCERN}]')).toBe(true);
  });

  it('G7 E2E', () => {
    expect(G7_E2E_RE.test('[E2E VALIDATE PASSED — type:C result:{all pass}]')).toBe(true);
    expect(G7_E2E_RE.test('[E2E VALIDATE PASSED — type:{A} result:{ok}]')).toBe(true);
  });
});

describe('Consensus marker regexes', () => {
  it('TASK PROPOSAL', () => {
    const m = '[TASK PROPOSAL — T1-auth — R1]'.match(TASK_PROPOSAL_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('T1-auth');
    expect(m![2]).toBe('1');
  });

  it('AGREE', () => {
    const m = '[AGREE — T2]'.match(AGREE_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('T2');
  });

  it('COUNTER', () => {
    const m = '[COUNTER — T1-auth]'.match(COUNTER_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('T1-auth');
  });

  it('CLARIFY', () => {
    const m = '[CLARIFY — T3]'.match(CLARIFY_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('T3');
  });

  it('FOLLOW-UP', () => {
    const m = '[FOLLOW-UP — T1 — R2 — parent:R1]'.match(FOLLOW_UP_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('T1');
    expect(m![2]).toBe('2');
    expect(m![3]).toBe('1');
  });

  it('HIVE IMPLEMENTATION', () => {
    const m = '[HIVE IMPLEMENTATION — T2 — W1]'.match(HIVE_IMPL_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('T2');
    expect(m![2]).toBe('1');
  });

  it('CROSS FEEDBACK', () => {
    const m = '[CROSS FEEDBACK — T3→T1 — W2]'.match(CROSS_FEEDBACK_RE);
    expect(m).not.toBeNull();
    expect(m![1]).toBe('T3');
    expect(m![2]).toBe('T1');
  });
});

describe('validateTaskProposalSections', () => {
  it('returns empty for complete proposal', () => {
    const body = `
- 목표: build auth
- 담당 모듈: auth module
- 제안 접근방식: JWT
- 컨텍스트: serena results
- 제약사항: none
- 예상 산출물: auth.ts
- 질문: agree?
`;
    expect(validateTaskProposalSections(body)).toEqual([]);
  });

  it('returns missing sections', () => {
    const body = `
- 목표: build auth
- 담당 모듈: auth
`;
    const missing = validateTaskProposalSections(body);
    expect(missing).toContain('제안 접근방식');
    expect(missing).toContain('컨텍스트');
    expect(missing).toContain('제약사항');
    expect(missing).toContain('예상 산출물');
    expect(missing).toContain('질문');
    expect(missing.length).toBe(5);
  });

  it('handles bold section names', () => {
    const body = `
- **목표**: build
- **담당 모듈**: mod
- **제안 접근방식**: approach
- **컨텍스트**: ctx
- **제약사항**: none
- **예상 산출물**: output
- **질문**: q?
`;
    expect(validateTaskProposalSections(body)).toEqual([]);
  });
});

describe('extractTeamId', () => {
  it('extracts from AGREE', () => {
    expect(extractTeamId('[AGREE — T1]')).toBe('T1');
  });
  it('extracts from TASK PROPOSAL', () => {
    expect(extractTeamId('[TASK PROPOSAL — T2-api — R3]')).toBe('T2-api');
  });
  it('returns null for no match', () => {
    expect(extractTeamId('no marker here')).toBeNull();
  });
});

describe('extractRound', () => {
  it('extracts from TASK PROPOSAL', () => {
    expect(extractRound('[TASK PROPOSAL — T1 — R3]')).toBe(3);
  });
  it('extracts from FOLLOW-UP', () => {
    expect(extractRound('[FOLLOW-UP — T1 — R2 — parent:R1]')).toBe(2);
  });
  it('returns null for AGREE', () => {
    expect(extractRound('[AGREE — T1]')).toBeNull();
  });
});
