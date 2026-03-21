/**
 * Marker format definitions for hive protocol validation.
 * These regex patterns enforce the structural rules that were previously
 * prose instructions in SKILL.md files.
 */
// --- Gate markers (G1-G7) ---
export const G1_CLARIFY_RE = /\[CLARIFY PASSED\s*—\s*scope:\{[^}]+\}\s*criteria:\{[^}]+\}\s*constraints:\{[^}]+\}\]/;
export const G2_SPEC_RE = /\[SPEC APPROVED\s*—\s*hash:\{([a-f0-9]{64})\}\]/;
export const G3_PLAN_RE = /\[PLAN DEBATE\s*—\s*CONSENSUS\s*—\s*overall:(\{[^}]+\}|[\d.]+)\]/;
export const G4_TDD_RED_RE = /\[TDD RED PASSED\s*—\s*test_count:\{?(\d+)\}?\s*fail_count:\{?(\d+)\}?\]/;
export const G5_IMPLEMENT_RE = /\[IMPLEMENT GREEN PASSED\s*—\s*pass:\{?(\d+)\/(\d+)\}?\s*iterations:\{?(\d+)\}?\]/;
export const G6_CROSS_VERIFY_RE = /\[CROSS-VERIFY PASSED\s*—\s*mutation:\{?(\d+)\}?%?\s*pbt:\{?(pass|fail)\}?\s*review:\{?(PASS|CONCERN|REJECT)\}?\]/i;
export const G7_E2E_RE = /\[E2E VALIDATE PASSED\s*—\s*type:\{?(A|B|C)\}?\s*result:\{[^}]+\}\]/;
// --- Consensus markers ---
export const TASK_PROPOSAL_RE = /\[TASK PROPOSAL\s*—\s*(\S+)\s*—\s*R(\d+)\]/;
export const AGREE_RE = /\[AGREE\s*—\s*(\S+)\]/;
export const COUNTER_RE = /\[COUNTER\s*—\s*(\S+)\]/;
export const CLARIFY_RE = /\[CLARIFY\s*—\s*(\S+)\]/;
export const CONSENSUS_DOC_RE = /## CONSENSUS:\s*(\S+)/;
export const LEAD_DECISION_RE = /\[LEAD DECISION\s*—\s*(\S+)\]/;
export const FOLLOW_UP_RE = /\[FOLLOW-UP\s*—\s*(\S+)\s*—\s*R(\d+)\s*—\s*parent:R(\d+)\]/;
// --- Implementation markers ---
export const HIVE_IMPL_RE = /\[HIVE IMPLEMENTATION\s*—\s*(\S+)\s*—\s*W(\d+)\]/;
export const CROSS_FEEDBACK_RE = /\[CROSS FEEDBACK\s*—\s*(\S+)→(\S+)\s*—\s*W?(\d+)\]/;
// --- TASK PROPOSAL required sections ---
export const TASK_PROPOSAL_SECTIONS = [
    '목표',
    '담당 모듈',
    '제안 접근방식',
    '컨텍스트',
    '제약사항',
    '예상 산출물',
    '질문',
];
/**
 * Validate that a TASK PROPOSAL body contains all 7 required sections.
 * Returns missing section names, or empty array if all present.
 */
export function validateTaskProposalSections(body) {
    const missing = [];
    for (const section of TASK_PROPOSAL_SECTIONS) {
        // Match "- 목표:" or "- **목표**:" patterns
        const pattern = new RegExp(`-\\s*(?:\\*\\*)?${section}(?:\\*\\*)?\\s*:`);
        if (!pattern.test(body)) {
            missing.push(section);
        }
    }
    return missing;
}
/**
 * Extract team ID from a consensus marker string.
 */
export function extractTeamId(marker) {
    const match = marker.match(TASK_PROPOSAL_RE)
        ?? marker.match(AGREE_RE)
        ?? marker.match(COUNTER_RE)
        ?? marker.match(CLARIFY_RE);
    return match ? match[1] : null;
}
/**
 * Extract round number from a marker string.
 */
export function extractRound(marker) {
    const match = marker.match(TASK_PROPOSAL_RE) ?? marker.match(FOLLOW_UP_RE);
    return match ? parseInt(match[2], 10) : null;
}
//# sourceMappingURL=marker-formats.js.map