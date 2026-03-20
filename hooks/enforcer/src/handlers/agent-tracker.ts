import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readSession, addAgentSpawn } from '../lib/state.js';
import type { AgentInfo, HandlerResult } from '../lib/types.js';
import { TEAM_ID_RE } from '../lib/types.js';

export type { AgentInfo as AgentInput };

function extractTeamId(text: string): string | undefined {
  const match = text.match(TEAM_ID_RE);
  return match ? match[1].toLowerCase() : undefined;
}

export function handleAgentTracker(input: AgentInfo, stateDir: string): HandlerResult {
  const result = readSession(stateDir);

  // No session or corrupted → pass through (advisory handler)
  if (result.status !== 'ok') {
    return { exitCode: 0 };
  }

  const session = result.session;
  if (session.mode !== 'HIVE') {
    return { exitCode: 0 };
  }

  try {
    const combined = `${input.prompt} ${input.description}`;
    const teamId = extractTeamId(combined);

    // Record spawn
    addAgentSpawn(stateDir, {
      type: input.subagentType,
      phase: session.phase,
      timestamp: new Date().toISOString(),
      teamId,
    });

    // Save conversation/implementation logs
    if (session.phase === 'P4') {
      const convDir = join(stateDir, 'conversations');
      mkdirSync(convDir, { recursive: true });
      const filename = `${Date.now()}-${process.pid}-${teamId ?? 'unknown'}.json`;
      writeFileSync(join(convDir, filename), JSON.stringify({
        phase: session.phase,
        teamId,
        agentType: input.subagentType,
        prompt: input.prompt,
        timestamp: new Date().toISOString(),
      }, null, 2), 'utf-8');
    }

    if (session.phase === 'P5') {
      const implDir = join(stateDir, 'implementations');
      mkdirSync(implDir, { recursive: true });
      const filename = `${Date.now()}-${process.pid}-${teamId ?? 'unknown'}.json`;
      writeFileSync(join(implDir, filename), JSON.stringify({
        phase: session.phase,
        teamId,
        agentType: input.subagentType,
        prompt: input.prompt,
        timestamp: new Date().toISOString(),
      }, null, 2), 'utf-8');
    }

    return { exitCode: 0 };
  } catch (err) {
    console.error('WARNING: agent-tracker failed (advisory, non-blocking):', err);
    return { exitCode: 0 };
  }
}
