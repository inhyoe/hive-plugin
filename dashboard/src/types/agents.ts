import type { AgentStatus, Provider } from './events';

export interface AgentNode {
  [key: string]: unknown;
  teamId: string;
  agentName: string;
  provider: Provider;
  modules: string[];
  status: AgentStatus;
  currentTask: string;
  changedFiles: string[];
  consensusRounds: number;
  success?: boolean;
}

export interface LeadNode {
  [key: string]: unknown;
  provider: 'claude';
  status: 'orchestrating' | 'idle';
  currentPhase: number;
}
