# Hive Dashboard Design — Real-time AI Workspace

> Date: 2026-03-15
> Version: 1.1.0
> Status: Design (Review feedback incorporated)

## Overview

Hive 플러그인의 멀티에이전트 오케스트레이션을 실시간으로 시각화하는 웹 대시보드.

### 목표
1. **Pipeline View**: Phase 0-5 + G1-G7 게이트 진행 상황 실시간 표시
2. **Team Topology Graph**: Lead(Claude)↔Worker(Claude/Codex/Gemini) 노드 그래프, 연결선으로 통신 흐름 표시
3. **Execution Result Dashboard**: 변경 파일, 합의 라운드, 성공/실패 요약
4. **Worker Activity**: 각 워커가 현재 어떤 작업을 하고 있는지 실시간 확인

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Hive Dashboard (Next.js)           │
│                                                      │
│  ┌──────────┐  ┌──────────────────┐  ┌────────────┐ │
│  │ Pipeline  │  │  Team Topology   │  │  Agent     │ │
│  │  View     │  │  (React Flow)    │  │  Detail    │ │
│  └──────────┘  └──────────────────┘  └────────────┘ │
│                                                      │
│              WebSocket Client (Zustand)              │
└──────────────────┬──────────────────────────────────┘
                   │ ws://localhost:3001
┌──────────────────┴──────────────────────────────────┐
│              Hive Event Server (Node.js)             │
│  .hive-state/events.jsonl watcher (chokidar)         │
│  → JSON parse → WebSocket broadcast                  │
└─────────────────────────────────────────────────────┘
```

### Layers

| Layer | Tech | Role |
|-------|------|------|
| Frontend | Next.js 15 + React Flow 12 + Tailwind 4 + Zustand 5 | Dashboard UI |
| Event Server | Node.js + ws 8 + chokidar 4 | File watch + WebSocket broadcast |
| Data Source | `.hive-state/events.jsonl` + `*.marker` | Gate markers, agent events |

---

## Team Topology Graph

3 providers all included:

```
                    ┌────────────┐
                    │    Lead    │
                    │  (Claude)  │
                    └─────┬──────┘
                ┌─────────┼─────────┐
                │         │         │
         ┌──────┴──┐ ┌────┴───┐ ┌──┴───────┐
         │ Claude  │ │ Codex  │ │ Gemini   │
         │ Agent   │ │ Worker │ │ Worker   │
         │ T1-auth │ │ T2-api │ │ T3-test  │
         │ Working │ │ Idle   │ │ Research │
         │ "인증   │ │        │ │ "체크리스│
         │  구현"  │ │        │ │  트 작성"│
         └─────────┘ └────────┘ └──────────┘
```

### Node Info
- Provider icon (Claude/Codex/Gemini)
- Team ID (T1, T2, ...)
- Real-time status (idle/working/done/error)
- Current task description

### Edge Types
- Claude Agent: solid line (SendMessage, bidirectional)
- Codex/Gemini: dashed line (/ask+pend, async)

---

## WebSocket Event Protocol

### Common Structure

```typescript
interface HiveEvent {
  type: string;
  timestamp: string;       // ISO 8601
  sessionId: string;
  payload: Record<string, unknown>;
}
```

### Event Catalog

| Event Type | Trigger | Key Payload |
|------------|---------|-------------|
| `phase.transition` | Phase change | `{ phase: 0-5, status: "enter"\|"exit" }` |
| `gate.update` | G1-G7 pass/fail | `{ gate, status: "passed"\|"failed"\|"active", marker }` |
| `team.created` | Phase 3 team creation | `{ teamId, modules[], provider, agentName }` |
| `agent.status` | Agent state change | `{ teamId, provider, status, currentTask }` |
| `agent.message` | Lead↔Worker message | `{ from, to, direction, summary }` |
| `consensus.update` | Consensus progress | `{ teamId, round, response }` |
| `wave.transition` | Wave execution | `{ waveId, teams[], status }` |
| `execution.result` | Team completion | `{ teamId, changedFiles[], linesAdded, linesRemoved, success }` |
| `session.summary` | Full completion | `{ totalTeams, passed, failed, totalFiles }` |
| `cross_feedback` | Cross-agent feedback | `{ fromTeam, toTeam, waveId, severity: "minor"\|"major"\|"design", summary }` |
| `lead.decision` | Lead unilateral decision | `{ teamId, reason, round }` |
| `phase.error` | Phase failure | `{ phase, teamId?, errorType, message }` |
| `execution.retry` | Team retry attempt | `{ teamId, attempt, maxAttempts, reentryPoint }` |
| `agent.spawn` | Agent process created | `{ teamId, provider, spawnMethod: "Agent"\|"ask" }` |

### Event Emission

Hive skills append to `.hive-state/events.jsonl` (one JSON per line).
Event Server watches this file with chokidar and broadcasts via WebSocket.
Marker file creation (`.hive-state/*.marker`) triggers a corresponding `gate.update` event in `events.jsonl` — single source of truth for the dashboard.

### Event Server Invariants

| Invariant | Implementation |
|-----------|---------------|
| Offset tracking | `fs.stat` file size, read new bytes from last known offset |
| Partial line buffering | Buffer incomplete JSON lines until next `\n` received |
| Reconnect replay | Client sends `lastEventIndex` on connect, server replays from that point |
| Delivery semantics | At-least-once (client deduplicates by timestamp+type) |
| File rotation | Reset offset when file size < previous offset (file was truncated/recreated) |
| Max event buffer | Server keeps last 1000 events in memory for replay; client ring buffer 200 |

### Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| `events.jsonl` grows unbounded | Session start resets file; max 10K lines before rotation |
| Mid-session dashboard connect | Server replays all events from file on new connection |
| Multiple concurrent sessions | Each session gets unique `sessionId`; dashboard filters by active session |
| Browser tab backgrounded | Events queue in Zustand store; no data loss, UI catches up on focus |
| chokidar `unlink` event | Server handles gracefully, resets offset, waits for file recreation |
| WebSocket connection loss | Auto-reconnect with 3s interval; replay missed events on reconnect |

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Hive Dashboard              Session: #abc123       ● Live  │
├────────┬────────────────────────────────────┬───────────────┤
│ PIPE-  │     TEAM TOPOLOGY (React Flow)     │ AGENT DETAIL  │
│ LINE   │     Lead ← → Workers              │ (click node)  │
│ G1-G7  │     with connection lines          │ Team/Task/    │
│ Phase  │                                    │ Files/History │
├────────┴────────────────────────────────────┴───────────────┤
│  EVENT LOG (real-time stream)                                │
└─────────────────────────────────────────────────────────────┘
```

### Component Tree

```
App
├── Header (session ID, connection status)
├── Main Layout (3-column)
│   ├── PipelinePanel (left)
│   │   ├── GateIndicator × 7
│   │   └── PhaseProgress
│   ├── TopologyGraph (center, React Flow)
│   │   ├── LeadNode
│   │   ├── WorkerNode × N
│   │   └── CommunicationEdge
│   └── AgentDetailPanel (right)
│       ├── TeamInfo
│       ├── TaskDescription
│       ├── FileList
│       └── ConsensusHistory
├── ResultsSummary (bottom-left, aggregate metrics)
│   ├── TotalFiles / LinesAdded / LinesRemoved
│   ├── TeamPassRate (passed/total)
│   └── ConsensusRoundAvg
└── EventLog (bottom-right)
```

---

## Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| Next.js | 15 | Framework |
| React Flow | 12 | Node graph |
| Zustand | 5 | State management |
| Tailwind CSS | 4 | Styling |
| ws | 8 | WebSocket server |
| chokidar | 4 | File watcher |

---

## Hive Plugin Changes (Minimal)

- Add event append logic to hive skills (write to `.hive-state/events.jsonl`)
- Existing marker system unchanged
- `dashboard/` directory added to repo root as separate package
