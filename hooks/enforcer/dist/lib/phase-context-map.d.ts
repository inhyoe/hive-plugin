import type { Phase } from './phases.js';
/**
 * Maps each phase to the detail files that MUST be Read before proceeding.
 * Paths are repo-relative (resolved against CLAUDE_PLUGIN_ROOT at runtime).
 */
export declare const PHASE_CONTEXT_MAP: Record<Phase, string[]>;
