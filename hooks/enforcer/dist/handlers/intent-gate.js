import { createSession, readSession } from '../lib/state.js';
const HIVE_RE = /^\s*\/hive\b/i;
export function handleIntentGate(prompt, stateDir) {
    if (!HIVE_RE.test(prompt)) {
        return { exitCode: 0 };
    }
    const existing = readSession(stateDir);
    if (existing && existing.mode === 'HIVE') {
        return {
            exitCode: 0,
            message: 'HIVE session already active. Ignoring duplicate /hive.',
        };
    }
    createSession(stateDir);
    return {
        exitCode: 0,
        message: 'HIVE mode activated. Phase: G1',
    };
}
//# sourceMappingURL=intent-gate.js.map