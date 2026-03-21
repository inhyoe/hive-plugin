# Phase 0: Prompt Engineering & Resource Discovery

사용자의 원본 요청($ARGUMENTS)을 분석하여 프롬프트를 구체화하고, 작업에 필요한 리소스를 자동 식별합니다.

## 0-1. 프롬프트 엔지니어링 (MCP)

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

## 0-2. 리소스 자동 탐색

```
Step D: SKILL 매칭
  SessionStart에서 주입된 리소스 목록과 CLAUDE.md Skill Auto-Trigger 테이블을 기반으로:
  1. engineered_prompt.keywords를 각 트리거 시그널과 대조
  2. 매칭되는 스킬 목록 생성
  예시 (사용자 환경에 설치된 스킬에 따라 다름):
    키워드 "UI + 화면" → UI 관련 스킬 매칭
    키워드 "새 기능" → scaffold/패턴 스킬 매칭
    키워드 "버그 수정" → debugging/error-handling 스킬 매칭
Step E: MCP search_skills로 추가 스킬 탐색
  mcp__plugin_prompts_chat_prompts_chat__search_skills(query=핵심 키워드, limit=5)
  → prompts.chat 레지스트리에서 설치 가능한 외부 스킬 확인
  → 이미 로컬에 있는 스킬과 중복 제거
Step F: PLUGIN/AGENT 매칭
  engineered_prompt.keywords 기반으로:
  - 사용 가능한 서브에이전트 중 적합한 것 식별
  - superpowers 스킬 중 프로세스 스킬 식별 (brainstorming, TDD, debugging 등)
```

## 0-3. 리소스 매칭 결과 (in-memory)

```
resource_map = {
  "skills_local": [매칭된 로컬 스킬 목록],
  "skills_external": [search_skills 결과 중 유용한 것],
  "process_skills": [매칭된 프로세스 스킬 목록],
  "subagents": [매칭된 서브에이전트 목록],
  "mcp_tools": ["improve_prompt", "search_skills", ...],
  "execution_recommendation": "SUB_AGENT" | "CLAUDE_TEAM" | "SOLO"
}
실행 방식 판단 기준:
  - 모듈 1-2개 + 스킬 매칭 충분 → SOLO (Claude 단독 + 스킬)
  - 모듈 3-5개 + 독립 작업 가능 → SUB_AGENT (병렬 서브에이전트)
  - 모듈 6개+ 또는 크로스커팅 → CLAUDE_TEAM (Phase 3-5 풀 오케스트레이션)
```

## 0-4. 사용자 확인

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

## 0-5. Phase 0 → Phase 1 전달

```
Phase 0 완료 시 Phase 1에 전달하는 데이터:
  - engineered_prompt (개선된 프롬프트 — Phase 1의 $ARGUMENTS를 대체)
  - resource_map (Phase 3 팀 구성 시 참조)
  - execution_recommendation (Phase 3 팀 분할 방식 사전 결정)
Phase 1은 engineered_prompt를 기반으로 5차원 평가를 수행한다.
resource_map의 process_skills는 Phase 5 실행 시 에이전트 프롬프트에 포함한다.
```
