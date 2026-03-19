import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
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
  mode: 'HIVE' | 'IDLE';
  phase: Phase;
  completedGates: Phase[];
  agentSpawns: AgentSpawn[];
  startedAt: string;
}

const SESSION_FILE = 'session.json';

function sessionPath(stateDir: string): string {
  return join(stateDir, SESSION_FILE);
}

export function readSession(stateDir: string): HiveSession | null {
  const filePath = sessionPath(stateDir);
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as HiveSession;
}

export function writeSession(stateDir: string, session: HiveSession): void {
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  writeFileSync(sessionPath(stateDir), JSON.stringify(session, null, 2), 'utf-8');
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
  const session = readSession(stateDir);
  if (!session) throw new Error('No active session');

  const next = getNextPhase(session.phase);
  if (!next) throw new Error(`Cannot advance past ${session.phase}`);

  session.completedGates.push(session.phase);
  session.phase = next;
  writeSession(stateDir, session);
  return session;
}

export function addAgentSpawn(stateDir: string, spawn: AgentSpawn): HiveSession {
  const session = readSession(stateDir);
  if (!session) throw new Error('No active session');

  session.agentSpawns.push(spawn);
  writeSession(stateDir, session);
  return session;
}
