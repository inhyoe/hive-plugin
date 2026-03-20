# Hook-Based Enforcement Engine Design

**Date**: 2026-03-20
**Status**: Draft
**Scope**: C-level (OmO-style full overhaul)

## Problem

Hive Plugin의 Phase/Gate 규칙이 SKILL.md 마크다운에만 의존하여 Claude가 합리화로 우회 가능.
2건의 실제 위반 사례 (2026-03-15: 프로토콜 준수율 44%, 2026-03-16: Phase 4 스킵).

## Solution

"지시는 MD, 강제는 코드"로 분리. TypeScript 기반 enforcement engine을 Hook 시스템에 통합.

## Architecture

```
Claude Code Hook System
│
├── UserPromptSubmit ──→ node hooks/enforcer/dist/index.js intent-gate
│   └── /hive 감지 → .hive-state/session.json { mode: "HIVE", phase: 0 }
│
├── PreToolUse(Bash) ──→ node hooks/enforcer/dist/index.js phase-guard
│   ├── .hive-state/ 마커 직접 생성 차단 (echo > *.marker)
│   ├── create-marker.sh만 허용
│   └── Phase 순서 위반 차단
│
├── PreToolUse(Agent) ──→ node hooks/enforcer/dist/index.js agent-dispatcher
│   └── 현재 Phase에 맞는 역할/도구 프로파일 검증 ★OmO 패턴
│
├── PostToolUse(Agent) ──→ node hooks/enforcer/dist/index.js agent-tracker
│   └── Phase 4 에이전트 스폰 증거 기록
│
├── PostToolUse(Edit|Write) ──→ bash hooks/scripts/validate-skills.sh (기존 유지)
│
└── PreToolUse(Bash) ──→ bash commit-gate (기존 유지)
```

## Component Design

### 1. Session State Manager (`lib/state.ts`)

HIVE 모드의 중앙 상태를 `.hive-state/session.json`으로 관리.

```typescript
interface HiveSession {
  mode: "IDLE" | "HIVE";
  phase: Phase;
  teams: string[];              // ["T1", "T2", ...]
  completedGates: Gate[];       // ["G1", "G2", ...]
  agentSpawns: AgentSpawn[];    // Phase 4-5 스폰 추적
  startedAt: string;            // ISO timestamp
}

type Phase = "INACTIVE" | "G1" | "G2" | "P0" | "P1" | "P2" | "P3" | "G3" | "P4" | "P5";
type Gate = "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "G7";

interface AgentSpawn {
  teamId: string;
  provider: "claude" | "codex" | "gemini";
  phase: Phase;
  timestamp: string;
  responseFile?: string;        // Phase 4 대화 증거 파일 경로
}
```

상태 전이는 `PHASE_ORDER` 배열로 강제:
```typescript
const PHASE_ORDER: Phase[] = [
  "G1", "G2", "P0", "P1", "P2", "P3", "G3", "P4", "P5"
];
// 현재 phase 인덱스보다 +1인 phase로만 전이 허용
```

### 2. Intent Gate (`handlers/intent-gate.ts`)

UserPromptSubmit Hook에서 실행. `/hive`를 감지하여 HIVE 모드 활성화.

```
입력: $PROMPT (사용자 프롬프트)
로직:
  1. /hive 패턴 매칭 (/hive, /hive ..., Skill(hive))
  2. 매칭 → session.json 생성 { mode: "HIVE", phase: "G1" }
  3. 비매칭 → exit 0 (패스스루)
  4. 이미 HIVE 모드 중 /hive 재호출 → 경고 메시지 출력, exit 0
출력: exit 0 (항상 허용, 상태만 설정)
```

### 3. Phase Guard (`handlers/phase-guard.ts`)

PreToolUse(Bash) Hook에서 실행. HIVE 모드 중 모든 Bash 명령을 감시.

```
입력: $TOOL_INPUT (Bash 명령어 JSON)
로직:
  A) 마커 직접 생성 차단:
     - 패턴: echo/cat/printf + > + .hive-state/*.marker
     - 예외: scripts/create-marker.sh에 의한 호출
     - 차단 시: "[BLOCKED] 마커는 create-marker.sh로만 생성 가능" + exit 2

  B) Phase 전이 검증:
     - create-marker.sh 호출 감지 → 인자에서 gate/phase 추출
     - 현재 session.phase와 비교
     - 순서 위반 시: "[BLOCKED] Phase {X} 완료 전 {Y} 진입 불가" + exit 2

  C) git commit 차단 (HIVE 모드 중):
     - Phase 5 완료 전 commit 시도 → 차단
     - (기존 commit-gate와 병렬 동작)

  D) IDLE 모드 → exit 0 (패스스루)
출력: exit 0 (허용) | exit 2 (차단)
```

### 4. Agent Dispatcher (`handlers/agent-dispatcher.ts`) — OmO 패턴

PreToolUse(Agent) Hook에서 실행. 에이전트 스폰 시 현재 Phase에 맞는 역할을 검증.

```
입력: $TOOL_INPUT (Agent 도구 파라미터 JSON)
로직:
  HIVE 모드가 아니면 → exit 0

  Phase별 허용 에이전트 프로파일:
  ┌────────┬─────────────────────────────────────────────┐
  │ Phase  │ 허용되는 Agent 패턴                          │
  ├────────┼─────────────────────────────────────────────┤
  │ P0     │ Explore, research, prompt-engineering        │
  │ P1     │ Explore, brainstorm                         │
  │ P2     │ Explore (Serena 컨텍스트 수집)               │
  │ P3     │ 없음 (리드가 직접 분해)                       │
  │ P4     │ general-purpose + consensus 키워드 필수       │
  │ P5     │ general-purpose + implementation/worktree    │
  │ G1-G3  │ Explore, Plan                               │
  └────────┴─────────────────────────────────────────────┘

  검증:
  1. Agent의 subagent_type/description이 현재 Phase 프로파일에 매칭되는지
  2. Phase 4: description에 team ID (T1, T2...) 포함 필수
  3. Phase 5: isolation="worktree" 권장 (경고만, 차단 안함)

  불일치 시:
  - "[WARNING] Phase {X}에서 {agent_type} 사용이 예상과 다릅니다"
  - stdout 경고만 (차단하지 않음 — 유연성 유지)

출력: exit 0 (항상 허용, 경고만)
```

**OmO의 analyze-mode 대응**: Phase 2에서 Explore 에이전트 자동 스폰을 강제하진 않지만,
Phase 2에서 구현 에이전트를 스폰하면 경고합니다. "올바른 도구를 올바른 시점에" 유도.

### 5. Agent Tracker (`handlers/agent-tracker.ts`)

PostToolUse(Agent) Hook에서 실행. 에이전트 응답을 추적하고 대화 증거 기록.

```
입력: $TOOL_RESULT (Agent 결과), $TOOL_INPUT (원래 파라미터)
로직:
  HIVE 모드가 아니면 → exit 0

  Phase 4 추적:
  1. Agent 응답에서 team ID 추출
  2. 응답 내용을 .hive-state/conversations/{teamId}-{roundId}.log에 저장
  3. session.json의 agentSpawns 배열에 기록
  4. AGREE/COUNTER/CLARIFY 패턴 감지하여 합의 상태 추적

  Phase 5 추적:
  1. 구현 결과를 .hive-state/implementations/{teamId}-{waveId}.log에 저장
  2. 성공/실패 기록

출력: exit 0 (항상 허용, 기록만)
```

### 6. Marker Creator (`scripts/create-marker.sh`)

마커 생성의 유일한 경로. Phase Guard가 직접 생성을 차단하므로 이 스크립트만 사용 가능.

```bash
Usage: create-marker.sh <gate> <team-id> [--evidence-file <path>]

검증:
  1. session.json에서 현재 phase 확인
  2. 요청된 gate가 현재 phase에서 생성 가능한지 확인
  3. --evidence-file이 필요한 게이트(G3, Phase 4 consensus)에서 파일 존재 확인
  4. 마커 내용에 타임스탬프 + evidence hash 포함
  5. session.json의 completedGates/phase 업데이트

예시:
  create-marker.sh g1 -- --evidence-file .hive-state/clarify-content.txt
  create-marker.sh consensus T1 --evidence-file .hive-state/conversations/T1-R1.log
```

## File Structure (신규)

```
hooks/enforcer/
├── package.json              # 의존성: typescript만 (devDep)
├── tsconfig.json             # target: ES2022, module: Node16
├── src/
│   ├── index.ts              # CLI 엔트리포인트 (이벤트 라우팅)
│   ├── handlers/
│   │   ├── intent-gate.ts    # UserPromptSubmit 핸들러
│   │   ├── phase-guard.ts    # PreToolUse(Bash) 핸들러
│   │   ├── agent-dispatcher.ts # PreToolUse(Agent) 핸들러
│   │   └── agent-tracker.ts  # PostToolUse(Agent) 핸들러
│   └── lib/
│       ├── state.ts          # session.json 읽기/쓰기
│       ├── phases.ts         # Phase 정의 + 전이 규칙
│       └── patterns.ts       # 명령어 패턴 매칭 유틸리티
├── dist/                     # 빌드 산출물 (git tracked)
│   └── index.js              # 번들된 단일 파일
└── __tests__/
    ├── intent-gate.test.ts
    ├── phase-guard.test.ts
    ├── agent-dispatcher.test.ts
    └── state.test.ts
```

## settings.json 변경

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [{
          "type": "command",
          "command": "node ./hooks/enforcer/dist/index.js intent-gate"
        }]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node ./hooks/enforcer/dist/index.js phase-guard"
          },
          {
            "type": "command",
            "command": "bash -c 'if echo \"$TOOL_INPUT\" | grep -qE \"git\\s+commit\"; then bash ./scripts/validate-all.sh; exit $?; fi; exit 0'"
          }
        ]
      },
      {
        "matcher": "Agent",
        "hooks": [{
          "type": "command",
          "command": "node ./hooks/enforcer/dist/index.js agent-dispatcher"
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "bash ./hooks/scripts/validate-skills.sh"
        }]
      },
      {
        "matcher": "Agent",
        "hooks": [{
          "type": "command",
          "command": "node ./hooks/enforcer/dist/index.js agent-tracker"
        }]
      }
    ]
  }
}
```

## Build & Deploy

```bash
cd hooks/enforcer
npm install          # devDependencies만 (typescript)
npm run build        # tsc → dist/
```

`dist/` 디렉토리를 git에 포함하여 설치 시 빌드 불필요.
의존성 0 (Node.js 내장 모듈만 사용: fs, path, child_process).

## Phase 전이 다이어그램

```
IDLE ──/hive──→ G1 ──create-marker g1──→ G2 ──create-marker g2──→ P0
  ↑                                                                 │
  │                    P1 ←── AskUserQuestion ────────────────────────┘
  │                    │
  │                    P2 ←── (Serena/Explore)
  │                    │
  │                    P3 ←── (Team Decomposition + AskUserQuestion)
  │                    │
  │                    G3 ←── (Plan Review + create-marker g3)
  │                    │
  │                    P4 ←── (Consensus Loop — per team)
  │                    │      create-marker consensus T1..TN
  │                    │
  │                    P5 ←── validate-phase5-entry.sh
  │                    │      (TDD Pipeline G4-G7)
  │                    │
  └────── IDLE ←───────┘ (완료 또는 /hive 종료)
```

## 차단 vs 경고 정책

| 상황 | 동작 | Exit Code |
|------|------|-----------|
| 마커 직접 생성 (echo > .marker) | **차단** | 2 |
| Phase 순서 위반 (P3 전에 P4 마커) | **차단** | 2 |
| HIVE 모드 중 Phase 5 전 commit | **차단** | 2 |
| Phase별 에이전트 불일치 | **경고** (stdout) | 0 |
| Phase 5 worktree 미사용 | **경고** (stdout) | 0 |
| IDLE 모드에서 모든 동작 | **패스스루** | 0 |

## 기존 스크립트와의 관계

| 기존 스크립트 | 변경 | 이유 |
|--------------|------|------|
| validate-skills.sh | 변경 없음 | SKILL.md 포맷 검증은 그대로 |
| validate-all.sh | 변경 없음 | 통합 검증 유지 |
| validate-plugin.sh | 변경 없음 | 54-check 구조 검증 유지 |
| validate-standards.sh | 변경 없음 | 27-check 표준 검증 유지 |
| test_markers.py | 변경 없음 | 20-check 마커 포맷 유지 |
| validate-phase5-entry.sh | 변경 없음 | Phase 5 진입 검증 유지 (create-marker.sh가 내부적으로 호출) |
| validate-gates.sh | 변경 없음 | 게이트 검증 유지 |

## 테스트 전략

- Unit: 각 handler를 독립 테스트 (vitest)
- Integration: 시나리오 기반 — "정상 Phase 전이", "순서 위반 차단", "마커 위조 차단"
- E2E: 실제 Claude Code Hook 시뮬레이션 (환경변수 주입 + exit code 확인)
