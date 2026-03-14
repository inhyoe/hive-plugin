export type PhaseNumber = 0 | 1 | 2 | 3 | 4 | 5;
export type GateId = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7';
export type GateStatus = 'pending' | 'active' | 'passed' | 'failed';
export type AgentStatus = 'idle' | 'working' | 'done' | 'error';
export type Provider = 'claude' | 'codex' | 'gemini';
export type ConsensusResponse = 'AGREE' | 'COUNTER' | 'CLARIFY';
export type CrossFeedbackSeverity = 'minor' | 'major' | 'design';

export interface HiveEvent {
  type: string;
  timestamp: string;
  sessionId: string;
  payload: Record<string, unknown>;
}

export interface PhaseTransitionEvent extends HiveEvent {
  type: 'phase.transition';
  payload: { phase: PhaseNumber; status: 'enter' | 'exit' };
}

export interface GateUpdateEvent extends HiveEvent {
  type: 'gate.update';
  payload: { gate: GateId; status: GateStatus; marker?: string };
}

export interface TeamCreatedEvent extends HiveEvent {
  type: 'team.created';
  payload: { teamId: string; modules: string[]; provider: Provider; agentName: string };
}

export interface AgentStatusEvent extends HiveEvent {
  type: 'agent.status';
  payload: { teamId: string; provider: Provider; status: AgentStatus; currentTask: string };
}

export interface AgentMessageEvent extends HiveEvent {
  type: 'agent.message';
  payload: { from: string; to: string; direction: 'lead→worker' | 'worker→lead'; summary: string };
}

export interface ConsensusUpdateEvent extends HiveEvent {
  type: 'consensus.update';
  payload: { teamId: string; round: number; response: ConsensusResponse };
}

export interface WaveTransitionEvent extends HiveEvent {
  type: 'wave.transition';
  payload: { waveId: number; teams: string[]; status: 'start' | 'complete' };
}

export interface ExecutionResultEvent extends HiveEvent {
  type: 'execution.result';
  payload: { teamId: string; changedFiles: string[]; linesAdded: number; linesRemoved: number; success: boolean };
}

export interface SessionSummaryEvent extends HiveEvent {
  type: 'session.summary';
  payload: { totalTeams: number; passed: number; failed: number; totalFiles: number; totalChanges: number };
}

export interface CrossFeedbackEvent extends HiveEvent {
  type: 'cross_feedback';
  payload: { fromTeam: string; toTeam: string; waveId: number; severity: CrossFeedbackSeverity; summary: string };
}

export interface LeadDecisionEvent extends HiveEvent {
  type: 'lead.decision';
  payload: { teamId: string; reason: string; round: number };
}

export interface PhaseErrorEvent extends HiveEvent {
  type: 'phase.error';
  payload: { phase: PhaseNumber; teamId?: string; errorType: string; message: string };
}

export interface ExecutionRetryEvent extends HiveEvent {
  type: 'execution.retry';
  payload: { teamId: string; attempt: number; maxAttempts: number; reentryPoint: string };
}

export interface AgentSpawnEvent extends HiveEvent {
  type: 'agent.spawn';
  payload: { teamId: string; provider: Provider; spawnMethod: 'Agent' | 'ask' };
}

export type HiveEventUnion =
  | PhaseTransitionEvent
  | GateUpdateEvent
  | TeamCreatedEvent
  | AgentStatusEvent
  | AgentMessageEvent
  | ConsensusUpdateEvent
  | WaveTransitionEvent
  | ExecutionResultEvent
  | SessionSummaryEvent
  | CrossFeedbackEvent
  | LeadDecisionEvent
  | PhaseErrorEvent
  | ExecutionRetryEvent
  | AgentSpawnEvent;
