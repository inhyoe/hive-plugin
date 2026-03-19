import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getNextPhase } from './phases.js';
const SESSION_FILE = 'session.json';
function sessionPath(stateDir) {
    return join(stateDir, SESSION_FILE);
}
export function readSession(stateDir) {
    const filePath = sessionPath(stateDir);
    if (!existsSync(filePath))
        return null;
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
}
export function writeSession(stateDir, session) {
    if (!existsSync(stateDir)) {
        mkdirSync(stateDir, { recursive: true });
    }
    writeFileSync(sessionPath(stateDir), JSON.stringify(session, null, 2), 'utf-8');
}
export function createSession(stateDir) {
    const session = {
        mode: 'HIVE',
        phase: 'G1',
        completedGates: [],
        agentSpawns: [],
        startedAt: new Date().toISOString(),
    };
    writeSession(stateDir, session);
    return session;
}
export function advancePhase(stateDir) {
    const session = readSession(stateDir);
    if (!session)
        throw new Error('No active session');
    const next = getNextPhase(session.phase);
    if (!next)
        throw new Error(`Cannot advance past ${session.phase}`);
    session.completedGates.push(session.phase);
    session.phase = next;
    writeSession(stateDir, session);
    return session;
}
export function addAgentSpawn(stateDir, spawn) {
    const session = readSession(stateDir);
    if (!session)
        throw new Error('No active session');
    session.agentSpawns.push(spawn);
    writeSession(stateDir, session);
    return session;
}
//# sourceMappingURL=state.js.map