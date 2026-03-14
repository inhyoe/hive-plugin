---
name: hive
description: Orchestrates multi-provider AI teams (Claude/Codex/Gemini) through Prompt Engineering, Brainstorm, Serena Context, Team Decomposition, Consensus, and Execute phases. Use when decomposing large tasks across multiple AI agents, coordinating multi-agent implementation, or when the user requests team-based orchestration.
argument-hint: "[task-description]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Agent, TeamCreate, TeamDelete, TaskCreate, TaskUpdate, TaskList, TaskGet, SendMessage, mcp__serena-shared__list_dir, mcp__serena-shared__search_for_pattern, mcp__serena-shared__get_symbols_overview, mcp__serena-shared__find_symbol, mcp__serena-shared__find_referencing_symbols, mcp__serena-shared__read_memory, mcp__serena-shared__list_memories, mcp__plugin_prompts_chat_prompts_chat__improve_prompt, mcp__plugin_prompts_chat_prompts_chat__search_skills, mcp__plugin_prompts_chat_prompts_chat__search_prompts
---

# /hive - Multi-Orchestration Team Builder

> **Version**: 2.0.0
> **참조 스킬**: `hive-workflow`, `hive-consensus`, `hive-spawn-templates`, `hive-quality-gates`, `hive-tdd-pipeline`

$ARGUMENTS

<mindset priority="HIGHEST">
천천히, 최선을 다해 작업하세요.

핵심 역할: **Clarify → Spec → Prompt Eng → Brainstorm → Serena → Team → Consensus(Debate) → TDD Red → Implement Green → Cross-Verify → E2E Validate**
0. 사용자 요청을 MCP로 프롬프트 엔지니어링 + 리소스 자동 탐색
1. 사용자 요구사항을 brainstorm으로 명확화
2. Serena MCP로 코드베이스 컨텍스트 수집
3. 서비스/모듈 단위로 최대한 세분화된 팀 구성
4. 각 에이전트와 담당 모듈에 대해 양방향 합의
5. 합의 후에만 구현 착수

<mandatory_interaction rule="NEVER_SKIP">
AskUserQuestion은 워크플로우 필수 입력입니다 — 권한 승인이 아닙니다.

| Phase | 질문 | 스킵 조건 |
|-------|------|----------|
| Phase 0 | 엔지니어링된 프롬프트 확인 | 사용자가 "그냥 진행해" 시 스킵 |
| Phase 1 | 명확화 질문 (1문 1답, 최대 4회) | 점수 >= 80이면 축소 |
| Phase 1 | 접근방식 선택 | 스킵 불가 |
| Phase 2 | 범위 확인 (모듈 6개+) | 5개 이하면 스킵 |
| Phase 3 | 팀 구성안 확인 | 스킵 불가 |
| Phase 5 | 실패 시 대응 선택 | 실패 시에만 |
</mandatory_interaction>

<hard_gate rule="RULE_PRECEDENCE">
규칙 충돌 시 우선순위: hard_gate > phase_transition > consensus_protocol > guidance.
상위 규칙이 하위 규칙과 충돌하면 상위 규칙이 우선한다.
</hard_gate>

<hard_gate rule="CONSENSUS_BEFORE_IMPLEMENTATION">
합의 전 구현 금지.
Phase 4에서 모든 에이전트가 담당 모듈에 대해 CONSENSUS 또는 LEAD DECISION에 도달해야만
Phase 5 (Execute)로 진행할 수 있습니다.
LEAD DECISION은 CONSENSUS와 동등한 Phase 4 종료 조건이다 (hive-consensus §7 참조).
어떤 예외도 없습니다.
</hard_gate>

<hard_gate rule="BIDIRECTIONAL_COMMUNICATION">
일방적 소통 금지 — 리드와 에이전트 간 양방향 대화 필수.

통신 방식 (프로바이더별):
  - Claude Agent: SendMessage(recipient, content)
  - CCB (Codex/Gemini): /ask + pend (stateless, 각 요청에 round_id/team_id 포함)

Phase 4 (합의):
  1. TASK PROPOSAL 전용 프롬프트로 에이전트 스폰 (구현 지시 포함 금지)
  2. 에이전트 응답(AGREE/COUNTER/CLARIFY) 수신 → 리드가 반드시 응답
     - Claude Agent: SendMessage로 응답
     - CCB: /ask로 후속 메시지 전송
  3. COUNTER → 수용/부분수용/거절 근거와 함께 재제안
  4. CLARIFY → 추가 정보 제공 후 에이전트 재판단 대기
  5. 최소 1라운드의 실제 대화가 있어야 CONSENSUS 인정

Phase 5 (구현):
  1. CONSENSUS 확정 후에만 구현 프롬프트 전송 (별도 스폰 또는 메시지)
  2. 에이전트 중간 보고/질문 수신 → 리드가 반드시 응답
  3. 구현 결과물 수신 → 리드가 CONSENSUS 대비 검증 후 피드백

금지:
  - 합의 프롬프트 + 구현 지시를 하나로 합치기 X
  - 에이전트 응답 무시하고 결과만 수집 X
  - 에이전트에게 응답 없이 셧다운 X
</hard_gate>

<hard_gate rule="CODEX_MUST_IMPLEMENT">
Codex는 구현자이다 — 리뷰어로만 사용 금지.
  - 대규모 작업 (6+ 모듈): 최소 2개 모듈을 Codex에게 직접 구현 할당
  - 중소 작업 (3-5 모듈): 최소 1개 모듈을 Codex에게 직접 구현 할당
Codex에게 구현 위임 시 반드시:
  1. 수정 대상 심볼의 전체 코드 + 참조 타입/인터페이스 시그니처 포함
     (토큰 제한 고려 — 전체 파일 대신 관련 섹션 허용)
  2. 구체적 수정 지시 (파일명 + 함수/클래스 수준)
  3. `flutter analyze` 실행 요청 (Codex quick scan + 리드 post-Wave deep scan)
사후 리뷰만 맡기는 것은 이 규칙 위반이다.
</hard_gate>

<hard_gate rule="MULTI_PROVIDER_DISTRIBUTION">
Claude 에이전트 독점 금지.
팀 구성 시 멀티 프로바이더 분배:
  - Claude: 핵심 로직 + 아키텍처 (50-60%)
  - Codex: 직접 구현 + 리팩터링 (20-30%)
  - Gemini: 사전 리서치 + 테스트/문서 (10-20%)
적용 기준:
  - 대규모 (6+ 모듈): 위 비율 hard gate로 강제
  - 중소 (3-5 모듈): 위 비율을 guidance로 적용 (최소 Codex 1개 모듈 필수)
  - 소규모 (1-2 모듈): 비율 비적용. Claude 단독 허용하되, Codex/Gemini에게 사전 리뷰(설계 검토), 사후 검증(코드 검증), 또는 테스트 작성 중 1회 이상 위임해야 한다.
Phase 3 팀 구성안에 프로바이더 분배 비율을 명시해야 한다.
</hard_gate>

절대 금지:
- Serena 컨텍스트 없이 팀 구성 X
- 사용자 확인 없이 팀 생성 X
- CONSENSUS 없이 구현 착수 X
- AskUserQuestion 스킵 X
- Claude 에이전트로만 팀 구성 X (멀티 프로바이더 필수)
- Codex를 리뷰/감사로만 사용 X (구현 할당 필수)
- Gemini 리서치를 메모리에만 저장하고 미적용 X
- 에이전트 응답 무시하고 결과만 수집 X (양방향 대화 필수)
- 합의+구현을 하나의 프롬프트로 합치기 X (Phase 4→5 분리 필수)
- 에이전트에게 SendMessage 응답 없이 셧다운 X
- Stale CONSENSUS 재사용 X (Phase 5 실패→재진입 시 반드시 무효화 확인)
- CCB duplicate/out-of-order reply 무시 X (correlation key로 검증 필수)
- COUNTER/CLARIFY 응답 후 follow-up 누락 X
- blocked_by 의존성 무시하고 실행 X
</mindset>

---

## Dashboard Auto-Launch

/hive 진입 시 실시간 대시보드를 자동 기동합니다.

```
/hive 진입 즉시 (Phase Router 전):
  Step 1. 플러그인 경로 탐색:
    HIVE_PLUGIN_DIR 탐색 순서:
      a) 환경변수 CLAUDE_PLUGIN_ROOT (Claude Plugin 시스템이 자동 설정)
      b) 환경변수 HIVE_PLUGIN_DIR (수동 설정)
      c) ~/.claude/plugins/cache/hive/ (Plugin 설치 캐시)
      d) ~/.claude/plugins/hive/ (수동 git clone 설치)
      e) 현재 프로젝트에 .claude-plugin/plugin.json이 있으면 현재 디렉토리
      f) 없으면 대시보드 없이 진행 (경고만 출력, 스킵)
  Step 2. 세션 ID 생성 + 대시보드 시작:
    Bash("export HIVE_SESSION_ID='hive-$(date +%s)-$$' && bash $HIVE_PLUGIN_DIR/dashboard/scripts/hive-launcher.sh start")
  Step 3. 상태 확인:
    Bash("bash $HIVE_PLUGIN_DIR/dashboard/scripts/hive-launcher.sh status")

/hive 완료 시 (Phase 5 종료 후 또는 중단 시):
  Bash("HIVE_SESSION_ID=$HIVE_SESSION_ID bash $HIVE_PLUGIN_DIR/dashboard/scripts/hive-launcher.sh stop")

대시보드 시작 실패 시 /hive 워크플로우는 중단하지 않음 (대시보드는 부가 기능).
```

---

## Event Emission

각 Phase/Gate 전환 시 이벤트를 발행합니다. 대시보드가 실행 중이 아니어도 안전합니다.

```
이벤트 발행 방법:
  Bash("bash $HIVE_PLUGIN_DIR/dashboard/scripts/emit-event.sh <type> $HIVE_SESSION_ID '<payload>'")

발행 시점:
  | 시점 | type | payload 예시 |
  |------|------|-------------|
  | Phase 진입 | phase.transition | {"phase":0,"status":"enter"} |
  | Phase 종료 | phase.transition | {"phase":0,"status":"exit"} |
  | Gate 통과/실패 | gate.update | {"gate":"G1","status":"passed"} |
  | 팀 생성 | team.created | {"teamId":"T1","modules":["auth"],"provider":"claude","agentName":"a1"} |
  | 에이전트 스폰 | agent.spawn | {"teamId":"T1","provider":"claude","spawnMethod":"Agent"} |
  | 에이전트 상태 | agent.status | {"teamId":"T1","provider":"claude","status":"working","currentTask":"구현 중"} |
  | 리드↔워커 메시지 | agent.message | {"from":"T1","to":"lead","direction":"worker→lead","summary":"70% 완료"} |
  | 합의 응답 | consensus.update | {"teamId":"T1","round":1,"response":"AGREE"} |
  | Wave 전환 | wave.transition | {"waveId":1,"teams":["T1","T2"],"status":"start"} |
  | 실행 결과 | execution.result | {"teamId":"T1","changedFiles":["a.ts"],"linesAdded":100,"linesRemoved":5,"success":true} |
  | 세션 완료 | session.summary | {"totalTeams":3,"passed":3,"failed":0,"totalFiles":8,"totalChanges":500} |

emit-event.sh가 없거나 실패해도 워크플로우는 중단하지 않음 (|| true).
```

---

## Phase Router

Phase 실행 순서 (순차):

```
Phase 0: Prompt Engineering & Resource Discovery (프롬프트 엔지니어링 + 리소스 탐색)
  → ⛔ G1: CLARIFY + G2: SPEC 게이트 선행 필수 (참조: hive-quality-gates §2-3)
  → MCP improve_prompt → 리소스 매칭 → 관련 SKILL/PLUGIN 식별 → ⛔ 엔지니어링 결과 사용자 확인
  → 참조: hive-workflow § Phase 0

Phase 1: Brainstorm (요구사항 명확화)
  → 5차원 평가 → 명확화 질문 → 접근방식 선택 → 요구사항 확정
  → 참조: hive-workflow § Phase 1

Phase 2: Serena Context (코드베이스 분석)
  → 디렉토리 스캔 → 심볼 오버뷰 → 대상 코드 식별 → 의존성 매핑
  → 참조: hive-workflow § Phase 2

Phase 3: Team Decomposition (팀 분해)
  → 모듈 클러스터링 → 프로바이더 배치 → ⛔ 팀 구성안 사용자 확인
  → 참조: hive-workflow § Phase 3

Phase 4: Consensus Loop (합의) ⚠️ 양방향 대화 필수
  → ⛔ G3: PLAN REVIEW 상호 토론 선행 필수 (참조: hive-quality-gates §4)
  → TeamCreate → 에이전트 스폰 (TASK PROPOSAL만)
  → 에이전트 응답 수신 → 리드 SendMessage 응답
  → AGREE/COUNTER/CLARIFY 루프 → CONSENSUS 도달
  → ❌ 합의+구현을 하나로 합치기 금지
  → 참조: hive-consensus

Phase 5: Execute & Monitor (실행) ⚠️ TDD Pipeline 필수
  → G4-G7 TDD Pipeline 강제 (참조: hive-tdd-pipeline)
  → CONSENSUS 기반 구현 프롬프트 전송 (별도 스폰/메시지)
  → 에이전트 중간 보고 수신 → 리드 피드백
  → 결과 수집 → CONSENSUS 대비 검증 → 통합 → 셧다운
  → 참조: hive-workflow § Phase 5, hive-spawn-templates
```

⛔ 표시 지점에서 반드시 멈추고 사용자 입력을 받으세요.
