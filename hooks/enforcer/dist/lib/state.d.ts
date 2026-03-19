import { Phase } from './phases.js';
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
export declare function readSession(stateDir: string): HiveSession | null;
export declare function writeSession(stateDir: string, session: HiveSession): void;
export declare function createSession(stateDir: string): HiveSession;
export declare function advancePhase(stateDir: string): HiveSession;
export declare function addAgentSpawn(stateDir: string, spawn: AgentSpawn): HiveSession;
