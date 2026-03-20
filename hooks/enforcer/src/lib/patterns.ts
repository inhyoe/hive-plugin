import type { AgentInfo } from './types.js';

// Whitelist: only create-marker.sh standalone calls are allowed to touch .marker files
const MARKER_FILE_RE = /\.marker\b/i;
const CREATE_MARKER_RE = /(?:bash\s+)?(?:\.\/)?scripts\/create-marker\.sh/;

export function isDirectMarkerCreation(command: string): boolean {
  // If command doesn't reference .marker files at all, it's fine
  if (!MARKER_FILE_RE.test(command)) return false;
  // Only exempt pure create-marker.sh calls (no shell metacharacters)
  if (CREATE_MARKER_RE.test(command) && !/[;&|`$(){}\n<>]/.test(command)) return false;
  // Everything else that touches .marker is blocked
  return true;
}

export function isCreateMarkerCall(command: string): boolean {
  return CREATE_MARKER_RE.test(command);
}

export function extractCreateMarkerGate(command: string): string | null {
  const match = command.match(/create-marker\.sh\s+(\S+)/);
  return match ? match[1] : null;
}

export function isGitCommit(command: string): boolean {
  return /\bgit\s+commit\b/.test(command);
}

export function extractCommandFromStdin(stdin: string): string | null {
  try {
    const parsed = JSON.parse(stdin);
    const cmd = parsed?.tool_input?.command;
    if (typeof cmd !== 'string') return null;
    return cmd;
  } catch {
    return null;
  }
}

export function extractPromptFromStdin(stdin: string): string | null {
  try {
    const parsed = JSON.parse(stdin);
    const prompt = parsed?.prompt;
    if (typeof prompt !== 'string') return null;
    return prompt;
  } catch {
    return null;
  }
}

export function extractAgentInfoFromStdin(stdin: string): AgentInfo | null {
  try {
    const parsed = JSON.parse(stdin);
    const input = parsed?.tool_input;
    if (typeof input?.prompt !== 'string' || typeof input?.subagent_type !== 'string') return null;
    const description = typeof input.description === 'string' ? input.description : '';
    return {
      prompt: input.prompt,
      subagentType: input.subagent_type,
      description,
    };
  } catch {
    return null;
  }
}
