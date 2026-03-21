import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { getNextPhase } from './phases.js';
const SESSION_FILE = 'session.json';
const LOCK_DIR_NAME = 'session.lock';
const LOCK_INFO_FILE = 'info.json';
const LOCK_TIMEOUT_MS = 3000;
const LOCK_RETRY_MIN_MS = 50;
const LOCK_RETRY_MAX_MS = 100;
const STALE_LOCK_THRESHOLD_MS = 30000;
function sessionPath(stateDir) {
    return join(stateDir, SESSION_FILE);
}
function lockPath(stateDir) {
    return join(stateDir, LOCK_DIR_NAME);
}
function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
function tryReapStaleLock(lockDir) {
    const infoPath = join(lockDir, LOCK_INFO_FILE);
    try {
        const raw = readFileSync(infoPath, 'utf-8');
        const info = JSON.parse(raw);
        const age = Date.now() - new Date(info.startedAt).getTime();
        const sameHost = info.host === hostname();
        // PID check takes priority: dead process = definitely stale
        if (sameHost && !isProcessAlive(info.pid)) {
            try {
                rmSync(lockDir, { recursive: true, force: true });
                return true;
            }
            catch {
                return false;
            }
        }
        // Age check only if PID is alive (slow operation) or different host
        if (age > STALE_LOCK_THRESHOLD_MS) {
            try {
                rmSync(lockDir, { recursive: true, force: true });
                return true;
            }
            catch {
                return false;
            }
        }
    }
    catch {
        // info.json missing/unreadable/corrupt — treat as stale, force-clean
        try {
            rmSync(lockDir, { recursive: true, force: true });
            return true;
        }
        catch {
            return false;
        }
    }
    return false;
}
export function acquireLock(stateDir) {
    if (!existsSync(stateDir)) {
        mkdirSync(stateDir, { recursive: true });
    }
    const lockDir = lockPath(stateDir);
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    while (true) {
        try {
            mkdirSync(lockDir);
            // Write lock metadata
            const info = { pid: process.pid, startedAt: new Date().toISOString(), host: hostname() };
            writeFileSync(join(lockDir, LOCK_INFO_FILE), JSON.stringify(info), 'utf-8');
            return;
        }
        catch (err) {
            if (err.code !== 'EEXIST')
                throw err;
            // Try to reap stale lock
            if (tryReapStaleLock(lockDir))
                continue;
            if (Date.now() >= deadline) {
                throw new Error(`Failed to acquire session lock after ${LOCK_TIMEOUT_MS}ms`);
            }
            // Busy-wait with jitter
            const jitter = LOCK_RETRY_MIN_MS + Math.floor(Math.random() * (LOCK_RETRY_MAX_MS - LOCK_RETRY_MIN_MS));
            const waitUntil = Date.now() + jitter;
            while (Date.now() < waitUntil) { /* spin */ }
        }
    }
}
export function releaseLock(stateDir) {
    const lockDir = lockPath(stateDir);
    try {
        rmSync(lockDir, { recursive: true, force: true });
    }
    catch { /* ignore */ }
}
export function readSession(stateDir) {
    const filePath = sessionPath(stateDir);
    if (!existsSync(filePath))
        return { status: 'not_found' };
    try {
        const raw = readFileSync(filePath, 'utf-8');
        return { status: 'ok', session: JSON.parse(raw) };
    }
    catch (err) {
        console.error(`WARNING: Corrupted session at ${filePath}:`, err);
        return { status: 'parse_error', error: String(err) };
    }
}
export function writeSession(stateDir, session) {
    if (!existsSync(stateDir)) {
        mkdirSync(stateDir, { recursive: true });
    }
    const target = sessionPath(stateDir);
    const tmp = `${target}.${process.pid}.tmp`;
    try {
        writeFileSync(tmp, JSON.stringify(session, null, 2), 'utf-8');
        renameSync(tmp, target);
    }
    catch (err) {
        try {
            unlinkSync(tmp);
        }
        catch { /* ignore cleanup error */ }
        throw err;
    }
}
export function updateSession(stateDir, mutator) {
    acquireLock(stateDir);
    try {
        const result = readSession(stateDir);
        if (result.status !== 'ok')
            throw new Error(`No active session (${result.status})`);
        const session = result.session;
        mutator(session);
        writeSession(stateDir, session);
        return session;
    }
    finally {
        releaseLock(stateDir);
    }
}
export function createSession(stateDir) {
    acquireLock(stateDir);
    try {
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
    finally {
        releaseLock(stateDir);
    }
}
export function advancePhase(stateDir) {
    return updateSession(stateDir, (session) => {
        const next = getNextPhase(session.phase);
        if (!next)
            throw new Error(`Cannot advance past ${session.phase}`);
        session.completedGates.push(session.phase);
        session.phase = next;
    });
}
export function addAgentSpawn(stateDir, spawn) {
    return updateSession(stateDir, (session) => {
        session.agentSpawns.push(spawn);
    });
}
//# sourceMappingURL=state.js.map