# Hive Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a real-time web dashboard that visualizes Hive multi-agent orchestration — pipeline progress, team topology graph, and execution results.

**Architecture:** Next.js frontend with React Flow for node graph visualization, connected to a Node.js WebSocket event server that watches `.hive-state/events.jsonl`. Three-column layout: pipeline (left), topology graph (center), agent detail (right), with event log at bottom.

**Tech Stack:** Next.js 15, React Flow 12, Zustand 5, Tailwind CSS 4, ws 8, chokidar 4, TypeScript

---

### Task 1: Project Scaffold

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/next.config.ts`
- Create: `dashboard/tailwind.config.ts`
- Create: `dashboard/postcss.config.mjs`
- Create: `dashboard/src/app/layout.tsx`
- Create: `dashboard/src/app/page.tsx`
- Create: `dashboard/src/app/globals.css`

**Step 1: Initialize Next.js project**

```bash
cd /home/ryu-ubuntu/Document/GITHUB/hive-plugin
mkdir -p dashboard
cd dashboard
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```

**Step 2: Install dependencies**

```bash
cd /home/ryu-ubuntu/Document/GITHUB/hive-plugin/dashboard
npm install @xyflow/react zustand
npm install -D @types/node
```

**Step 3: Verify dev server starts**

Run: `cd /home/ryu-ubuntu/Document/GITHUB/hive-plugin/dashboard && npm run dev -- --port 3000`
Expected: Next.js dev server running on http://localhost:3000

**Step 4: Commit**

```bash
git add dashboard/
git commit -m "feat(dashboard): scaffold Next.js project with React Flow and Zustand"
```

---

### Task 2: Event Type Definitions

**Files:**
- Create: `dashboard/src/types/events.ts`
- Create: `dashboard/src/types/agents.ts`

**Step 1: Define event types**

```typescript
// dashboard/src/types/events.ts
export type PhaseNumber = 0 | 1 | 2 | 3 | 4 | 5;
export type GateId = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7';
export type GateStatus = 'pending' | 'active' | 'passed' | 'failed';
export type AgentStatus = 'idle' | 'working' | 'done' | 'error';
export type Provider = 'claude' | 'codex' | 'gemini';
export type ConsensusResponse = 'AGREE' | 'COUNTER' | 'CLARIFY';

export interface HiveEvent {
  type: string;
  timestamp: string;
  sessionId: string;
  payload: Record<string, unknown>;
}

export interface PhaseTransitionEvent extends HiveEvent {
  type: 'phase.transition';
  payload: { phase: PhaseNumber; status: 'enter' | 'exit' };
}

export interface GateUpdateEvent extends HiveEvent {
  type: 'gate.update';
  payload: { gate: GateId; status: GateStatus; marker?: string };
}

export interface TeamCreatedEvent extends HiveEvent {
  type: 'team.created';
  payload: { teamId: string; modules: string[]; provider: Provider; agentName: string };
}

export interface AgentStatusEvent extends HiveEvent {
  type: 'agent.status';
  payload: { teamId: string; provider: Provider; status: AgentStatus; currentTask: string };
}

export interface AgentMessageEvent extends HiveEvent {
  type: 'agent.message';
  payload: { from: string; to: string; direction: 'lead→worker' | 'worker→lead'; summary: string };
}

export interface ConsensusUpdateEvent extends HiveEvent {
  type: 'consensus.update';
  payload: { teamId: string; round: number; response: ConsensusResponse };
}

export interface WaveTransitionEvent extends HiveEvent {
  type: 'wave.transition';
  payload: { waveId: number; teams: string[]; status: 'start' | 'complete' };
}

export interface ExecutionResultEvent extends HiveEvent {
  type: 'execution.result';
  payload: { teamId: string; changedFiles: string[]; linesAdded: number; linesRemoved: number; success: boolean };
}

export interface SessionSummaryEvent extends HiveEvent {
  type: 'session.summary';
  payload: { totalTeams: number; passed: number; failed: number; totalFiles: number; totalChanges: number };
}

export type HiveEventUnion =
  | PhaseTransitionEvent
  | GateUpdateEvent
  | TeamCreatedEvent
  | AgentStatusEvent
  | AgentMessageEvent
  | ConsensusUpdateEvent
  | WaveTransitionEvent
  | ExecutionResultEvent
  | SessionSummaryEvent;
```

**Step 2: Define agent types**

```typescript
// dashboard/src/types/agents.ts
import type { AgentStatus, Provider } from './events';

export interface AgentNode {
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
  provider: 'claude';
  status: 'orchestrating' | 'idle';
  currentPhase: number;
}
```

**Step 3: Commit**

```bash
git add dashboard/src/types/
git commit -m "feat(dashboard): add TypeScript event and agent type definitions"
```

---

### Task 3: Zustand Store

**Files:**
- Create: `dashboard/src/store/hive-store.ts`

**Step 1: Create the store**

```typescript
// dashboard/src/store/hive-store.ts
import { create } from 'zustand';
import type { PhaseNumber, GateId, GateStatus, HiveEventUnion } from '@/types/events';
import type { AgentNode, LeadNode } from '@/types/agents';

interface HiveState {
  // Connection
  connected: boolean;
  sessionId: string | null;

  // Pipeline
  currentPhase: PhaseNumber;
  gates: Record<GateId, GateStatus>;

  // Agents
  lead: LeadNode;
  workers: Record<string, AgentNode>; // keyed by teamId

  // Events
  eventLog: HiveEventUnion[];

  // Actions
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
      const eventLog = [...state.eventLog.slice(-199), event]; // keep last 200

      switch (event.type) {
        case 'phase.transition': {
          const { phase, status } = event.payload;
          if (status === 'enter') {
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
          return {
            eventLog,
            gates: { ...state.gates, [gate]: status },
          };
        }
        case 'team.created': {
          const { teamId, modules, provider, agentName } = event.payload;
          return {
            eventLog,
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
            workers: {
              ...state.workers,
              [teamId]: { ...worker, status, currentTask },
            },
          };
        }
        case 'consensus.update': {
          const { teamId, round } = event.payload;
          const worker = state.workers[teamId];
          if (!worker) return { eventLog };
          return {
            eventLog,
            workers: {
              ...state.workers,
              [teamId]: { ...worker, consensusRounds: round },
            },
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
```

**Step 2: Commit**

```bash
git add dashboard/src/store/
git commit -m "feat(dashboard): add Zustand store with event handlers"
```

---

### Task 4: WebSocket Hook

**Files:**
- Create: `dashboard/src/hooks/use-websocket.ts`

**Step 1: Create WebSocket connection hook**

```typescript
// dashboard/src/hooks/use-websocket.ts
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useHiveStore } from '@/store/hive-store';
import type { HiveEventUnion } from '@/types/events';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
const RECONNECT_INTERVAL = 3000;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const { setConnected, handleEvent } = useHiveStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onmessage = (msg) => {
      try {
        const event: HiveEventUnion = JSON.parse(msg.data);
        handleEvent(event);
      } catch {
        // skip malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, RECONNECT_INTERVAL);
    };

    ws.onerror = () => ws.close();
  }, [setConnected, handleEvent]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);
}
```

**Step 2: Commit**

```bash
git add dashboard/src/hooks/
git commit -m "feat(dashboard): add WebSocket hook with auto-reconnect"
```

---

### Task 5: Event Server

**Files:**
- Create: `dashboard/server/event-server.ts`
- Create: `dashboard/server/package.json`
- Create: `dashboard/server/tsconfig.json`

**Step 1: Create event server package**

```json
// dashboard/server/package.json
{
  "name": "hive-event-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "tsx event-server.ts",
    "dev": "tsx watch event-server.ts"
  },
  "dependencies": {
    "chokidar": "^4.0.0",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/ws": "^8.5.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create event server**

```typescript
// dashboard/server/event-server.ts
import { createReadStream, existsSync, statSync } from 'fs';
import { createInterface } from 'readline';
import { watch } from 'chokidar';
import { WebSocketServer, WebSocket } from 'ws';
import { resolve } from 'path';

const PORT = Number(process.env.PORT) || 3001;
const STATE_DIR = resolve(process.env.HIVE_STATE_DIR || '../../.hive-state');
const EVENTS_FILE = resolve(STATE_DIR, 'events.jsonl');

const wss = new WebSocketServer({ port: PORT });
const clients = new Set<WebSocket>();
let fileOffset = 0;

function broadcast(data: string) {
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function readNewLines() {
  if (!existsSync(EVENTS_FILE)) return;

  const stat = statSync(EVENTS_FILE);
  if (stat.size <= fileOffset) return;

  const stream = createReadStream(EVENTS_FILE, { start: fileOffset, encoding: 'utf-8' });
  const rl = createInterface({ input: stream });

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      JSON.parse(trimmed); // validate JSON
      broadcast(trimmed);
    } catch {
      // skip malformed
    }
  });

  rl.on('close', () => {
    fileOffset = stat.size;
  });
}

// Watch events.jsonl for changes
const watcher = watch(EVENTS_FILE, {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
});

watcher.on('change', readNewLines);
watcher.on('add', readNewLines);

// WebSocket connection handler
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  // Send existing events on connect (replay)
  if (existsSync(EVENTS_FILE)) {
    const stream = createReadStream(EVENTS_FILE, { encoding: 'utf-8' });
    const rl = createInterface({ input: stream });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (trimmed && ws.readyState === WebSocket.OPEN) {
        ws.send(trimmed);
      }
    });
  }
});

console.log(`Hive Event Server listening on ws://localhost:${PORT}`);
console.log(`Watching: ${EVENTS_FILE}`);

// Initialize offset
if (existsSync(EVENTS_FILE)) {
  fileOffset = statSync(EVENTS_FILE).size;
}
```

**Step 3: Install server dependencies**

```bash
cd /home/ryu-ubuntu/Document/GITHUB/hive-plugin/dashboard/server && npm install
```

**Step 4: Commit**

```bash
git add dashboard/server/
git commit -m "feat(dashboard): add WebSocket event server with chokidar file watcher"
```

---

### Task 6: React Flow Custom Nodes

**Files:**
- Create: `dashboard/src/components/nodes/lead-node.tsx`
- Create: `dashboard/src/components/nodes/worker-node.tsx`

**Step 1: Create LeadNode component**

```tsx
// dashboard/src/components/nodes/lead-node.tsx
'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { LeadNode as LeadNodeType } from '@/types/agents';

export function LeadNode({ data }: NodeProps<{ label: string } & LeadNodeType>) {
  return (
    <div className="rounded-xl border-2 border-blue-500 bg-blue-950 px-6 py-4 shadow-lg shadow-blue-500/20 min-w-[160px]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" />
        <span className="text-xs font-mono text-blue-300 uppercase tracking-wider">Lead</span>
      </div>
      <div className="text-lg font-bold text-white">Claude</div>
      <div className="text-xs text-blue-300 mt-1">
        {data.status === 'orchestrating' ? `Phase ${data.currentPhase}` : 'Idle'}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-3 !h-3" />
    </div>
  );
}
```

**Step 2: Create WorkerNode component**

```tsx
// dashboard/src/components/nodes/worker-node.tsx
'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AgentNode } from '@/types/agents';

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-400',
  working: 'bg-green-400 animate-pulse',
  done: 'bg-emerald-400',
  error: 'bg-red-400 animate-pulse',
};

const PROVIDER_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  claude: { border: 'border-blue-500', bg: 'bg-blue-950', text: 'text-blue-300' },
  codex: { border: 'border-amber-500', bg: 'bg-amber-950', text: 'text-amber-300' },
  gemini: { border: 'border-purple-500', bg: 'bg-purple-950', text: 'text-purple-300' },
};

const PROVIDER_LABELS: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
};

export function WorkerNode({ data }: NodeProps<{ label: string } & AgentNode>) {
  const colors = PROVIDER_COLORS[data.provider] || PROVIDER_COLORS.claude;
  const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS.idle;

  return (
    <div className={`rounded-xl border-2 ${colors.border} ${colors.bg} px-5 py-4 shadow-lg min-w-[180px] max-w-[220px]`}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3" />

      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-mono ${colors.text} uppercase tracking-wider`}>
          {PROVIDER_LABELS[data.provider]}
        </span>
        <div className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
      </div>

      <div className="text-sm font-bold text-white">{data.teamId}</div>
      <div className={`text-xs ${colors.text} mt-0.5`}>{data.modules?.join(', ')}</div>

      {data.currentTask && (
        <div className="mt-2 px-2 py-1.5 rounded-md bg-black/30 text-xs text-gray-300 leading-snug">
          {data.currentTask}
        </div>
      )}

      <div className="flex items-center gap-1 mt-2">
        <span className={`text-[10px] font-mono ${colors.text}`}>{data.status}</span>
        {data.consensusRounds > 0 && (
          <span className="text-[10px] text-gray-500 ml-auto">R{data.consensusRounds}</span>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add dashboard/src/components/nodes/
git commit -m "feat(dashboard): add LeadNode and WorkerNode React Flow custom nodes"
```

---

### Task 7: Pipeline Panel

**Files:**
- Create: `dashboard/src/components/pipeline-panel.tsx`

**Step 1: Create pipeline panel**

```tsx
// dashboard/src/components/pipeline-panel.tsx
'use client';

import { useHiveStore } from '@/store/hive-store';
import type { GateId, GateStatus } from '@/types/events';

const GATE_LABELS: Record<GateId, string> = {
  G1: 'CLARIFY',
  G2: 'SPEC',
  G3: 'PLAN REVIEW',
  G4: 'TDD RED',
  G5: 'IMPLEMENT',
  G6: 'CROSS-VERIFY',
  G7: 'E2E VALIDATE',
};

const STATUS_ICON: Record<GateStatus, string> = {
  passed: '\u2705',
  active: '\uD83D\uDD04',
  failed: '\u274C',
  pending: '\u2B1C',
};

const STATUS_STYLE: Record<GateStatus, string> = {
  passed: 'text-emerald-400 border-emerald-500/30',
  active: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5',
  failed: 'text-red-400 border-red-500/30',
  pending: 'text-gray-500 border-gray-700',
};

const GATES: GateId[] = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'];

export function PipelinePanel() {
  const { gates, currentPhase } = useHiveStore();

  return (
    <div className="flex flex-col gap-2 p-4 bg-gray-900 rounded-xl border border-gray-800 h-full">
      <h2 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-2">Pipeline</h2>

      <div className="flex flex-col gap-1.5">
        {GATES.map((gate) => {
          const status = gates[gate];
          return (
            <div
              key={gate}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${STATUS_STYLE[status]} transition-all`}
            >
              <span className="text-sm">{STATUS_ICON[status]}</span>
              <span className="text-xs font-mono font-medium">{gate}</span>
              <span className="text-xs opacity-70 truncate">{GATE_LABELS[gate]}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-800">
        <div className="text-xs text-gray-500 mb-1.5">Phase {currentPhase}/5</div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${(currentPhase / 5) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add dashboard/src/components/pipeline-panel.tsx
git commit -m "feat(dashboard): add PipelinePanel with gate indicators and phase progress"
```

---

### Task 8: Agent Detail Panel

**Files:**
- Create: `dashboard/src/components/agent-detail-panel.tsx`

**Step 1: Create agent detail panel**

```tsx
// dashboard/src/components/agent-detail-panel.tsx
'use client';

import { useHiveStore } from '@/store/hive-store';
import type { AgentNode } from '@/types/agents';

interface Props {
  selectedTeamId: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  idle: 'bg-gray-700 text-gray-300',
  working: 'bg-green-900 text-green-300',
  done: 'bg-emerald-900 text-emerald-300',
  error: 'bg-red-900 text-red-300',
};

export function AgentDetailPanel({ selectedTeamId }: Props) {
  const workers = useHiveStore((s) => s.workers);
  const eventLog = useHiveStore((s) => s.eventLog);

  const agent: AgentNode | null = selectedTeamId ? workers[selectedTeamId] ?? null : null;

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm p-4">
        Click a worker node to view details
      </div>
    );
  }

  const agentMessages = eventLog.filter(
    (e) => e.type === 'agent.message' &&
      ('from' in e.payload || 'to' in e.payload) &&
      (e.payload.from === agent.teamId || e.payload.to === agent.teamId)
  );

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-900 rounded-xl border border-gray-800 h-full overflow-y-auto">
      <div>
        <h2 className="text-lg font-bold text-white">{agent.teamId}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs font-mono text-gray-400 capitalize">{agent.provider}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_BADGE[agent.status]}`}>
            {agent.status}
          </span>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-mono text-gray-500 uppercase mb-1">Current Task</h3>
        <p className="text-sm text-gray-300 bg-black/30 rounded-lg px-3 py-2">
          {agent.currentTask || 'No active task'}
        </p>
      </div>

      <div>
        <h3 className="text-xs font-mono text-gray-500 uppercase mb-1">Modules</h3>
        <div className="flex flex-wrap gap-1">
          {agent.modules.map((m) => (
            <span key={m} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
              {m}
            </span>
          ))}
        </div>
      </div>

      {agent.changedFiles.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-gray-500 uppercase mb-1">
            Changed Files ({agent.changedFiles.length})
          </h3>
          <ul className="text-xs text-gray-400 space-y-0.5 font-mono">
            {agent.changedFiles.map((f) => (
              <li key={f} className="truncate">{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-xs font-mono text-gray-500 uppercase mb-1">
          Consensus (Round {agent.consensusRounds})
        </h3>
      </div>

      {agentMessages.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-gray-500 uppercase mb-1">Messages</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {agentMessages.slice(-10).map((e, i) => (
              <div key={i} className="text-xs text-gray-400 bg-black/20 rounded px-2 py-1">
                {String((e.payload as Record<string, unknown>).direction)}: {String((e.payload as Record<string, unknown>).summary)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add dashboard/src/components/agent-detail-panel.tsx
git commit -m "feat(dashboard): add AgentDetailPanel with task, files, and message history"
```

---

### Task 9: Event Log

**Files:**
- Create: `dashboard/src/components/event-log.tsx`

**Step 1: Create event log**

```tsx
// dashboard/src/components/event-log.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useHiveStore } from '@/store/hive-store';

const TYPE_COLORS: Record<string, string> = {
  'phase.transition': 'text-blue-400',
  'gate.update': 'text-yellow-400',
  'team.created': 'text-cyan-400',
  'agent.status': 'text-green-400',
  'agent.message': 'text-purple-400',
  'consensus.update': 'text-orange-400',
  'wave.transition': 'text-pink-400',
  'execution.result': 'text-emerald-400',
  'session.summary': 'text-white',
};

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
  } catch {
    return ts;
  }
}

function summarize(event: { type: string; payload: Record<string, unknown> }): string {
  const p = event.payload;
  switch (event.type) {
    case 'phase.transition': return `Phase ${p.phase} ${p.status}`;
    case 'gate.update': return `${p.gate} ${p.status}`;
    case 'team.created': return `${p.teamId} (${p.provider}) created`;
    case 'agent.status': return `${p.teamId} → ${p.status}: ${p.currentTask || ''}`;
    case 'agent.message': return `${p.direction}: ${p.summary}`;
    case 'consensus.update': return `${p.teamId} R${p.round} ${p.response}`;
    case 'wave.transition': return `Wave ${p.waveId} ${p.status}`;
    case 'execution.result': return `${p.teamId} ${p.success ? 'PASS' : 'FAIL'} (${(p.changedFiles as string[])?.length || 0} files)`;
    case 'session.summary': return `Complete: ${p.passed}/${p.totalTeams} passed`;
    default: return JSON.stringify(p);
  }
}

export function EventLog() {
  const eventLog = useHiveStore((s) => s.eventLog);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [eventLog.length]);

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 h-full overflow-y-auto font-mono text-xs">
      <h2 className="text-gray-500 uppercase tracking-wider mb-2 text-[10px]">Event Log</h2>
      {eventLog.length === 0 && (
        <div className="text-gray-700">Waiting for events...</div>
      )}
      {eventLog.map((event, i) => (
        <div key={i} className="flex gap-2 py-0.5 hover:bg-gray-900/50">
          <span className="text-gray-600 shrink-0">{formatTime(event.timestamp)}</span>
          <span className={`shrink-0 ${TYPE_COLORS[event.type] || 'text-gray-400'}`}>
            [{event.type}]
          </span>
          <span className="text-gray-400 truncate">{summarize(event)}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add dashboard/src/components/event-log.tsx
git commit -m "feat(dashboard): add EventLog with auto-scroll and event type colors"
```

---

### Task 10: Topology Graph (Main Canvas)

**Files:**
- Create: `dashboard/src/components/topology-graph.tsx`

**Step 1: Create topology graph**

```tsx
// dashboard/src/components/topology-graph.tsx
'use client';

import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  type Node,
  type Edge,
  type NodeTypes,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useHiveStore } from '@/store/hive-store';
import { LeadNode } from './nodes/lead-node';
import { WorkerNode } from './nodes/worker-node';

const nodeTypes: NodeTypes = {
  lead: LeadNode,
  worker: WorkerNode,
};

interface Props {
  onSelectAgent: (teamId: string | null) => void;
}

export function TopologyGraph({ onSelectAgent }: Props) {
  const lead = useHiveStore((s) => s.lead);
  const workers = useHiveStore((s) => s.workers);

  const { nodes, edges } = useMemo(() => {
    const workerList = Object.values(workers);
    const totalWorkers = workerList.length;
    const spacing = 220;
    const startX = -(totalWorkers - 1) * spacing / 2;

    const builtNodes: Node[] = [
      {
        id: 'lead',
        type: 'lead',
        position: { x: 0, y: 0 },
        data: { label: 'Lead', ...lead },
      },
      ...workerList.map((w, i) => ({
        id: w.teamId,
        type: 'worker' as const,
        position: { x: startX + i * spacing, y: 200 },
        data: { label: w.teamId, ...w },
      })),
    ];

    const builtEdges: Edge[] = workerList.map((w) => ({
      id: `lead-${w.teamId}`,
      source: 'lead',
      target: w.teamId,
      animated: w.status === 'working',
      style: {
        stroke: w.provider === 'claude' ? '#3b82f6' : w.provider === 'codex' ? '#f59e0b' : '#a855f7',
        strokeWidth: 2,
        strokeDasharray: w.provider === 'claude' ? undefined : '6 3',
      },
    }));

    return { nodes: builtNodes, edges: builtEdges };
  }, [lead, workers]);

  const [displayNodes, , onNodesChange] = useNodesState(nodes);
  const [displayEdges, , onEdgesChange] = useEdgesState(edges);

  // Sync store changes to display
  useMemo(() => {
    // This triggers re-render when nodes/edges change
  }, [nodes, edges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.id === 'lead') {
        onSelectAgent(null);
      } else {
        onSelectAgent(node.id);
      }
    },
    [onSelectAgent]
  );

  return (
    <div className="w-full h-full rounded-xl border border-gray-800 overflow-hidden bg-gray-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        className="bg-gray-950"
      >
        <Background color="#1f2937" gap={20} />
      </ReactFlow>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add dashboard/src/components/topology-graph.tsx
git commit -m "feat(dashboard): add TopologyGraph with dynamic node layout and edge styling"
```

---

### Task 11: Main Page Assembly

**Files:**
- Modify: `dashboard/src/app/page.tsx`
- Modify: `dashboard/src/app/layout.tsx`

**Step 1: Update layout**

```tsx
// dashboard/src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hive Dashboard',
  description: 'Real-time AI workspace for multi-agent orchestration',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  );
}
```

**Step 2: Assemble main page**

```tsx
// dashboard/src/app/page.tsx
'use client';

import { useState } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { useHiveStore } from '@/store/hive-store';
import { PipelinePanel } from '@/components/pipeline-panel';
import { TopologyGraph } from '@/components/topology-graph';
import { AgentDetailPanel } from '@/components/agent-detail-panel';
import { EventLog } from '@/components/event-log';

export default function DashboardPage() {
  useWebSocket();
  const connected = useHiveStore((s) => s.connected);
  const sessionId = useHiveStore((s) => s.sessionId);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold">Hive Dashboard</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {sessionId && (
            <span className="text-gray-500 font-mono">Session: {sessionId}</span>
          )}
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className={connected ? 'text-green-400' : 'text-red-400'}>
              {connected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>
      </header>

      {/* Main 3-column layout */}
      <div className="flex-1 flex gap-3 p-3 overflow-hidden">
        {/* Left: Pipeline */}
        <div className="w-48 shrink-0">
          <PipelinePanel />
        </div>

        {/* Center: Topology Graph */}
        <div className="flex-1 min-w-0">
          <TopologyGraph onSelectAgent={setSelectedTeamId} />
        </div>

        {/* Right: Agent Detail */}
        <div className="w-72 shrink-0">
          <AgentDetailPanel selectedTeamId={selectedTeamId} />
        </div>
      </div>

      {/* Bottom: Event Log */}
      <div className="h-48 shrink-0 px-3 pb-3">
        <EventLog />
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add dashboard/src/app/
git commit -m "feat(dashboard): assemble main page with 3-column layout and event log"
```

---

### Task 12: Demo Script (개발 검증용)

**Files:**
- Create: `dashboard/server/demo-events.ts`

**Step 1: Create demo event emitter**

```typescript
// dashboard/server/demo-events.ts
import { appendFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const STATE_DIR = resolve(process.env.HIVE_STATE_DIR || '../../.hive-state');
const EVENTS_FILE = resolve(STATE_DIR, 'events.jsonl');

mkdirSync(STATE_DIR, { recursive: true });
writeFileSync(EVENTS_FILE, ''); // reset

function emit(event: Record<string, unknown>) {
  const line = JSON.stringify({ ...event, timestamp: new Date().toISOString(), sessionId: 'demo-001' });
  appendFileSync(EVENTS_FILE, line + '\n');
  console.log(`Emitted: ${(event as { type: string }).type}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log('Starting demo event sequence...\n');

  emit({ type: 'phase.transition', payload: { phase: 0, status: 'enter' } });
  emit({ type: 'gate.update', payload: { gate: 'G1', status: 'active' } });
  await sleep(1000);
  emit({ type: 'gate.update', payload: { gate: 'G1', status: 'passed' } });
  emit({ type: 'gate.update', payload: { gate: 'G2', status: 'active' } });
  await sleep(1000);
  emit({ type: 'gate.update', payload: { gate: 'G2', status: 'passed' } });
  emit({ type: 'phase.transition', payload: { phase: 0, status: 'exit' } });

  emit({ type: 'phase.transition', payload: { phase: 3, status: 'enter' } });
  await sleep(500);

  emit({ type: 'team.created', payload: { teamId: 'T1-auth', modules: ['auth', 'session'], provider: 'claude', agentName: 'agent-auth' } });
  emit({ type: 'team.created', payload: { teamId: 'T2-api', modules: ['api', 'routes'], provider: 'codex', agentName: 'agent-api' } });
  emit({ type: 'team.created', payload: { teamId: 'T3-test', modules: ['tests', 'e2e'], provider: 'gemini', agentName: 'agent-test' } });
  await sleep(1000);

  emit({ type: 'phase.transition', payload: { phase: 4, status: 'enter' } });
  emit({ type: 'gate.update', payload: { gate: 'G3', status: 'active' } });

  emit({ type: 'consensus.update', payload: { teamId: 'T1-auth', round: 1, response: 'AGREE' } });
  emit({ type: 'consensus.update', payload: { teamId: 'T2-api', round: 1, response: 'COUNTER' } });
  await sleep(1500);
  emit({ type: 'consensus.update', payload: { teamId: 'T2-api', round: 2, response: 'AGREE' } });
  emit({ type: 'consensus.update', payload: { teamId: 'T3-test', round: 1, response: 'AGREE' } });
  emit({ type: 'gate.update', payload: { gate: 'G3', status: 'passed' } });

  emit({ type: 'phase.transition', payload: { phase: 5, status: 'enter' } });
  emit({ type: 'gate.update', payload: { gate: 'G4', status: 'active' } });

  emit({ type: 'wave.transition', payload: { waveId: 1, teams: ['T1-auth', 'T3-test'], status: 'start' } });
  emit({ type: 'agent.status', payload: { teamId: 'T1-auth', provider: 'claude', status: 'working', currentTask: 'Implementing auth module with JWT tokens' } });
  emit({ type: 'agent.status', payload: { teamId: 'T3-test', provider: 'gemini', status: 'working', currentTask: 'Writing test checklist for auth and API modules' } });
  await sleep(2000);

  emit({ type: 'agent.message', payload: { from: 'T1-auth', to: 'lead', direction: 'worker\u2192lead', summary: 'Auth module 70% complete, need clarification on token refresh strategy' } });
  emit({ type: 'agent.message', payload: { from: 'lead', to: 'T1-auth', direction: 'lead\u2192worker', summary: 'Use sliding window refresh, 15min access + 7d refresh token' } });
  await sleep(1500);

  emit({ type: 'gate.update', payload: { gate: 'G4', status: 'passed' } });
  emit({ type: 'gate.update', payload: { gate: 'G5', status: 'active' } });

  emit({ type: 'agent.status', payload: { teamId: 'T1-auth', provider: 'claude', status: 'done', currentTask: '' } });
  emit({ type: 'execution.result', payload: { teamId: 'T1-auth', changedFiles: ['src/auth.ts', 'src/session.ts', 'src/middleware.ts'], linesAdded: 245, linesRemoved: 12, success: true } });

  emit({ type: 'wave.transition', payload: { waveId: 1, teams: ['T1-auth', 'T3-test'], status: 'complete' } });
  emit({ type: 'wave.transition', payload: { waveId: 2, teams: ['T2-api'], status: 'start' } });

  emit({ type: 'agent.status', payload: { teamId: 'T2-api', provider: 'codex', status: 'working', currentTask: 'Implementing REST API endpoints for user management' } });
  await sleep(2000);

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
```

**Step 2: Add demo script to package.json**

Add to `dashboard/server/package.json` scripts:
```json
"demo": "tsx demo-events.ts"
```

**Step 3: Commit**

```bash
git add dashboard/server/demo-events.ts dashboard/server/package.json
git commit -m "feat(dashboard): add demo event script for development testing"
```

---

Plan complete and saved to `docs/plans/2026-03-15-hive-dashboard-impl.md`. Two execution options:

**1. Subagent-Driven (this session)** - 각 Task마다 fresh subagent를 dispatch, 태스크 간 리뷰, 빠른 반복

**2. Parallel Session (separate)** - 새 세션에서 executing-plans로 배치 실행, 체크포인트 기반

**어떤 방식으로 실행하시겠습니까?**