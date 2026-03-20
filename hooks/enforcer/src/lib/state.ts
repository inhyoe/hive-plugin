import { readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
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

function sessionPath(stateDir: string): string {
  return join(stateDir, SESSION_FILE);
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

export function createSession(stateDir: string): HiveSession {
  const session: HiveSession = {
    mode: 'HIVE',
    phase: 'G1',
    completedGates: [],
    agentSpawns: [],
    startedAt: new Date().toISOString(),
  };
  writeSession(stateDir, session);
  return session;
}

export function advancePhase(stateDir: string): HiveSession {
  const result = readSession(stateDir);
  if (result.status !== 'ok') throw new Error(`No active session (${result.status})`);
  const session = result.session;

  const next = getNextPhase(session.phase);
  if (!next) throw new Error(`Cannot advance past ${session.phase}`);

  session.completedGates.push(session.phase);
  session.phase = next;
  writeSession(stateDir, session);
  return session;
}

export function addAgentSpawn(stateDir: string, spawn: AgentSpawn): HiveSession {
  const result = readSession(stateDir);
  if (result.status !== 'ok') throw new Error(`No active session (${result.status})`);
  const session = result.session;

  session.agentSpawns.push(spawn);
  writeSession(stateDir, session);
  return session;
}
