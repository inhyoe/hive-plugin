import type { HandlerResult } from '../lib/types.js';
/**
 * Priority 1: Marker format validation handler.
 *
 * Validates:
 * 1. TASK PROPOSAL structure (7 required sections)
 * 2. Consensus marker format (AGREE/COUNTER/CLARIFY with team ID)
 * 3. Phase 5 entry: all teams have consensus markers in .hive-state/consensus/
 *
 * Invoked as PostToolUse on Bash/Agent output containing consensus markers.
 */
export interface MarkerValidatorInput {
    output: string;
    toolName: string;
}
export declare function extractMarkerInputFromStdin(stdin: string): MarkerValidatorInput | null;
export declare function handleMarkerValidator(input: MarkerValidatorInput, stateDir: string): HandlerResult;
