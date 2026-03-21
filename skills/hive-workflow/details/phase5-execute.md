# Phase 5: Execute & Monitor + Phase 6: Auto Review

## 5-1. 실행 순서 (Wave 기반)

```
Phase 3의 의존성 그래프 (topological sort) 기반:

  Wave 1: 독립 팀 (blocked_by 없음) → 동시 실행
  Wave 2: Wave 1 완료 대기 → 의존 팀 실행
  Wave 3: Wave 2 완료 대기 → 후속 팀 실행
```

## 5-2. 프로바이더별 실행

스폰 방법은 `hive-spawn-templates` 스킬 참조.

```
사전 준비 (에이전트 스폰 전):
  Gemini → 리서치/체크리스트 확보 (결과를 에이전트 프롬프트에 "기준"으로 직접 포함)
  Codex → 아키텍처 사전 리뷰 (결과를 에이전트 지침에 반영)
Claude 에이전트:
  Agent tool (subagent_type="general-purpose")
  → description에 팀 식별자 포함, isolation="worktree"
  → CONSENSUS 문서 + Serena 컨텍스트를 프롬프트에 포함
Codex 에이전트 (직접 구현 — MANDATORY):
  /ask codex "파일 내용 + 구체적 수정 지시"
  → 수정 대상 심볼의 전체 코드 + 참조 타입/인터페이스 시그니처 + 관련 import 포함
    (토큰 제한 고려 — 전체 파일 대신 관련 섹션 허용)
  → 파일명 + 수정할 함수/클래스 수준의 구체적 지시
  → 정적 분석 실행 요청 (프로젝트 린터/분석기 — Codex quick scan)
  → Async Guardrail 준수 (CCB_ASYNC_SUBMITTED → 턴 종료)
  → round_id/team_id 마커 포함 (예: [HIVE IMPLEMENTATION — T2 — W1])
Gemini 에이전트:
  /ask gemini "$PROMPT"
  → 동일 CCB 패턴
```

**실행 순서**: Claude Agent tool 호출을 먼저 실행 (병렬 스폰), 이후 CCB /ask 호출.
CCB async guardrail로 인해 /ask 후 턴 종료되므로, Claude 에이전트를 먼저 스폰해야 한다.
Codex는 사후 리뷰가 아닌 **병렬 구현자**로 참여한다.

**정적 분석 하이브리드**: Codex가 quick scan 실행, 리드가 모든 Wave 완료 후
프로젝트에 맞는 정적 분석기로 deep scan 실행 (최종 Quality Gate).

## 5-3. 결과 수집 및 양방향 피드백 (MANDATORY)

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

## 5-3a. 교차 에이전트 피드백 (Cross-Agent Feedback)

Wave N+1 에이전트가 Wave N 결과에서 문제 발견 시:

```
[CROSS FEEDBACK — {발견 팀}→{대상 팀} — {wave_id}]
리드 판단:
  A. 경미 → 리드 직접 수정
  B. 중대 → 대상 팀에 수정 요청 → 발견 팀 재검증
  C. 설계 결함 → Phase 4 해당 팀 재합의 (hive-consensus §10-1 적용)
```

교차 피드백은 **Wave 간에만** 발생. 리드는 수신 시 반드시 판단 + 조치 (무시 금지).
상세 마커 형식: hive-consensus §14 참조.

## 5-4. Failure Analysis (실패 분석 — Ralph Loop V2)

Phase 5 실패 시 **동일 프롬프트 재시도 금지**. 원인 분류 후 맞춤 재진입.

### 실패 원인 분류

| 분류 | 진단 기준 | 리드 대응 | 재진입 지점 |
|------|----------|----------|------------|
| 컨텍스트 부족 | 에이전트가 잘못된 파일/심볼 참조 | 파일 목록 재선정 | Phase 5 재시도 (CONSENSUS 유지) |
| 잘못된 방향 | 구현이 CONSENSUS와 불일치 | CONSENSUS 부분 무효화 + 재합의 | Phase 4 재진입 (해당 팀만) |
| 요구사항 오해 | 결과가 사용자 의도와 불일치 | 요구사항 재명확화 | Phase 1 재진입 (hive-consensus §10-1 전체 무효화) |
| 기술적 장벽 | API 미지원, 라이브러리 한계 | 대안 접근 탐색 + 팀 재구성 | Phase 3 재진입 (해당 팀 무효화) |
| CCB 타임아웃 | soft 3min 미응답 → hard 10min | pend 재확인 → LEAD DECISION | Phase 4 (hive-consensus §4) |

분석: 원인 분류 → 프롬프트 재작성(hive-spawn-templates §3) → 패턴 기록(auto-memory) → 재진입(hive-consensus §10-1 무효화 매트릭스).
동일 팀 최대 3회 재시도. 3회 실패 시 AskUserQuestion: 리드 직접 처리 / 팀 제외 / 전체 중단.

## 5-5. 셧다운 + 최종 출력

모든 Wave 완료 후: Claude 에이전트 SendMessage(shutdown), CCB idle_timeout 종료.
최종 출력: `| 팀 | 상태 | 변경 파일 | 합의 라운드 |` + 총 변경 요약.

---

## Phase 6: Auto Review (Final Quality Gate)

Phase 5 완료 후 독립 리뷰어를 통한 최종 품질 검증.
변경 파일을 `.hive-state/review/`에 수집하여 리뷰어가 직접 읽는 방식 — diff 줄 수 제한 없음.

### 6-1. 실행

```bash
RESULT=$(bun run $HIVE_PLUGIN_DIR/skills/auto-review-loop/scripts/phase6-orchestrator.ts --base {base_branch})
```

`entryValid: false` → Phase 6 진입 실패, 오류 보고 후 중단.
`error: "no changed files"` → Phase 6 skip.

### 6-2. 리뷰어 분기

RESULT의 `reviewer` 필드에 따라:

| reviewer | 실행 방식 |
|----------|----------|
| `codex` | `CCB_CALLER=claude ask codex "$PROMPT"` → Async Guardrail 준수 |
| `claude-team` | `Agent(description="Phase6-Review", prompt="$PROMPT", subagent_type="general-purpose", isolation="worktree")` |

Codex 미연결 시 skip이 아닌 **Claude Team 자동 생성**으로 대체.

### 6-3. 리뷰 루프

리뷰 결과 → `review-parser.ts` → `state-manager.ts` (최대 5회).

| 결과 | 마커 | 후속 |
|------|------|------|
| NO ISSUES FOUND | `[AUTO REVIEW PASSED — round:{N} reviewer:{codex\|claude-team}]` | §5-6 종료 진행 |
| 이슈 수정 완료 | `[AUTO REVIEW PASSED — round:{N} reviewer:{codex\|claude-team}]` | §5-6 종료 진행 |
| 동일 이슈 반복 | `[AUTO REVIEW ESCALATED — issues:{count}]` | 사용자에게 보고 |
| max iterations | `[AUTO REVIEW ESCALATED — issues:{count}]` | 사용자에게 보고 |

### 6-4. Skip 조건

사용자가 `--no-review` 옵션 지정 시에만 Phase 6 skip.

---

### 5-6. 대시보드 이벤트 발행 + 종료

```text
Phase 5+6 완료 후:
  1. emit session.summary (Phase 6 결과 포함) → 2. archive-session.sh → 3. hive-launcher.sh stop
  (모든 호출에 || true — 실패해도 워크플로우 미중단)
```
