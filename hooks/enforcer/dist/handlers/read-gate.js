import { hasPendingReads, readPendingReads, clearReadPath } from '../lib/pending-reads.js';
import { readSession } from '../lib/state.js';
/**
 * Read-Gate PreToolUse handler.
 *
 * Blocks all non-Read tools while pending-reads.json has entries.
 * Forces the AI to Read required detail files before proceeding.
 */
export function handleReadGatePre(stateDir) {
    // Only active in HIVE mode
    const sessionResult = readSession(stateDir);
    if (sessionResult.status !== 'ok' || sessionResult.session.mode !== 'HIVE') {
        return { exitCode: 0 };
    }
    if (!hasPendingReads(stateDir)) {
        return { exitCode: 0 };
    }
    const pending = readPendingReads(stateDir);
    return {
        exitCode: 2,
        message: `BLOCKED: Read the following required detail file(s) before proceeding:\n${pending.map((p) => `  - Read("${p}")`).join('\n')}\nUse the Read tool to load each file. Other tools are blocked until all files are read.`,
    };
}
/**
 * Read-Gate PostToolUse handler for Read tool.
 *
 * After a successful Read, removes the file path from pending-reads.
 */
export function handleReadGatePost(stdin, stateDir, repoRoot) {
    // Only active in HIVE mode
    const sessionResult = readSession(stateDir);
    if (sessionResult.status !== 'ok' || sessionResult.session.mode !== 'HIVE') {
        return { exitCode: 0 };
    }
    if (!hasPendingReads(stateDir)) {
        return { exitCode: 0 };
    }
    // Extract file_path from Read tool input
    const filePath = extractReadPath(stdin);
    if (!filePath) {
        return { exitCode: 0 };
    }
    // Check if Read was successful (tool_result should not indicate error)
    if (isReadError(stdin)) {
        return { exitCode: 0 }; // Don't clear on failed reads
    }
    clearReadPath(stateDir, filePath, repoRoot);
    const remaining = readPendingReads(stateDir);
    if (remaining.length === 0) {
        return {
            exitCode: 0,
            message: 'Read-Gate: All required detail files loaded. You may proceed.',
        };
    }
    return {
        exitCode: 0,
        message: `Read-Gate: ${remaining.length} file(s) remaining:\n${remaining.map((p) => `  - Read("${p}")`).join('\n')}`,
    };
}
function extractReadPath(stdin) {
    try {
        const parsed = JSON.parse(stdin);
        const filePath = parsed?.tool_input?.file_path;
        return typeof filePath === 'string' ? filePath : null;
    }
    catch {
        return null;
    }
}
function isReadError(stdin) {
    try {
        const parsed = JSON.parse(stdin);
        const result = parsed?.tool_result;
        if (!result)
            return false;
        // Check for error indicators
        if (result.error)
            return true;
        if (typeof result.stdout === 'string' && result.stdout.includes('Error reading file'))
            return true;
        return false;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=read-gate.js.map