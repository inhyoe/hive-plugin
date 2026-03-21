/**
 * Maps each phase to the detail files that MUST be Read before proceeding.
 * Paths are repo-relative (resolved against CLAUDE_PLUGIN_ROOT at runtime).
 */
export const PHASE_CONTEXT_MAP = {
    'G1': [],
    'G2': ['skills/hive-quality-gates/details/g2-spec.md'],
    'P0': ['skills/hive-workflow/details/phase0-prompt-engineering.md'],
    'P1': ['skills/hive-workflow/details/phase1-brainstorm.md'],
    'P2': ['skills/hive-workflow/details/phase2-serena-context.md'],
    'P3': ['skills/hive-workflow/details/phase3-team-decomposition.md'],
    'G3': ['skills/hive-quality-gates/details/g3-plan-review.md'],
    'P4': [
        'skills/hive-consensus/details/consensus-loop.md',
        'skills/hive-consensus/details/provider-communication.md',
    ],
    'P5': [
        'skills/hive-workflow/details/phase5-execute.md',
        'skills/hive-tdd-pipeline/details/g4-tdd-red.md',
    ],
};
//# sourceMappingURL=phase-context-map.js.map