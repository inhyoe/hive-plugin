export interface HandlerResult {
  exitCode: number;
  message?: string;
}

export interface AgentInfo {
  prompt: string;
  subagentType: string;
  description: string;
}

export const TEAM_ID_RE = /\b(team[_-]\w+)\b/i;
