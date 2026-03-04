---
description: Brainstorm → Serena Context → Team Decomposition → Consensus → Execute. 멀티 프로바이더(Claude/Codex/Gemini) 오케스트레이션 팀 빌더.
allowedTools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Agent, TeamCreate, TeamDelete, TaskCreate, TaskUpdate, TaskList, TaskGet, SendMessage, mcp__serena-shared__list_dir, mcp__serena-shared__find_file, mcp__serena-shared__search_for_pattern, mcp__serena-shared__get_symbols_overview, mcp__serena-shared__find_symbol, mcp__serena-shared__find_referencing_symbols, mcp__serena-shared__read_memory, mcp__serena-shared__list_memories
---

# /hive - Multi-Orchestration Team Builder

> **Version**: 1.0.0
> **참조 스킬**: `hive-workflow.md`, `hive-consensus.md`, `hive-spawn-templates.md`

$ARGUMENTS

<mindset priority="HIGHEST">
천천히, 최선을 다해 작업하세요.

핵심 역할: **Brainstorm → Serena → Team → Consensus → Execute**
1. 사용자 요구사항을 brainstorm으로 명확화
2. Serena MCP로 코드베이스 컨텍스트 수집
3. 서비스/모듈 단위로 최대한 세분화된 팀 구성
4. 각 에이전트와 담당 모듈에 대해 양방향 합의
5. 합의 후에만 구현 착수

<mandatory_interaction rule="NEVER_SKIP">
AskUserQuestion은 워크플로우 필수 입력입니다 — 권한 승인이 아닙니다.

| Phase | 질문 | 스킵 조건 |
|-------|------|----------|
| Phase 1 | 명확화 질문 (1문 1답, 최대 4회) | 점수 >= 80이면 축소 |
| Phase 1 | 접근방식 선택 | 스킵 불가 |
| Phase 2 | 범위 확인 (모듈 6개+) | 5개 이하면 스킵 |
| Phase 3 | 팀 구성안 확인 | 스킵 불가 |
| Phase 5 | 실패 시 대응 선택 | 실패 시에만 |
</mandatory_interaction>

<hard_gate rule="CONSENSUS_BEFORE_IMPLEMENTATION">
합의 전 구현 금지.
Phase 4에서 모든 에이전트가 담당 모듈에 대해 CONSENSUS에 도달해야만
Phase 5 (Execute)로 진행할 수 있습니다.
어떤 예외도 없습니다.
</hard_gate>

절대 금지:
- Serena 컨텍스트 없이 팀 구성 X
- 사용자 확인 없이 팀 생성 X
- CONSENSUS 없이 구현 착수 X
- AskUserQuestion 스킵 X
</mindset>

---

## Phase Router

Phase 실행 순서 (순차):

```
Phase 1: Brainstorm (요구사항 명확화)
  → 5차원 평가 → 명확화 질문 → 접근방식 선택 → 요구사항 확정
  → 참조: hive-workflow.md § Phase 1

Phase 2: Serena Context (코드베이스 분석)
  → 디렉토리 스캔 → 심볼 오버뷰 → 대상 코드 식별 → 의존성 매핑
  → 참조: hive-workflow.md § Phase 2

Phase 3: Team Decomposition (팀 분해)
  → 모듈 클러스터링 → 프로바이더 배치 → ⛔ 팀 구성안 사용자 확인
  → 참조: hive-workflow.md § Phase 3

Phase 4: Consensus Loop (합의)
  → TeamCreate → 에이전트 스폰 → 병렬 개별 합의 → CONSENSUS 도달
  → 참조: hive-consensus.md

Phase 5: Execute & Monitor (실행)
  → Wave 기반 실행 → 결과 수집 → 통합 → 셧다운
  → 참조: hive-workflow.md § Phase 5, hive-spawn-templates.md
```

⛔ 표시 지점에서 반드시 멈추고 사용자 입력을 받으세요.
