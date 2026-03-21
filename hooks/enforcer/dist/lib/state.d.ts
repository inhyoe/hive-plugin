import { Phase } from './phases.js';
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
export type SessionReadResult = {
    status: 'ok';
    session: HiveSession;
} | {
    status: 'not_found';
} | {
    status: 'parse_error';
    error: string;
};
export declare function acquireLock(stateDir: string): void;
export declare function releaseLock(stateDir: string): void;
export declare function readSession(stateDir: string): SessionReadResult;
export declare function writeSession(stateDir: string, session: HiveSession): void;
export declare function updateSession(stateDir: string, mutator: (session: HiveSession) => void): HiveSession;
export declare function createSession(stateDir: string): HiveSession;
export declare function advancePhase(stateDir: string): HiveSession;
export declare function addAgentSpawn(stateDir: string, spawn: AgentSpawn): HiveSession;
