import { appendFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const STATE_DIR = resolve(process.env.HIVE_STATE_DIR || '../../.hive-state');
const EVENTS_FILE = resolve(STATE_DIR, 'events.jsonl');

mkdirSync(STATE_DIR, { recursive: true });
writeFileSync(EVENTS_FILE, '');

function emit(event: Record<string, unknown>) {
  const line = JSON.stringify({ ...event, timestamp: new Date().toISOString(), sessionId: 'demo-001' });
  appendFileSync(EVENTS_FILE, line + '\n');
  console.log(`Emitted: ${(event as { type: string }).type}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log('Starting demo event sequence...\n');

  // G1-G2 gates
  emit({ type: 'phase.transition', payload: { phase: 0, status: 'enter' } });
  emit({ type: 'gate.update', payload: { gate: 'G1', status: 'active' } });
  await sleep(1000);
  emit({ type: 'gate.update', payload: { gate: 'G1', status: 'passed' } });
  emit({ type: 'gate.update', payload: { gate: 'G2', status: 'active' } });
  await sleep(1000);
  emit({ type: 'gate.update', payload: { gate: 'G2', status: 'passed' } });
  emit({ type: 'phase.transition', payload: { phase: 0, status: 'exit' } });

  // Phase 3 — Team creation
  emit({ type: 'phase.transition', payload: { phase: 3, status: 'enter' } });
  await sleep(500);
  emit({ type: 'team.created', payload: { teamId: 'T1-auth', modules: ['auth', 'session'], provider: 'claude', agentName: 'agent-auth' } });
  emit({ type: 'team.created', payload: { teamId: 'T2-api', modules: ['api', 'routes'], provider: 'codex', agentName: 'agent-api' } });
  emit({ type: 'team.created', payload: { teamId: 'T3-test', modules: ['tests', 'e2e'], provider: 'gemini', agentName: 'agent-test' } });
  emit({ type: 'agent.spawn', payload: { teamId: 'T1-auth', provider: 'claude', spawnMethod: 'Agent' } });
  emit({ type: 'agent.spawn', payload: { teamId: 'T2-api', provider: 'codex', spawnMethod: 'ask' } });
  emit({ type: 'agent.spawn', payload: { teamId: 'T3-test', provider: 'gemini', spawnMethod: 'ask' } });
  await sleep(1000);

  // Phase 4 — Consensus
  emit({ type: 'phase.transition', payload: { phase: 4, status: 'enter' } });
  emit({ type: 'gate.update', payload: { gate: 'G3', status: 'active' } });
  emit({ type: 'consensus.update', payload: { teamId: 'T1-auth', round: 1, response: 'AGREE' } });
  emit({ type: 'consensus.update', payload: { teamId: 'T2-api', round: 1, response: 'COUNTER' } });
  await sleep(1500);
  emit({ type: 'consensus.update', payload: { teamId: 'T2-api', round: 2, response: 'AGREE' } });
  emit({ type: 'consensus.update', payload: { teamId: 'T3-test', round: 1, response: 'AGREE' } });
  emit({ type: 'gate.update', payload: { gate: 'G3', status: 'passed' } });

  // Phase 5 — Execution
  emit({ type: 'phase.transition', payload: { phase: 5, status: 'enter' } });
  emit({ type: 'gate.update', payload: { gate: 'G4', status: 'active' } });
  emit({ type: 'wave.transition', payload: { waveId: 1, teams: ['T1-auth', 'T3-test'], status: 'start' } });

  emit({ type: 'agent.status', payload: { teamId: 'T1-auth', provider: 'claude', status: 'working', currentTask: 'Implementing auth module with JWT tokens' } });
  emit({ type: 'agent.status', payload: { teamId: 'T3-test', provider: 'gemini', status: 'working', currentTask: 'Writing test checklist for auth and API modules' } });
  await sleep(2000);

  // Messages between lead and worker
  emit({ type: 'agent.message', payload: { from: 'T1-auth', to: 'lead', direction: 'worker→lead', summary: 'Auth module 70% complete, need clarification on token refresh strategy' } });
  emit({ type: 'agent.message', payload: { from: 'lead', to: 'T1-auth', direction: 'lead→worker', summary: 'Use sliding window refresh, 15min access + 7d refresh token' } });
  await sleep(1500);

  emit({ type: 'gate.update', payload: { gate: 'G4', status: 'passed' } });
  emit({ type: 'gate.update', payload: { gate: 'G5', status: 'active' } });

  // T1 completes
  emit({ type: 'agent.status', payload: { teamId: 'T1-auth', provider: 'claude', status: 'done', currentTask: '' } });
  emit({ type: 'execution.result', payload: { teamId: 'T1-auth', changedFiles: ['src/auth.ts', 'src/session.ts', 'src/middleware.ts'], linesAdded: 245, linesRemoved: 12, success: true } });

  // Wave 2
  emit({ type: 'wave.transition', payload: { waveId: 1, teams: ['T1-auth', 'T3-test'], status: 'complete' } });
  emit({ type: 'wave.transition', payload: { waveId: 2, teams: ['T2-api'], status: 'start' } });
  emit({ type: 'agent.status', payload: { teamId: 'T2-api', provider: 'codex', status: 'working', currentTask: 'Implementing REST API endpoints for user management' } });
  await sleep(2000);

  // Cross feedback
  emit({ type: 'cross_feedback', payload: { fromTeam: 'T2-api', toTeam: 'T1-auth', waveId: 2, severity: 'minor', summary: 'Auth middleware missing rate limit header' } });
  await sleep(1000);

  // All complete
  emit({ type: 'agent.status', payload: { teamId: 'T2-api', provider: 'codex', status: 'done', currentTask: '' } });
  emit({ type: 'execution.result', payload: { teamId: 'T2-api', changedFiles: ['src/routes/users.ts', 'src/routes/auth.ts'], linesAdded: 180, linesRemoved: 5, success: true } });
  emit({ type: 'agent.status', payload: { teamId: 'T3-test', provider: 'gemini', status: 'done', currentTask: '' } });
  emit({ type: 'execution.result', payload: { teamId: 'T3-test', changedFiles: ['tests/auth.test.ts', 'tests/api.test.ts'], linesAdded: 320, linesRemoved: 0, success: true } });

  emit({ type: 'gate.update', payload: { gate: 'G5', status: 'passed' } });
  emit({ type: 'gate.update', payload: { gate: 'G6', status: 'passed' } });
  emit({ type: 'gate.update', payload: { gate: 'G7', status: 'passed' } });

  emit({ type: 'session.summary', payload: { totalTeams: 3, passed: 3, failed: 0, totalFiles: 8, totalChanges: 762 } });

  console.log('\nDemo complete!');
}

run();
