import { createSession, readSession } from '../lib/state.js';
import type { HandlerResult } from '../lib/types.js';

const HIVE_RE = /^\s*\/hive\b/i;

export function handleIntentGate(prompt: string, stateDir: string): HandlerResult {
  if (!HIVE_RE.test(prompt)) {
    return { exitCode: 0 };
  }

  const result = readSession(stateDir);

  if (result.status === 'ok' && result.session.mode === 'HIVE') {
    return {
      exitCode: 0,
      message: 'HIVE session already active. Ignoring duplicate /hive.',
    };
  }

  if (result.status === 'parse_error') {
    console.error('WARNING: Corrupted session detected. Creating fresh session.');
  }

  createSession(stateDir);
  return {
    exitCode: 0,
    message: 'HIVE mode activated. Phase: G1',
  };
}
