import { create } from 'zustand';
import type { PhaseNumber, GateId, GateStatus, HiveEventUnion } from '@/types/events';
import type { AgentNode, LeadNode } from '@/types/agents';

interface HiveState {
  connected: boolean;
  sessionId: string | null;
  currentPhase: PhaseNumber;
  gates: Record<GateId, GateStatus>;
  lead: LeadNode;
  workers: Record<string, AgentNode>;
  eventLog: HiveEventUnion[];

  setConnected: (connected: boolean) => void;
  handleEvent: (event: HiveEventUnion) => void;
  reset: () => void;
}

const initialGates: Record<GateId, GateStatus> = {
  G1: 'pending', G2: 'pending', G3: 'pending', G4: 'pending',
  G5: 'pending', G6: 'pending', G7: 'pending',
};

const initialLead: LeadNode = { provider: 'claude', status: 'idle', currentPhase: 0 };

export const useHiveStore = create<HiveState>((set) => ({
  connected: false,
  sessionId: null,
  currentPhase: 0,
  gates: { ...initialGates },
  lead: { ...initialLead },
  workers: {},
  eventLog: [],

  setConnected: (connected) => set({ connected }),

  handleEvent: (event) =>
    set((state) => {
      // Session filtering: ignore events from different sessions
      if (state.sessionId && event.sessionId && event.sessionId !== state.sessionId) {
        // Exception: allow only if this is a brand new session starting (phase 0 enter)
        const p = event.payload as { phase?: number; status?: string };
        if (!(event.type === 'phase.transition' && p.status === 'enter' && p.phase === 0)) {
          return state; // silently ignore foreign session events
        }
      }

      const eventLog = [...state.eventLog.slice(-199), event];

      switch (event.type) {
        case 'phase.transition': {
          const { phase, status } = event.payload;
          if (status === 'enter') {
            // Auto-reset on new session start (different sessionId + early phase)
            const isNewSession = event.sessionId && event.sessionId !== state.sessionId;
            if (isNewSession) {
              return {
                connected: state.connected,
                sessionId: event.sessionId,
                currentPhase: phase,
                gates: { ...initialGates },
                lead: { provider: 'claude', status: 'orchestrating', currentPhase: phase },
                workers: {},
                eventLog: [event],
              };
            }
            return {
              eventLog,
              currentPhase: phase,
              lead: { ...state.lead, status: 'orchestrating', currentPhase: phase },
            };
          }
          return { eventLog };
        }
        case 'gate.update': {
          const { gate, status } = event.payload;
          return { eventLog, gates: { ...state.gates, [gate]: status } };
        }
        case 'team.created': {
          const { teamId, modules, provider, agentName } = event.payload;
          return {
            eventLog,
            sessionId: state.sessionId || event.sessionId,
            workers: {
              ...state.workers,
              [teamId]: {
                teamId, agentName, provider, modules,
                status: 'idle', currentTask: '', changedFiles: [], consensusRounds: 0,
              },
            },
          };
        }
        case 'agent.status': {
          const { teamId, status, currentTask } = event.payload;
          const worker = state.workers[teamId];
          if (!worker) return { eventLog };
          return {
            eventLog,
            workers: { ...state.workers, [teamId]: { ...worker, status, currentTask } },
          };
        }
        case 'consensus.update': {
          const { teamId, round } = event.payload;
          const worker = state.workers[teamId];
          if (!worker) return { eventLog };
          return {
            eventLog,
            workers: { ...state.workers, [teamId]: { ...worker, consensusRounds: round } },
          };
        }
        case 'execution.result': {
          const { teamId, changedFiles, success } = event.payload;
          const worker = state.workers[teamId];
          if (!worker) return { eventLog };
          return {
            eventLog,
            workers: {
              ...state.workers,
              [teamId]: { ...worker, changedFiles, success, status: success ? 'done' : 'error' },
            },
          };
        }
        case 'phase.error': {
          const { teamId } = event.payload;
          if (teamId) {
            const worker = state.workers[teamId];
            if (worker) {
              return {
                eventLog,
                workers: { ...state.workers, [teamId]: { ...worker, status: 'error' } },
              };
            }
          }
          return { eventLog };
        }
        case 'session.summary':
          return {
            eventLog,
            sessionId: event.sessionId,
            lead: { ...state.lead, status: 'idle' },
          };
        default:
          return { eventLog };
      }
    }),

  reset: () =>
    set({
      connected: false, sessionId: null, currentPhase: 0,
      gates: { ...initialGates }, lead: { ...initialLead },
      workers: {}, eventLog: [],
    }),
}));
