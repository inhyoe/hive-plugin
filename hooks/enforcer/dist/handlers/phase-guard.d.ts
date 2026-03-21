import type { HandlerResult } from '../lib/types.js';
export declare function handlePhaseGuard(command: string, stateDir: string): HandlerResult;
/**
 * Called from PostToolUse(Bash) after create-marker.sh succeeds.
 * Re-reads session to discover new phase, then writes pending-reads
 * for the next phase's required detail files.
 */
export declare function recordPendingReadsAfterMarker(stateDir: string): void;
