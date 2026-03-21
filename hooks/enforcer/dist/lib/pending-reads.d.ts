/**
 * Read current pending reads list.
 */
export declare function readPendingReads(stateDir: string): string[];
/**
 * Write pending reads (lock-backed).
 */
export declare function writePendingReads(stateDir: string, paths: string[]): void;
/**
 * Check if there are pending reads.
 */
export declare function hasPendingReads(stateDir: string): boolean;
/**
 * Clear a specific read path from pending reads (lock-backed).
 * Compares using realpath normalization to prevent symlink/path bypasses.
 */
export declare function clearReadPath(stateDir: string, readPath: string, repoRoot: string): void;
