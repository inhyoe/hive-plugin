export interface PollResult {
  status: 'done' | 'working' | 'timeout';
  response?: string;
  tokenRemaining?: string;
}

export interface RegistryEntry {
  paneId: string;
  provider: 'codex' | 'gemini';
  startedAt: string;
  requestId?: string;
  marker?: string;
}

export interface SpawnOptions {
  provider: 'codex' | 'gemini';
  name: string;
  session?: string;
  historyLimit?: number;
}

export interface SendOptions {
  name: string;
  prompt: string;
  marker: string;
  followup?: boolean;
}

export interface MarkerSearchResult {
  found: boolean;
  lineNumber: number;
}

export type Registry = Record<string, RegistryEntry>;

export const PROVIDER_COMMANDS: Record<string, string> = {
  codex: 'codex -a never -s danger-full-access',
  gemini: 'gemini',
};

export const PROMPT_FILE_THRESHOLD = 500;
export const DEFAULT_POLL_INTERVAL = 2000;
export const DEFAULT_POLL_TIMEOUT = 300;
export const REGISTRY_DIR = '/tmp/hive-tmux';
export const REGISTRY_FILE = '/tmp/hive-tmux/sessions.json';
