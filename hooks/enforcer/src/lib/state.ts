import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync, rmdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { Phase, getNextPhase } from './phases.js';

export interface AgentSpawn {
  type: string;
  phase: Phase;
  timestamp: string;
  teamId?: string;
  provider?: string;
}

export interface HiveSession {
  mode: 'HIVE' | 'IDLE' | 'DONE';
  phase: Phase;
  completedGates: Phase[];
  agentSpawns: AgentSpawn[];
  startedAt: string;
}

export type SessionReadResult =
  | { status: 'ok'; session: HiveSession }
  | { status: 'not_found' }
  | { status: 'parse_error'; error: string };

const SESSION_FILE = 'session.json';
const LOCK_DIR_NAME = 'session.lock';
const LOCK_INFO_FILE = 'info.json';
const LOCK_TIMEOUT_MS = 3000;
const LOCK_RETRY_MIN_MS = 50;
const LOCK_RETRY_MAX_MS = 100;
const STALE_LOCK_THRESHOLD_MS = 10000;

function sessionPath(stateDir: string): string {
  return join(stateDir, SESSION_FILE);
}

function lockPath(stateDir: string): string {
  return join(stateDir, LOCK_DIR_NAME);
}

interface LockInfo {
  pid: number;
  startedAt: string;
  host: string;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function tryReapStaleLock(lockDir: string): boolean {
  const infoPath = join(lockDir, LOCK_INFO_FILE);
  try {
    const raw = readFileSync(infoPath, 'utf-8');
    const info: LockInfo = JSON.parse(raw);
    const age = Date.now() - new Date(info.startedAt).getTime();
    const sameHost = info.host === hostname();

    if (sameHost && !isProcessAlive(info.pid)) {
      try { unlinkSync(infoPath); } catch { /* ignore */ }
      rmdirSync(lockDir);
      return true;
    }
    if (age > STALE_LOCK_THRESHOLD_MS) {
      try { unlinkSync(infoPath); } catch { /* ignore */ }
      rmdirSync(lockDir);
      return true;
    }
  } catch {
    // info.json missing or unreadable — treat as stale
    try { rmdirSync(lockDir); } catch { /* ignore */ }
    return true;
  }
  return false;
}

function acquireLock(stateDir: string): void {
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  const lockDir = lockPath(stateDir);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (true) {
    try {
      mkdirSync(lockDir);
      // Write lock metadata
      const info: LockInfo = { pid: process.pid, startedAt: new Date().toISOString(), host: hostname() };
      writeFileSync(join(lockDir, LOCK_INFO_FILE), JSON.stringify(info), 'utf-8');
      return;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;

      // Try to reap stale lock
      if (tryReapStaleLock(lockDir)) continue;

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

function releaseLock(stateDir: string): void {
  const lockDir = lockPath(stateDir);
  try { unlinkSync(join(lockDir, LOCK_INFO_FILE)); } catch { /* ignore */ }
  try { rmdirSync(lockDir); } catch { /* ignore */ }
}

export function readSession(stateDir: string): SessionReadResult {
  const filePath = sessionPath(stateDir);
  if (!existsSync(filePath)) return { status: 'not_found' };
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return { status: 'ok', session: JSON.parse(raw) as HiveSession };
  } catch (err) {
    console.error(`WARNING: Corrupted session at ${filePath}:`, err);
    return { status: 'parse_error', error: String(err) };
  }
}

export function writeSession(stateDir: string, session: HiveSession): void {
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  const target = sessionPath(stateDir);
  const tmp = `${target}.${process.pid}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(session, null, 2), 'utf-8');
    renameSync(tmp, target);
  } catch (err) {
    try { unlinkSync(tmp); } catch { /* ignore cleanup error */ }
    throw err;
  }
}

export function updateSession(stateDir: string, mutator: (session: HiveSession) => void): HiveSession {
  acquireLock(stateDir);
  try {
    const result = readSession(stateDir);
    if (result.status !== 'ok') throw new Error(`No active session (${result.status})`);
    const session = result.session;
    mutator(session);
    writeSession(stateDir, session);
    return session;
  } finally {
    releaseLock(stateDir);
  }
}

export function createSession(stateDir: string): HiveSession {
  acquireLock(stateDir);
  try {
    const session: HiveSession = {
      mode: 'HIVE',
      phase: 'G1',
      completedGates: [],
      agentSpawns: [],
      startedAt: new Date().toISOString(),
    };
    writeSession(stateDir, session);
    return session;
  } finally {
    releaseLock(stateDir);
  }
}

export function advancePhase(stateDir: string): HiveSession {
  return updateSession(stateDir, (session) => {
    const next = getNextPhase(session.phase);
    if (!next) throw new Error(`Cannot advance past ${session.phase}`);
    session.completedGates.push(session.phase);
    session.phase = next;
  });
}

export function addAgentSpawn(stateDir: string, spawn: AgentSpawn): HiveSession {
  return updateSession(stateDir, (session) => {
    session.agentSpawns.push(spawn);
  });
}
