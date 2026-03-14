---
name: hive-workflow
description: /hive 스킬의 Phase 0-5 핵심 엔진. Prompt Engineering → Brainstorm → Serena Context → Team Decomposition → Execute.
user-invocable: false
---

# Hive Workflow Engine

> `/hive` 커맨드의 핵심 분석 엔진.
> Prompt Engineering → Brainstorm → Serena Context → Team Decomposition → Execute.

---

## Event Emission (Dashboard 연동)

각 Phase 진입/종료 시 아래 패턴으로 이벤트를 발행합니다:

```
SID 읽기 (모든 emit 호출에서 사용):
  SID=$(cat .hive-state/session-id 2>/dev/null || echo "no-session")

Phase 진입 시:
  Bash("SID=$(cat .hive-state/session-id 2>/dev/null || echo no-session) && bash $HIVE_PLUGIN_DIR/dashboard/scripts/emit-event.sh phase.transition $SID '{\"phase\":N,\"status\":\"enter\"}'" || true)

Phase 종료 시:
  Bash("SID=$(cat .hive-state/session-id 2>/dev/null || echo no-session) && bash $HIVE_PLUGIN_DIR/dashboard/scripts/emit-event.sh phase.transition $SID '{\"phase\":N,\"status\":\"exit\"}'" || true)

Gate 통과 시:
  Bash("SID=$(cat .hive-state/session-id 2>/dev/null || echo no-session) && bash $HIVE_PLUGIN_DIR/dashboard/scripts/emit-event.sh gate.update $SID '{\"gate\":\"G1\",\"status\":\"passed\"}'" || true)

팀 생성 시 (Phase 3):
  Bash("SID=$(cat .hive-state/session-id 2>/dev/null || echo no-session) && bash $HIVE_PLUGIN_DIR/dashboard/scripts/emit-event.sh team.created $SID '{\"teamId\":\"T1\",\"modules\":[\"auth\"],\"provider\":\"claude\",\"agentName\":\"a1\"}'" || true)

에이전트 상태 변경 시:
  Bash("SID=$(cat .hive-state/session-id 2>/dev/null || echo no-session) && bash $HIVE_PLUGIN_DIR/dashboard/scripts/emit-event.sh agent.status $SID '{\"teamId\":\"T1\",\"provider\":\"claude\",\"status\":\"working\",\"currentTask\":\"구현 중\"}'" || true)

핵심: 환경변수는 Bash() 호출 간 유지 안 됨 → .hive-state/session-id 파일에서 매번 읽음.
emit-event.sh 부재/실패 시 워크플로우는 중단하지 않음 (|| true 필수).
```

---

## Phase 0: Prompt Engineering & Resource Discovery (프롬프트 엔지니어링 + 리소스 탐색)

<hard_gate rule="QUALITY_GATES_G1_G2">
Phase 0 진입 전 G1(CLARIFY)+G2(SPEC) 통과 필수. 참조: hive-quality-gates §2-3.
</hard_gate>
사용자의 원본 요청($ARGUMENTS)을 분석하여 프롬프트를 구체화하고, 작업에 필요한 리소스를 자동 식별합니다.

### 0-1. 프롬프트 엔지니어링 (MCP)

```
Step A: MCP improve_prompt 호출
  mcp__plugin_prompts_chat_prompts_chat__improve_prompt(prompt=$ARGUMENTS)
  → 구조화된 프롬프트 반환
Step B: MCP search_prompts로 유사 프롬프트 탐색 (보완)
  요청에서 핵심 키워드 추출 (예: "UI 수정", "Stitch", "이력 화면")
  mcp__plugin_prompts_chat_prompts_chat__search_prompts(query=키워드, limit=3)
  → 유사 프롬프트가 있으면 참조 패턴으로 활용
Step C: 엔지니어링 결과 정리
  engineered_prompt = {
    "original": $ARGUMENTS,
    "improved": improve_prompt 결과,
    "reference_patterns": search_prompts에서 채택한 패턴 (있으면),
    "keywords": 추출된 핵심 키워드 목록
  }
```

### 0-2. 리소스 자동 탐색

```
Step D: SKILL 매칭
  SessionStart에서 주입된 리소스 목록과 CLAUDE.md Skill Auto-Trigger 테이블을 기반으로:
  1. engineered_prompt.keywords를 각 트리거 시그널과 대조
  2. 매칭되는 스킬 목록 생성
  예시:
    키워드 "Stitch + UI + 화면" → stitch-flutter, flutter-widget-decomposition
    키워드 "새 기능 + 화면 생성" → flutter-feature-scaffold, riverpod-patterns
    키워드 "버그 수정" → superpowers:systematic-debugging, flutter-error-handling
Step E: MCP search_skills로 추가 스킬 탐색
  mcp__plugin_prompts_chat_prompts_chat__search_skills(query=핵심 키워드, limit=5)
  → prompts.chat 레지스트리에서 설치 가능한 외부 스킬 확인
  → 이미 로컬에 있는 스킬과 중복 제거
Step F: PLUGIN/AGENT 매칭
  engineered_prompt.keywords 기반으로:
  - voltagent 서브에이전트 중 적합한 것 식별 (qa-sec, core-dev, biz)
  - superpowers 스킬 중 프로세스 스킬 식별 (brainstorming, TDD, debugging 등)
```

### 0-3. 리소스 매칭 결과 (in-memory)

```
resource_map = {
  "skills_local": ["stitch-flutter", "flutter-widget-decomposition", ...],
  "skills_external": [search_skills 결과 중 유용한 것],
  "process_skills": ["superpowers:brainstorming", "superpowers:TDD", ...],
  "subagents": ["voltagent-core-dev:frontend-developer", ...],
  "mcp_tools": ["improve_prompt", "search_skills", ...],
  "execution_recommendation": "SUB_AGENT" | "CLAUDE_TEAM" | "SOLO"
}
실행 방식 판단 기준:
  - 모듈 1-2개 + 스킬 매칭 충분 → SOLO (Claude 단독 + 스킬)
  - 모듈 3-5개 + 독립 작업 가능 → SUB_AGENT (병렬 서브에이전트)
  - 모듈 6개+ 또는 크로스커팅 → CLAUDE_TEAM (Phase 3-5 풀 오케스트레이션)
```

### 0-4. 사용자 확인

```
Phase 0 결과를 아래 형식으로 표시:
PROMPT ENGINEERING COMPLETE
============================
원본: {$ARGUMENTS 요약}
개선: {engineered_prompt.improved 요약}
매칭된 리소스:
- 리소스: 스킬:{skills_local} | 프로세스:{process_skills} | 서브에이전트:{subagents} | 외부:{skills_external}
실행 방식 추천: {execution_recommendation}
  근거: {판단 근거 1줄}
AskUserQuestion:
  "위 분석 결과를 확인해주세요."
  Options:
    A. "승인 — 이대로 Phase 1 진입"
    B. "프롬프트 수정 — 다시 엔지니어링"
    C. "리소스 조정 — 스킬/에이전트 변경"
    D. "그냥 진행해 — Phase 0 스킵하고 원본으로 진행"
```

### 0-5. Phase 0 → Phase 1 전달

```
Phase 0 완료 시 Phase 1에 전달하는 데이터:
  - engineered_prompt (개선된 프롬프트 — Phase 1의 $ARGUMENTS를 대체)
  - resource_map (Phase 3 팀 구성 시 참조)
  - execution_recommendation (Phase 3 팀 분할 방식 사전 결정)
Phase 1은 engineered_prompt를 기반으로 5차원 평가를 수행한다.
resource_map의 process_skills는 Phase 5 실행 시 에이전트 프롬프트에 포함한다.
```

---

## Phase 1: Brainstorm (요구사항 명확화)

### 1-1. 5차원 요구사항 평가

$ARGUMENTS를 파싱하여 아래 5개 차원으로 초기 평가합니다.
각 차원에 0-100 점수를 부여하고 가중 합산합니다.

| 차원 | 가중치 | 평가 기준 |
|------|--------|----------|
| Problem Clarity | 30% | 해결하려는 문제가 명확한가 |
| Functional Scope | 25% | 기능 범위가 특정 가능한가 (단일 모듈 vs 크로스커팅) |
| Success Criteria | 20% | 검증 방법이 정의되어 있는가 |
| Constraints | 15% | 제약사항이 명시되어 있는가 |
| Priority/MVP | 10% | 우선순위/단계적 전달이 정의되어 있는가 |

#### 평가 로직

```
initial_score = weighted_sum(dimensions)

IF initial_score >= 80:
  → 1라운드 질문 (가장 낮은 2개 차원)
  → Phase 1-3으로
ELSE:
  → 1라운드 질문 (가장 낮은 2개 차원)
  → 점수 재평가
  → IF still < 80: 2라운드 질문 (다시 가장 낮은 2개)
  → Phase 1-3으로 (gap 기록)
```

### 1-2. 명확화 질문

규칙:
- **한 번에 질문 1개만** (AskUserQuestion 1회 = 1질문)
- 가능하면 **객관식** (options 2-4개)
- 사용자가 "그냥 진행해" 응답 시 즉시 다음 Phase로

#### 차원별 질문 은행

| 차원 | 질문 | Options (점수) |
|------|------|---------------|
| Problem Clarity (30%) | "어떤 유형의 작업인가요?" | A. 버그 수정(27) B. 새 기능(27) C. 성능 개선(24) D. 리팩터링(18) |
| Functional Scope (25%) | "기능 범위가 어느 정도인가요?" | A. 단일 모듈(23) B. 2-3개 모듈(20) C. 크로스커팅(18) D. 분석 필요(10) |
| Success Criteria (20%) | "성공을 어떻게 검증할 건가요?" | A. 자동화 테스트(18) B. 성능 벤치마크(18) C. 수동 체크리스트(14) D. 미정의(6) |
| Constraints (15%) | "주요 제약사항이 있나요?" | A. 하위호환 필수(14) B. 라이브러리 제한(12) C. 성능 SLA(12) D. 없음(15) |
| Priority/MVP (10%) | "우선순위를 어떻게 나누시겠어요?" | A. 전부 한번에(8) B. 핵심 먼저(10) C. MVP 검증(10) |

### 1-3. 접근방식 제안

요구사항이 명확해지면:
1. 2-3가지 접근방식 제안
2. 각각의 **트레이드오프** 명시 (장점/단점)
3. **추천안** 표시 + 이유
4. AskUserQuestion: 접근방식 선택

### 1-4. 요구사항 확정 문서 (in-memory)

Phase 1 완료 시 아래 구조체를 메모리에 유지하고 Phase 2로 전달:

```markdown
## Hive Requirements Summary
- **목표**: {1-2문장}
- **접근방식**: {선택된 방식}
- **기능 범위**: {모듈/서비스 목록}
- **성공 기준**: {검증 방법}
- **제약사항**: {있으면}
- **미확인 사항**: {gap 목록}
```

---

## Phase 2: Serena Context (코드베이스 분석)

Phase 1 요구사항의 **기능 범위**를 기반으로 Serena MCP를 단계적으로 호출합니다.

### 2-1. 프로젝트 구조 파악 (Top-Down)

```
Step A: 디렉토리 스캔
  mcp__serena-shared__list_dir(".", recursive=false)
  → 최상위 구조 파악

  mcp__serena-shared__list_dir("lib", recursive=true)
  → 소스 코드 트리

Step B: 핵심 모듈 심볼 오버뷰
  요구사항 기능 범위에 해당하는 디렉토리들:
  mcp__serena-shared__get_symbols_overview(relative_path, depth=1)
  → 클래스/함수/변수 목록 수집
```

### 2-2. 작업 대상 코드 식별 (Targeted)

```
Step C: 키워드 기반 심볼 검색
  요구사항에서 핵심 키워드 추출:
  mcp__serena-shared__find_symbol(name_path_pattern, substring_matching=true)
  → 관련 클래스/메서드 식별

Step D: 패턴 검색 (보완)
  심볼 검색으로 부족하면:
  mcp__serena-shared__search_for_pattern(substring_pattern, restrict_search_to_code_files=true)
  → 문자열 리터럴, 설정값, 라우트 등 비심볼 탐색
```

### 2-3. 의존성 매핑

```
Step E: 참조 그래프
  식별된 핵심 심볼들:
  mcp__serena-shared__find_referencing_symbols(name_path, relative_path)
  → 누가 이 코드를 쓰는지, 변경 영향 범위

Step F: 영향 범위 맵 생성 (in-memory)
  {
    "modules": [
      {
        "name": "module_name",
        "files": ["lib/path/to/file.dart", ...],
        "symbols": ["ClassName", "methodName", ...],
        "dependencies": ["other_module", ...],
        "dependents": ["consuming_module", ...]
      }
    ]
  }
```

### 2-4. 자동 vs 수동 경계

| 상황 | 동작 |
|------|------|
| 영향 모듈 5개 이하 | 자동으로 Phase 3 진입 |
| 영향 모듈 6개 이상 | AskUserQuestion: "이 모듈들이 맞나요?" |
| Serena에서 심볼 못 찾음 | 사용자에게 힌트 요청 후 재검색 |

원칙:
- **최소 토큰**: `include_body=false`로 시작, 필요한 심볼만 `include_body=true`
- **Serena 우선**: Read로 전체 파일 읽기 대신 심볼 단위 탐색
- **영향 범위 맵이 Phase 3의 입력**
- **컨텍스트 예산**: 리드=요구사항+아키텍처, Claude=심볼+의존성, Codex=코드+타입만, Gemini=요약+패턴 (hive-spawn-templates §2)

---

## Phase 3: Team Decomposition (팀 분해)

Phase 2의 영향 범위 맵을 기반으로 팀을 최대한 세분화합니다.

### 3-1. 팀 분할 알고리즘

```
Step A: 모듈 클러스터링
  각 모듈의 의존성 방향 분석:
  - 독립 모듈 (의존성 없음) → 각각 별도 팀
  - 강결합 모듈 (상호 의존) → 하나의 팀으로 묶음
  - 약결합 모듈 (단방향 의존) → 별도 팀 + 의존성 순서

Step B: 팀 규모 제한
  팀당 최대 2개 모듈 (초과 시 재분할)
  팀당 최소 1개 모듈 (의미 있는 작업 단위)

Step C: 의존성 → 실행 순서 (topological sort)
  foundation (model, repository) → 먼저
  feature (service, viewmodel) → 중간
  presentation (view, widget) → 마지막
```

### 3-2. 프로바이더 배치 전략

| 작업 성격 | Provider | 이유 |
|-----------|----------|------|
| 핵심 로직 / 아키텍처 설계 | **Claude** (Agent tool) | 복잡한 추론, 설계 판단 |
| 직접 구현 / 리팩터링 | **Codex** (`/ask codex`) | 코드 생성 강점, 구체적 파일 수정 |
| 사전 리서치 / 체크리스트 | **Gemini** (`/ask gemini`) | Phase 1에서 먼저 호출, 기준 확보 |
| 테스트 작성 / 문서 | **Gemini** (`/ask gemini`) | 대량 토큰, 반복 작업 |
| 간단한 수정 / 설정 | **Claude haiku** (Agent tool) | 빠른 처리, 저비용 |

#### 프로바이더 분배 비율 (MANDATORY)

```
대규모 작업 (6+ 모듈) — hard gate:
  Step 0: Gemini → 리서치/체크리스트 확보 (에이전트 스폰 전)
  Step 1: Codex → 아키텍처 사전 리뷰 (에이전트 스폰 전)
  Step 2 (병렬 구현):
    Claude 에이전트 50-60% → 핵심 UI/로직 모듈
    Codex 20-30% → 2-3개 모듈 직접 구현 (/ask codex로 파일 내용 + 구체적 수정 지시)
    Gemini 10-20% → 접근성/l10n/문서 관련 모듈
  Step 3 (교차 검증):
    Codex → Claude 수정 코드 리뷰 (변경 diff + CONSENSUS 기준 제공)
    Claude → Codex 수정 코드 검증 (변경 diff + CONSENSUS 기준 제공)
    수락 기준: CONSENSUS 일치 + flutter analyze 통과
    타임아웃: 교차 검증 5분 내 미완료 시 리드가 직접 검증

중소 작업 (3-5 모듈) — guidance:
  Claude → 핵심 2-3개
  Codex → 최소 1개 직접 구현
  Gemini → 리서치 (필요 시)

소규모 작업 (1-2 모듈) — exception:
  비율 비적용 (물리적으로 % 분배 불가)
  Claude 단독 구현 허용
  단, Codex/Gemini에게 최소 1회 아래 유형 중 하나를 위임 필수:
    - 사전 리뷰: 구현 전 설계/접근방식 검토 (예: /ask codex "[REVIEW] 아래 설계 검토해줘: ...")
    - 사후 검증: 구현 후 코드 변경 검증 (예: /ask codex "[VERIFY] 아래 변경 검토해줘: ...")
    - 테스트 작성: 구현된 코드에 대한 테스트 생성 (예: /ask gemini "[TEST] 아래 코드의 테스트 작성해줘: ...")
```

배치 규칙:
1. 팀 리드 = 항상 Claude main (오케스트레이터)
2. 각 팀에 최소 1 에이전트
3. 복잡도 높은 팀 = Claude sonnet/opus
4. 대량 반복 작업 = Gemini
5. 코드 구현 중심 = Codex (대규모 6+: **최소 2개**, 중소 3-5: **최소 1개** 직접 할당)
6. 한 팀에 여러 프로바이더 혼합 가능
7. **팀 구성안에 프로바이더 분배 비율을 반드시 명시**

### 3-3. 팀 구성안 출력

팀 구성안을 아래 형식으로 사용자에게 표시:

```markdown
## Hive Team Plan

### 프로바이더 분배
| Provider | 모듈 수 | 비율 | 역할 |
|----------|--------|------|------|
| Claude   | N개    | 55%  | 핵심 로직, 아키텍처 |
| Codex    | N개    | 25%  | 직접 구현, 리팩터링 |
| Gemini   | N개    | 20%  | 리서치, 테스트, 문서 |

### 실행 순서: T1 → T2 → [T3, T4] (병렬) → T5

| 팀 ID | 모듈 | 에이전트 | Provider | 태스크 요약 |
|-------|------|---------|----------|------------|
| T1-xxx | module_a | agent-a | Claude sonnet | ... |
| T2-xxx | module_b | agent-b | **Codex** | ... |
| T3-xxx | module_c | agent-c | **Codex** | ... |
| T4-xxx | module_d | agent-d | Gemini | ... |

### 의존성
T2 blocked_by: [T1]
```

**필수 검증**: 대규모(6+)에서 Codex 직접 구현 모듈 최소 2개, 중소(3-5)에서 최소 1개 포함 확인.

### 3-4. 사용자 확인 (필수)

```
AskUserQuestion:
  "위 팀 구성안을 확인해주세요."
  Options:
    A. "승인 — 이대로 진행"
    B. "수정 필요 — 팀 분할 조정"
    C. "프로바이더 변경 — 특정 팀의 프로바이더 교체"
    D. "처음부터 다시"
```

수정 요청 시 해당 부분만 재조정 후 다시 확인.

---

## Phase 5: Execute & Monitor

<hard_gate rule="QUALITY_GATES_G4_G7">
Phase 5 실행 시 G4-G7 TDD 게이트 강제. 참조: hive-tdd-pipeline §2-5.
</hard_gate>
### 5-1. 실행 순서 (Wave 기반)

```
Phase 3의 의존성 그래프 (topological sort) 기반:

  Wave 1: 독립 팀 (blocked_by 없음) → 동시 실행
  Wave 2: Wave 1 완료 대기 → 의존 팀 실행
  Wave 3: Wave 2 완료 대기 → 후속 팀 실행
```

### 5-2. 프로바이더별 실행

스폰 방법은 `hive-spawn-templates` 스킬 참조.

```
사전 준비 (에이전트 스폰 전):
  Gemini → 리서치/체크리스트 확보 (결과를 에이전트 프롬프트에 "기준"으로 직접 포함)
  Codex → 아키텍처 사전 리뷰 (결과를 에이전트 지침에 반영)
Claude 에이전트:
  Agent tool (subagent_type="general-purpose")
  → team_name 지정, isolation="worktree"
  → CONSENSUS 문서 + Serena 컨텍스트를 프롬프트에 포함
Codex 에이전트 (직접 구현 — MANDATORY):
  /ask codex "파일 내용 + 구체적 수정 지시"
  → 수정 대상 심볼의 전체 코드 + 참조 타입/인터페이스 시그니처 + 관련 import 포함
    (토큰 제한 고려 — 전체 파일 대신 관련 섹션 허용)
  → 파일명 + 수정할 함수/클래스 수준의 구체적 지시
  → flutter analyze 실행 요청 (Codex quick scan)
  → Async Guardrail 준수 (CCB_ASYNC_SUBMITTED → 턴 종료)
  → round_id/team_id 마커 포함 (예: [HIVE IMPLEMENTATION — T2 — W1])
Gemini 에이전트:
  /ask gemini "$PROMPT"
  → 동일 CCB 패턴
```

**실행 순서**: Claude Agent tool 호출을 먼저 실행 (병렬 스폰), 이후 CCB /ask 호출.
CCB async guardrail로 인해 /ask 후 턴 종료되므로, Claude 에이전트를 먼저 스폰해야 한다.
Codex는 사후 리뷰가 아닌 **병렬 구현자**로 참여한다.

**flutter analyze 하이브리드**: Codex가 quick scan 실행, 리드가 모든 Wave 완료 후
`flutter analyze --fatal-infos`로 deep scan 실행 (최종 Quality Gate).

### 5-3. 결과 수집 및 양방향 피드백 (MANDATORY)

```
Claude 에이전트:
  1. SendMessage 자동 수신 (idle notification)
  2. 에이전트 중간 보고/질문 → 리드가 반드시 SendMessage로 응답
     - 문제 없음 → "확인했습니다. 계속 진행하세요"
     - 방향 조정 → 구체적 수정 지시
     - CONSENSUS 위반 → 관련 항목 인용 + 올바른 방향 제시
  3. 에이전트 완료 보고 → CONSENSUS 대비 검증 후 피드백

CCB 에이전트:
  pend로 수집 → CCB_DONE marker 확인
  COUNTER/CLARIFY 마커 발견 시 → /ask로 재응답 (무시 금지)

Wave 완료 조건: 해당 Wave 모든 팀 completed → 다음 Wave 실행
```

### 5-3a. 교차 에이전트 피드백 (Cross-Agent Feedback)

Wave N+1 에이전트가 Wave N 결과에서 문제 발견 시:

```
[CROSS FEEDBACK — {발견 팀}→{대상 팀} — {wave_id}]
리드 판단:
  A. 경미 → 리드 직접 수정
  B. 중대 → 대상 팀에 수정 요청 → 발견 팀 재검증
  C. 설계 결함 → Phase 4 해당 팀 재합의 (§10-1 적용)
```

교차 피드백은 **Wave 간에만** 발생. 리드는 수신 시 반드시 판단 + 조치 (무시 금지).
상세 마커 형식: hive-consensus §13 참조.

### 5-4. Failure Analysis (실패 분석 — Ralph Loop V2)

Phase 5 실패 시 **동일 프롬프트 재시도 금지**. 원인 분류 후 맞춤 재진입.

#### 실패 원인 분류

| 분류 | 진단 기준 | 리드 대응 | 재진입 지점 |
|------|----------|----------|------------|
| 컨텍스트 부족 | 에이전트가 잘못된 파일/심볼 참조 | 파일 목록 재선정 | Phase 5 재시도 (CONSENSUS 유지) |
| 잘못된 방향 | 구현이 CONSENSUS와 불일치 | CONSENSUS 부분 무효화 + 재합의 | Phase 4 재진입 (해당 팀만) |
| 요구사항 오해 | 결과가 사용자 의도와 불일치 | 요구사항 재명확화 | Phase 1 재진입 (§10-1 전체 무효화) |
| 기술적 장벽 | API 미지원, 라이브러리 한계 | 대안 접근 탐색 + 팀 재구성 | Phase 3 재진입 (해당 팀 무효화) |
| CCB 타임아웃 | soft 3min 미응답 → hard 10min | pend 재확인 → LEAD DECISION | Phase 4 (hive-consensus §4) |

#### 분석 프로세스

```
Phase 5 실패 감지
  → Step 1: 원인 분류 (위 표 기준)
  → Step 2: 프롬프트 재작성
    - 컨텍스트 부족 → 파일 선택 재실행 (hive-spawn-templates §3)
    - 잘못된 방향 → CONSENSUS 변경점을 새 프롬프트에 명시
    - 요구사항 오해 → AskUserQuestion으로 사용자 재확인
  → Step 3: 패턴 기록 (auto-memory)
    성공 패턴: "이 프롬프트 구조가 {작업유형}에 효과적"
    실패 패턴: "Codex에게 {X}는 타입 정의 사전 제공 필수"
  → Step 4: 재진입 (무효화 매트릭스 §10-1 참조)
```

동일 팀 최대 3회 재시도. 3회 실패 시 AskUserQuestion:
Options: A. 리드가 직접 처리 B. 해당 팀 제외 C. 전체 중단

### 5-5. 팀 셧다운

```
모든 Wave 완료 후:
  1. Claude 에이전트: SendMessage(type="shutdown_request")
  2. CCB 세션: idle_timeout 자동 종료
  3. 최종 결과 요약 출력 → TeamDelete
```

### 5-6. 최종 출력
```
## Hive Execution Complete
| 팀 | 상태 | 변경 파일 | 합의 라운드 |
| T1 | ... | files... | N |
총 변경: N files, +X/-Y | 후속: [기록]
```

### 5-7. 대시보드 이벤트 발행 + 종료

```
Phase 5 완료 후 반드시:
  1. 세션 요약 이벤트 발행:
     Bash("bash $HIVE_PLUGIN_DIR/dashboard/scripts/emit-event.sh session.summary $HIVE_SESSION_ID '{\"totalTeams\":N,\"passed\":P,\"failed\":F,\"totalFiles\":T,\"totalChanges\":C}'" || true)
  2. 세션 아카이브 + 학습:
     Bash("bash $HIVE_PLUGIN_DIR/dashboard/scripts/archive-session.sh $(cat .hive-state/session-id)" || true)
  3. 대시보드 종료 (본인 세션만):
     Bash("HIVE_SESSION_ID=$(cat .hive-state/session-id) bash $HIVE_PLUGIN_DIR/dashboard/scripts/hive-launcher.sh stop" || true)
```
