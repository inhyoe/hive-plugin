import { readSession } from '../lib/state.js';
import type { Phase } from '../lib/phases.js';
import type { AgentInfo, HandlerResult } from '../lib/types.js';
import { TEAM_ID_RE } from '../lib/types.js';

export type { AgentInfo as AgentInput };

interface PhaseProfile {
  allowedTypes: string[];
  requiredKeywords?: string[];
  requireTeamId?: boolean;
  warnMessage?: string;
}

const RESEARCH_TYPES = ['Explore', 'Plan'];

const PHASE_PROFILES: Partial<Record<Phase, PhaseProfile>> = {
  P0: {
    allowedTypes: RESEARCH_TYPES,
    warnMessage: 'WARNING: P0 is research-only. Implementation agents are not recommended.',
  },
  P3: {
    allowedTypes: [],
    warnMessage: 'WARNING: P3 is Team Decomposition. Agent spawning should be minimal.',
  },
  P4: {
    allowedTypes: [],
    requiredKeywords: ['consensus'],
    requireTeamId: true,
    warnMessage: 'WARNING: P4 requires consensus agents with team ID.',
  },
};

export function handleAgentDispatcher(input: AgentInfo, stateDir: string): HandlerResult {
  const result = readSession(stateDir);

  // No session or corrupted → pass through (advisory handler)
  if (result.status !== 'ok') {
    return { exitCode: 0 };
  }

  const session = result.session;
  if (session.mode !== 'HIVE') {
    return { exitCode: 0 };
  }

  const profile = PHASE_PROFILES[session.phase];

  // No profile for this phase → allow (e.g., P5 has no restrictions)
  if (!profile) {
    return { exitCode: 0 };
  }

  const combined = `${input.prompt} ${input.description}`.toLowerCase();

  // Check allowed types
  if (profile.allowedTypes.length > 0) {
    if (profile.allowedTypes.includes(input.subagentType)) {
      return { exitCode: 0 };
    }
  }

  // Check required keywords (P4: consensus)
  if (profile.requiredKeywords) {
    const hasKeywords = profile.requiredKeywords.every(kw =>
      combined.includes(kw.toLowerCase())
    );

    if (!hasKeywords) {
      return {
        exitCode: 0,
        message: profile.warnMessage,
      };
    }

    // Check team ID requirement
    if (profile.requireTeamId && !TEAM_ID_RE.test(combined)) {
      return {
        exitCode: 0,
        message: 'WARNING: P4 consensus agent should include a team ID (e.g., team-alpha).',
      };
    }

    return { exitCode: 0 };
  }

  // Default: warn
  return {
    exitCode: 0,
    message: profile.warnMessage,
  };
}
