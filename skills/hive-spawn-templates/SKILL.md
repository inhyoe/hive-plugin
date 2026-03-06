---
name: hive-spawn-templates
description: /hive Phase 4-5에서 에이전트 스폰 시 사용하는 프로바이더별 프롬프트 템플릿.
user-invocable: false
---

# Hive Spawn Prompt Templates

> `/hive`가 에이전트를 스폰할 때 사용하는 프롬프트 템플릿.
> 변수(`{{VAR}}`)를 실제 값으로 치환하여 사용.

## Provider별 템플릿

각 프로바이더의 합의/구현 템플릿은 별도 파일로 분리되어 있습니다.
필요한 프로바이더의 템플릿만 Read로 로드하세요.

- Claude 에이전트 템플릿: [templates/claude-agent.md](templates/claude-agent.md)
- Codex 에이전트 템플릿: [templates/codex-agent.md](templates/codex-agent.md)
- Gemini 에이전트 템플릿: [templates/gemini-agent.md](templates/gemini-agent.md)

---

## 1. 변수 정의

### 정적 변수

| 변수 | 설명 | 소스 |
|------|------|------|
| `{{TEAM_NAME}}` | 팀 이름 (hive-{id}) | Phase 3 팀 구성 |
| `{{TEAM_ID}}` | 팀 ID (T1, T2, ...) | Phase 3 팀 구성 |
| `{{AGENT_NAME}}` | 에이전트 이름 | Phase 3 팀 구성 |
| `{{MODEL}}` | sonnet/opus/haiku | Phase 3 프로바이더 배치 |
| `{{MODULE_NAME}}` | 담당 모듈명 | Phase 2 영향 범위 맵 |
| `{{MODULE_FILES}}` | 담당 파일 목록 | Phase 2 영향 범위 맵 |
| `{{MODULE_SYMBOLS}}` | 핵심 심볼 목록 | Phase 2 Serena 결과 |
| `{{DEPENDENCIES}}` | 의존 모듈 목록 | Phase 2 의존성 맵 |
| `{{TASK_PROPOSAL}}` | TASK PROPOSAL 전문 | Phase 4 합의 시작 시 |
| `{{CONSENSUS}}` | CONSENSUS 문서 전문 | Phase 4 합의 완료 후 |
| `{{REQUIREMENTS}}` | 요구사항 요약 | Phase 1 결과 |
| `{{PRIOR_CONSENSUS}}` | 선행 팀 합의 (의존성) | Phase 4 크로스 의존성 |

### 동적 변수 (런타임 생성)

| 변수 | 설명 | 소스 |
|------|------|------|
| `{{ROUND_NUM}}` | 합의 라운드 번호 (1-5) | Phase 4 합의 루프 카운터 |
| `{{WAVE_NUM}}` | 실행 Wave 번호 (1-N) | Phase 5 Wave 실행 순서 |
| `{{FILE_PATH_N}}` | 수정 대상 파일 경로 (N=1,2,..., **최대 5**) | Phase 5 Codex 구현 시 리드가 동적 생성. 6개 이상이면 2회로 분할 전송 |
| `{{FILE_N_CONTENT}}` | 수정 대상 파일 내용 (N=1,2,..., **최대 5**) | Phase 5 Codex 구현 시 리드가 Read로 수집. 대형 파일은 관련 섹션만 발췌 |

---

## 2. 리드 행동 가이드

### 2-1. 합의 단계 리드 동작 (양방향 대화 필수)

```
1. TeamCreate(team_name="hive-{session_id}")

2. 독립 팀들에게 동시 TASK PROPOSAL 전송 (구현 지시 포함 금지):
   - Claude: Agent tool (합의 프롬프트 — templates/claude-agent.md §1 사용)
   - Codex: /ask codex (합의 프롬프트 — templates/codex-agent.md §1 사용)
   - Gemini: /ask gemini (합의 프롬프트 — templates/gemini-agent.md §1 사용)
   이 단계에서 구현을 함께 지시하면 안 됨

3. 응답 수신 + 리드 응답 (MANDATORY):
   Claude 에이전트:
     - SendMessage 자동 수신
     - 마커 파싱 (AGREE/COUNTER/CLARIFY)
     - 리드 → SendMessage(recipient=에이전트명, content=응답)
   CCB 에이전트:
     - pend로 수집
     - 마커 파싱
     - 리드 → /ask codex/gemini "응답 내용"

4. 응답별 리드 행동:
   AGREE:
     → CONSENSUS 문서 생성
     → SendMessage: "CONSENSUS가 확정되었습니다: {요약}"
   COUNTER:
     → 반론 검토 (수용/부분수용/거절)
     → SendMessage: 수정 PROPOSAL + 근거
     → 에이전트 재응답 대기
   CLARIFY:
     → 추가 정보 제공
     → SendMessage: 답변 + "검토 후 다시 응답해주세요"
     → 에이전트 재응답 대기

5. 합의 루프 반복 (max 5 rounds)
6. 전체 CONSENSUS 도달 → Phase 5로

금지: 에이전트 응답 무시하고 바로 Phase 5 진입
금지: 합의 프롬프트에 "문제 찾아서 수정해줘" 포함
```

### 2-2. 구현 단계 리드 동작

```
0. 사전 준비 (에이전트 스폰 전):
   - /ask gemini "리서치/체크리스트 요청" → 결과를 에이전트 프롬프트 "기준"으로 포함
   - /ask codex "아키텍처 사전 리뷰 요청" → 결과를 에이전트 지침에 반영

1. Wave별 실행 (순서 중요 — CCB async guardrail 준수):
   Step A: Claude 에이전트 먼저 스폰 — Agent tool (worktree isolation, 병렬)
   Step B: CCB 호출 — /ask codex (파일 내용 + 구체적 수정 지시 + round_id)
           → CCB_ASYNC_SUBMITTED 시 턴 종료
   Step C: 다음 턴에서 pend 수집 후, /ask gemini (테스트/문서 작업)
   필수: 대규모(6+) Codex 최소 2개, 중소(3-5) 최소 1개 모듈 직접 구현

2. 결과 수집:
   - Claude: SendMessage 수신
   - CCB: pend 수집 (CCB_DONE marker 확인)

3. 교차 검증:
   - Codex → Claude 수정 코드 리뷰
   - Claude → Codex 수정 코드 검증
   교차 리뷰가 아닌 교차 구현 + 교차 검증

4. Wave 완료 → 다음 Wave
5. 모든 Wave 완료 → 통합 커밋 → 셧다운
```
