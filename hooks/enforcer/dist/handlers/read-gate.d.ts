import type { HandlerResult } from '../lib/types.js';
/**
 * Read-Gate PreToolUse handler.
 *
 * Blocks all non-Read tools while pending-reads.json has entries.
 * Forces the AI to Read required detail files before proceeding.
 */
export declare function handleReadGatePre(stateDir: string): HandlerResult;
/**
 * Read-Gate PostToolUse handler for Read tool.
 *
 * After a successful Read, removes the file path from pending-reads.
 */
export declare function handleReadGatePost(stdin: string, stateDir: string, repoRoot: string): HandlerResult;
