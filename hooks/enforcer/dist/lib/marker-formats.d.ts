/**
 * Marker format definitions for hive protocol validation.
 * These regex patterns enforce the structural rules that were previously
 * prose instructions in SKILL.md files.
 */
export declare const G1_CLARIFY_RE: RegExp;
export declare const G2_SPEC_RE: RegExp;
export declare const G3_PLAN_RE: RegExp;
export declare const G4_TDD_RED_RE: RegExp;
export declare const G5_IMPLEMENT_RE: RegExp;
export declare const G6_CROSS_VERIFY_RE: RegExp;
export declare const G7_E2E_RE: RegExp;
export declare const TASK_PROPOSAL_RE: RegExp;
export declare const AGREE_RE: RegExp;
export declare const COUNTER_RE: RegExp;
export declare const CLARIFY_RE: RegExp;
export declare const CONSENSUS_DOC_RE: RegExp;
export declare const LEAD_DECISION_RE: RegExp;
export declare const FOLLOW_UP_RE: RegExp;
export declare const HIVE_IMPL_RE: RegExp;
export declare const CROSS_FEEDBACK_RE: RegExp;
export declare const TASK_PROPOSAL_SECTIONS: readonly ["목표", "담당 모듈", "제안 접근방식", "컨텍스트", "제약사항", "예상 산출물", "질문"];
/**
 * Validate that a TASK PROPOSAL body contains all 7 required sections.
 * Returns missing section names, or empty array if all present.
 */
export declare function validateTaskProposalSections(body: string): string[];
/**
 * Extract team ID from a consensus marker string.
 */
export declare function extractTeamId(marker: string): string | null;
/**
 * Extract round number from a marker string.
 */
export declare function extractRound(marker: string): number | null;
