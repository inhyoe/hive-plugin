import { beforeEach, describe, expect, it } from 'vitest';

import { useHiveStore } from '@/store/hive-store';
import type {
  AgentMessageEvent,
  AgentStatusEvent,
  ConsensusUpdateEvent,
  CrossFeedbackEvent,
  ExecutionResultEvent,
  GateUpdateEvent,
  HiveEventUnion,
  PhaseErrorEvent,
  PhaseTransitionEvent,
  SessionSummaryEvent,
  TeamCreatedEvent,
} from '@/types/events';

const baseEvent = {
  timestamp: '2026-03-15T00:00:00.000Z',
  sessionId: 'session-1',
};

function emit(event: HiveEventUnion) {
  useHiveStore.getState().handleEvent(event);
}

function createTeam(teamId = 'T1') {
  const event = {
    ...baseEvent,
    type: 'team.created',
    payload: {
      teamId,
      modules: ['dashboard'],
      provider: 'codex',
      agentName: `${teamId}-agent`,
    },
  } satisfies TeamCreatedEvent;

  emit(event);
  return event;
}

beforeEach(() => {
  useHiveStore.getState().reset();
});

describe('useHiveStore', () => {
  it('updates currentPhase and lead status on phase.transition enter', () => {
    const event = {
      ...baseEvent,
      type: 'phase.transition',
      payload: { phase: 3, status: 'enter' },
    } satisfies PhaseTransitionEvent;

    emit(event);

    const state = useHiveStore.getState();
    expect(state.currentPhase).toBe(3);
    expect(state.lead.status).toBe('orchestrating');
    expect(state.lead.currentPhase).toBe(3);
    expect(state.eventLog).toEqual([event]);
  });

  it('appends phase.transition exit to the log without changing phase state', () => {
    emit({
      ...baseEvent,
      type: 'phase.transition',
      payload: { phase: 2, status: 'enter' },
    } satisfies PhaseTransitionEvent);

    const exitEvent = {
      ...baseEvent,
      type: 'phase.transition',
      payload: { phase: 2, status: 'exit' },
    } satisfies PhaseTransitionEvent;

    emit(exitEvent);

    const state = useHiveStore.getState();
    expect(state.currentPhase).toBe(2);
    expect(state.lead.status).toBe('orchestrating');
    expect(state.eventLog.at(-1)).toEqual(exitEvent);
  });

  it('updates gate status on gate.update', () => {
    const event = {
      ...baseEvent,
      type: 'gate.update',
      payload: { gate: 'G4', status: 'passed' },
    } satisfies GateUpdateEvent;

    emit(event);

    expect(useHiveStore.getState().gates.G4).toBe('passed');
  });

  it('adds a worker on team.created', () => {
    createTeam('T2');

    expect(useHiveStore.getState().workers.T2).toEqual({
      teamId: 'T2',
      agentName: 'T2-agent',
      provider: 'codex',
      modules: ['dashboard'],
      status: 'idle',
      currentTask: '',
      changedFiles: [],
      consensusRounds: 0,
    });
  });

  it('updates worker status and task on agent.status', () => {
    createTeam();

    const event = {
      ...baseEvent,
      type: 'agent.status',
      payload: {
        teamId: 'T1',
        provider: 'codex',
        status: 'working',
        currentTask: 'Writing tests',
      },
    } satisfies AgentStatusEvent;

    emit(event);

    expect(useHiveStore.getState().workers.T1).toMatchObject({
      status: 'working',
      currentTask: 'Writing tests',
    });
  });

  it('logs agent.status for unknown teams without mutating workers', () => {
    const event = {
      ...baseEvent,
      type: 'agent.status',
      payload: {
        teamId: 'missing',
        provider: 'codex',
        status: 'working',
        currentTask: 'No-op',
      },
    } satisfies AgentStatusEvent;

    emit(event);

    const state = useHiveStore.getState();
    expect(state.workers).toEqual({});
    expect(state.eventLog).toEqual([event]);
  });

  it('updates consensus rounds on consensus.update', () => {
    createTeam();

    const event = {
      ...baseEvent,
      type: 'consensus.update',
      payload: { teamId: 'T1', round: 4, response: 'AGREE' },
    } satisfies ConsensusUpdateEvent;

    emit(event);

    expect(useHiveStore.getState().workers.T1?.consensusRounds).toBe(4);
  });

  it('marks execution success as done and stores changed files', () => {
    createTeam();

    const event = {
      ...baseEvent,
      type: 'execution.result',
      payload: {
        teamId: 'T1',
        changedFiles: ['src/store/hive-store.ts'],
        linesAdded: 10,
        linesRemoved: 2,
        success: true,
      },
    } satisfies ExecutionResultEvent;

    emit(event);

    expect(useHiveStore.getState().workers.T1).toMatchObject({
      status: 'done',
      success: true,
      changedFiles: ['src/store/hive-store.ts'],
    });
  });

  it('marks execution failure as error', () => {
    createTeam();

    emit({
      ...baseEvent,
      type: 'execution.result',
      payload: {
        teamId: 'T1',
        changedFiles: ['src/store/hive-store.ts'],
        linesAdded: 1,
        linesRemoved: 5,
        success: false,
      },
    } satisfies ExecutionResultEvent);

    expect(useHiveStore.getState().workers.T1).toMatchObject({
      status: 'error',
      success: false,
    });
  });

  it('marks a worker as error on phase.error with teamId', () => {
    createTeam();

    emit({
      ...baseEvent,
      type: 'phase.error',
      payload: {
        phase: 4,
        teamId: 'T1',
        errorType: 'timeout',
        message: 'Worker stalled',
      },
    } satisfies PhaseErrorEvent);

    expect(useHiveStore.getState().workers.T1?.status).toBe('error');
  });

  it('logs phase.error without teamId without mutating workers', () => {
    createTeam();
    const before = useHiveStore.getState().workers.T1;

    const event = {
      ...baseEvent,
      type: 'phase.error',
      payload: {
        phase: 2,
        errorType: 'validation',
        message: 'Missing gate',
      },
    } satisfies PhaseErrorEvent;

    emit(event);

    const state = useHiveStore.getState();
    expect(state.workers.T1).toEqual(before);
    expect(state.eventLog.at(-1)).toEqual(event);
  });

  it('sets lead idle and sessionId on session.summary', () => {
    emit({
      ...baseEvent,
      type: 'phase.transition',
      payload: { phase: 5, status: 'enter' },
    } satisfies PhaseTransitionEvent);

    const event = {
      ...baseEvent,
      type: 'session.summary',
      payload: {
        totalTeams: 2,
        passed: 2,
        failed: 0,
        totalFiles: 6,
        totalChanges: 42,
      },
    } satisfies SessionSummaryEvent;

    emit(event);

    const state = useHiveStore.getState();
    expect(state.lead.status).toBe('idle');
    expect(state.sessionId).toBe('session-1');
    expect(state.eventLog.at(-1)).toEqual(event);
  });

  it('appends unhandled events to the log without mutating state', () => {
    createTeam();
    const before = useHiveStore.getState();

    const agentMessage = {
      ...baseEvent,
      type: 'agent.message',
      payload: {
        from: 'lead',
        to: 'T1',
        direction: 'lead→worker',
        summary: 'Please update tests',
      },
    } satisfies AgentMessageEvent;

    const crossFeedback = {
      ...baseEvent,
      type: 'cross_feedback',
      payload: {
        fromTeam: 'T2',
        toTeam: 'T1',
        waveId: 1,
        severity: 'major',
        summary: 'Schema mismatch',
      },
    } satisfies CrossFeedbackEvent;

    emit(agentMessage);
    emit(crossFeedback);

    const state = useHiveStore.getState();
    expect(state.currentPhase).toBe(before.currentPhase);
    expect(state.gates).toEqual(before.gates);
    expect(state.workers).toEqual(before.workers);
    expect(state.eventLog.slice(-2)).toEqual([agentMessage, crossFeedback]);
  });

  it('keeps only the latest 200 events in eventLog', () => {
    for (let index = 0; index < 201; index += 1) {
      emit({
        timestamp: `2026-03-15T00:00:${String(index).padStart(2, '0')}.000Z`,
        sessionId: 'session-1',
        type: 'agent.message',
        payload: {
          from: 'lead',
          to: `T${index}`,
          direction: 'lead→worker',
          summary: `event-${index}`,
        },
      } satisfies AgentMessageEvent);
    }

    const { eventLog } = useHiveStore.getState();
    expect(eventLog).toHaveLength(200);
    expect((eventLog[0] as AgentMessageEvent).payload.summary).toBe('event-1');
    expect((eventLog.at(-1) as AgentMessageEvent | undefined)?.payload.summary).toBe('event-200');
  });

  it('resets the store to its initial state', () => {
    createTeam();
    useHiveStore.getState().setConnected(true);
    emit({
      ...baseEvent,
      type: 'gate.update',
      payload: { gate: 'G1', status: 'passed' },
    } satisfies GateUpdateEvent);

    useHiveStore.getState().reset();

    expect(useHiveStore.getState()).toMatchObject({
      connected: false,
      sessionId: null,
      currentPhase: 0,
      gates: {
        G1: 'pending',
        G2: 'pending',
        G3: 'pending',
        G4: 'pending',
        G5: 'pending',
        G6: 'pending',
        G7: 'pending',
      },
      lead: { provider: 'claude', status: 'idle', currentPhase: 0 },
      workers: {},
      eventLog: [],
    });
  });

  it('updates connected state via setConnected', () => {
    useHiveStore.getState().setConnected(true);
    expect(useHiveStore.getState().connected).toBe(true);

    useHiveStore.getState().setConnected(false);
    expect(useHiveStore.getState().connected).toBe(false);
  });
});
