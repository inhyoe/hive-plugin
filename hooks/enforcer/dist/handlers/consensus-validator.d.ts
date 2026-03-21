import type { HandlerResult } from '../lib/types.js';
/**
 * Priority 2: Consensus validator handler.
 *
 * Validates:
 * 1. Round number sequencing (R1→R2→...→R5, no gaps, max 5)
 * 2. SPEC hash chain (G2 hash vs G3 hash match)
 *
 * Invoked as PostToolUse on Bash output containing consensus markers.
 */
export interface ConsensusInput {
    output: string;
}
export declare function extractConsensusInputFromStdin(stdin: string): ConsensusInput | null;
export declare function handleConsensusValidator(input: ConsensusInput, stateDir: string): HandlerResult;
