---
name: hive-consensus
description: /hive Phase 4 합의 프로토콜. 각 에이전트가 담당 모듈에 대해 리드와 양방향 합의. CONSENSUS 도달 전 구현 착수 금지.
---

# Hive Consensus Protocol

> `/hive` Phase 4의 양방향 합의 엔진.
> 각 에이전트는 자기 담당 모듈에 대해서만 합의한다.
> 독립 팀은 병렬로, 의존 팀은 선행 합의 완료 후 진행.

---

## 1. 핵심 원칙

1. **모듈 범위 한정**: 각 에이전트는 자기 담당 모듈에 대해서만 합의
2. **합의 필수**: CONSENSUS 문서 작성 전 구현 착수 금지
3. **건설적 반론**: 기술적 문제 발견 시 COUNTER는 의무 (무조건 수락 금지)
4. **대등한 위치**: 리드와 에이전트는 기술적 논의에서 동등한 발언권
5. **효율적 토론**: 라운드 상한 5회 내에서 핵심 집중
6. **양방향 대화 필수**: 리드는 에이전트 응답에 반드시 응답 — Claude Agent는 SendMessage, CCB는 /ask (일방적 결과 수집 금지)
7. **Phase 분리 필수**: 합의(Phase 4)와 구현(Phase 5)은 별도 프롬프트/스폰 (합치기 금지)

---

## 2. 병렬 개별 합의 흐름

### 2-1. 합의 시작 (리드 → 각 에이전트)

리드가 각 에이전트에게 **해당 팀의 태스크만** 동시 발송:

```
독립 팀 (blocked_by 없음):
  → 모든 독립 팀에게 동시에 TASK PROPOSAL 전송
  → 각자 병렬로 합의 진행

의존 팀 (blocked_by 있음):
  → 선행 팀 CONSENSUS 완료 후에만 TASK PROPOSAL 전송
  → 선행 CONSENSUS를 컨텍스트로 포함
```

### 2-2. TASK PROPOSAL 형식

```markdown
[TASK PROPOSAL — {팀 ID}]
- 목표: {이 팀이 달성해야 할 것}
- 담당 모듈: {모듈명 + 파일 목록}
- 제안 접근방식: {리드가 생각하는 구현 방법}
- 컨텍스트:
  - Serena 분석 결과: {관련 심볼, 의존성}
  - 선행 합의: {있으면 — 선행 팀의 CONSENSUS 요약}
- 제약사항: {반드시 지켜야 할 것}
- 예상 산출물: {기대하는 결과물}
- 질문: 이 접근방식에 동의하나요? 더 나은 방법이 있으면 제안해주세요.
```

### 2-3. 에이전트 응답 (3가지)

#### A) 동의 (AGREE)
```markdown
[AGREE — {팀 ID}]
- 판단: 제안된 접근방식에 동의합니다
- 이유: {왜 적절한지}
- 추가 고려사항: {있다면}
- 구현 계획: {어떻게 진행할지 간략히}
```

#### B) 반론 (COUNTER)
```markdown
[COUNTER — {팀 ID}]
- 우려사항: {제안의 구체적 문제점}
- 대안 제안: {더 나은 방법}
- 근거: {왜 대안이 나은지 — 성능, 유지보수, 안정성}
- 트레이드오프: {대안의 단점도 명시}
- 질문: {리드에게 확인하고 싶은 점}
```

#### C) 명확화 요청 (CLARIFY)
```markdown
[CLARIFY — {팀 ID}]
- 현재 이해: {지금까지 이해한 내용}
- 불명확한 점: {구체적 질문 — 한 번에 하나}
- 선택지:
  A) {가능한 해석 1}
  B) {가능한 해석 2}
- 추천: {어느 쪽이 맞을 것 같은지와 이유}
```

---

## 3. 합의 루프

### 3-1. 에이전트별 독립 루프 (병렬)

```
ROUND 1:
  리드 → 에이전트X: [TASK PROPOSAL — TX]
  에이전트X → 리드: [AGREE/COUNTER/CLARIFY — TX]

IF AGREE:
  → TX CONSENSUS 도달 ✅ → CONSENSUS 문서 생성
  → TX의 의존 팀이 있으면 해당 팀 합의 시작 트리거

IF COUNTER:
  리드가 반론 검토:
    → 반론 수용 시: 수정된 TASK PROPOSAL 재전송
    → 반론 거절 시: 거절 근거 명시 + 재전송
  에이전트X: 다시 AGREE/COUNTER/CLARIFY
  (max 5 rounds)

IF CLARIFY:
  리드가 추가 정보 제공
  에이전트X: 다시 AGREE/COUNTER/CLARIFY
```

### 3-2. 리드의 반론 응답

리드도 COUNTER에 대해 3가지로 응답 가능:
- **수용**: 에이전트 대안 채택 → 수정 PROPOSAL
- **부분 수용**: 일부만 반영 → 이유 명시
- **거절**: 원안 유지 → 거절 근거 명시 (에이전트가 다시 판단)

---

## 4. Provider별 합의 통신

| Provider | 전송 방법 | 수신 방법 |
|----------|----------|----------|
| Claude (Agent) | SendMessage(recipient, content) | 자동 수신 (idle notification) |
| Codex (CCB) | `Bash("CCB_CALLER=claude ask codex \"[TASK PROPOSAL] ...\"")` | `pend codex` |
| Gemini (CCB) | `Bash("CCB_CALLER=claude ask gemini \"[TASK PROPOSAL] ...\"")` | `pend gemini` |

### CCB 프로바이더 합의 시 주의사항

- 마커 기반 파싱: `[AGREE]`, `[COUNTER]`, `[CLARIFY]` 마커로 응답 유형 식별
- `CCB_DONE` = 응답 완료
- 마커 없이 응답이 오면 → 전체 내용을 파싱하여 의도 추론
- CCB Async Guardrail: `CCB_ASYNC_SUBMITTED` → 턴 종료, pend로 나중에 수집
- **CCB 요청에 round_id/team_id 마커 필수**: 지연된 비동기 응답 오귀속 방지
  예: `[TASK PROPOSAL — T2 — R1]` (팀 T2, 라운드 1)

### CCB 라운드 타임아웃 정책

```
soft timeout: 3분 — pend 1회 확인, 미응답 시 /ask로 재요청
hard timeout: 10분 — 라운드 종료, LEAD DECISION으로 에스컬레이션
pend 확인 간격: 최소 1분 (즉시 연속 확인 금지)
```

---

## 5. 크로스 의존성 처리

```
T3 blocked_by T2:

  1. T2 합의 진행 (독립적)
  2. T2 CONSENSUS 도달 → CONSENSUS 문서 생성
  3. T3 TASK PROPOSAL 전송 시 T2 CONSENSUS를 컨텍스트에 포함:

  [TASK PROPOSAL — T3]
  - ...
  - 컨텍스트:
    - 선행 합의 (T2):
      합의된 접근방식: {...}
      구현 범위: {...}
      인터페이스: {...}
  - ...
```

---

## 6. CONSENSUS 문서 (팀별)

합의 도달 시 생성:

```markdown
## CONSENSUS: {팀 ID}
- **합의된 접근방식**: {최종 결정된 방법}
- **변경 사항**: {원래 제안에서 바뀐 점}
- **합의 근거**: {왜 이 방법으로 결정했는지}
- **구현 범위**: {정확히 무엇을 만들 것인지}
- **테스트 기준**: {어떻게 검증할 것인지}
- **라운드**: {소요 라운드 수}
- **합의 시각**: {timestamp}
```

---

## 7. 합의 완료 조건

### 성공 (Phase 5 진입)
모든 팀이 개별 CONSENSUS 도달 → Phase 5 진입 허용

### 실패 (5라운드 초과)
```
⛔ AskUserQuestion:
  "{팀 ID} 팀이 5라운드 내 합의에 실패했습니다."
  Options:
    A. "리드 판단으로 진행 — 근거 명시 후 LEAD DECISION"
    B. "요구사항 재조정 — Phase 1로 되돌아가기"
    C. "해당 팀 제외 — 나머지 팀만 진행"
```

### LEAD DECISION (최종 결정권)

```markdown
[LEAD DECISION — {팀 ID}]
- 결정된 접근방식: {리드가 선택한 방법}
- 근거: {선택 이유}
- 에이전트 의견 반영 여부: {반영한 점 / 반영하지 않은 점과 이유}
- 구현 범위: {정확히 무엇을 만들 것인지}
- 토론 요약: {각 라운드의 핵심 논점}
```

---

## 8. 에이전트의 COUNTER 의무

에이전트는 다음 상황에서 **반드시** COUNTER를 보내야 합니다:

1. **기술적 오류**: 제안에 명백한 버그/결함
2. **성능 문제**: 더 효율적인 대안이 명확
3. **보안 취약점**: 제안이 보안 위험 초래
4. **유지보수 우려**: 장기적 기술 부채 생성
5. **요구사항 불일치**: 제안이 Requirements Summary와 불일치

**무조건 AGREE 금지**: 기술적 문제를 인지하면서 AGREE하면 프로토콜 위반.

---

## 9. 리드의 응답 의무 (MANDATORY)

리드는 에이전트로부터 메시지를 받으면 **반드시** 응답해야 합니다.

### 9-1. Claude 에이전트 응답 시

```
에이전트 → SendMessage([AGREE/COUNTER/CLARIFY])
  ↓
리드 → SendMessage(recipient=에이전트명, content=응답)
  ↓
  AGREE → "합의 확인. CONSENSUS 문서 생성합니다." + CONSENSUS 생성
  COUNTER → 수용/부분수용/거절 + 근거 + 수정 PROPOSAL (필요 시)
  CLARIFY → 추가 정보 제공 + "검토 후 다시 응답해주세요"
```

### 9-2. CCB 에이전트 (Codex/Gemini) 응답 시

```
pend로 응답 수집 → 마커 파싱 (round_id/team_id 확인)
  ↓
  AGREE → CONSENSUS 문서 생성 (확인 메시지 불필요 — CCB는 stateless)
  COUNTER → /ask codex "[FOLLOW-UP — TX — RN] 재제안: ..."
  CLARIFY → /ask codex "[FOLLOW-UP — TX — RN] 추가 정보: ..."
```

**CCB는 stateless**: AGREE 시 별도 "확인" 메시지 불필요 (Claude Agent과 다름).

### 9-3. 구현 중 에이전트 질문/보고 시

```
에이전트 → SendMessage("중간 보고" 또는 "[CLARIFY]")
  ↓
리드 → SendMessage(recipient=에이전트명, content=피드백)
  ↓
  문제 없음 → "진행하세요"
  방향 조정 → 구체적 수정 지시
  CONSENSUS 위반 → "CONSENSUS에 따르면 X입니다. Y 대신 X로 해주세요"
```

---

## 10. 금지 패턴 (2026-03 교훈)

### ❌ 일방적 소통 (이번 세션의 실패)

```
# 이렇게 하면 안 됨
1. 10개 에이전트를 구현 프롬프트로 한꺼번에 스폰
2. 에이전트가 다 끝나면 결과만 수집
3. SendMessage 응답 없이 셧다운
→ Phase 4 합의 루프가 완전히 스킵됨
→ 양방향 대화 0건
```

### ❌ 합의+구현 합치기

```
# 이렇게 하면 안 됨
Agent(prompt="이 모듈을 분석하고 문제를 찾아서 수정해줘")
→ TASK PROPOSAL + 구현이 하나의 프롬프트에 합쳐짐
→ 에이전트가 COUNTER할 기회 없이 바로 구현
```

### ✅ 올바른 패턴

```
# Phase 4: 합의 (별도 스폰)
Agent(prompt="[TASK PROPOSAL] 이 모듈에 대해 이런 접근으로 수정하려 합니다. 동의하나요?")
  ↓
에이전트: [COUNTER] "X 방식보다 Y가 더 효율적입니다"
  ↓
리드 → SendMessage: "Y 방식 수용합니다. Z 부분은 원안 유지합니다."
  ↓
에이전트: [AGREE] "수정안에 동의합니다"
  ↓
리드 → CONSENSUS 문서 생성

# Phase 5: 구현 (SendMessage로 전달)
리드 → SendMessage: "CONSENSUS가 확정되었습니다. 아래 내용대로 구현해주세요: ..."
  ↓
에이전트: 구현 중간 보고
  ↓
리드 → SendMessage: 피드백
  ↓
에이전트: 구현 완료 보고
  ↓
리드 → CONSENSUS 대비 검증 → 셧다운
```

### 대화 최소 횟수 (프로바이더별)

| Phase | Claude Agent (SendMessage) | CCB (Codex/Gemini — /ask) |
|-------|---------------------------|--------------------------|
| Phase 4 | 최소 2회 (PROPOSAL + CONSENSUS 확인) | 최소 1회 (PROPOSAL). COUNTER/CLARIFY 시 follow-up /ask 필수 |
| Phase 5 | 최소 1회 (구현 지시 또는 결과 피드백) | 최소 1회 (구현 지시) |

---

## 11. Event-Driven Progress Reporting

합의/구현 중 사용자에게 진행 상황을 보고합니다.
주기적 heartbeat 대신 **상태 변경 시에만** 1줄 업데이트:

```
[HIVE PROGRESS]
✔ T1-Auth: CONSENSUS reached (1 round)
✔ T2-API: CONSENSUS reached (2 rounds)
⏳ T3-UI: COUNTER received, negotiating... [2/3 completed]
```

보고 트리거:
- 에이전트가 AGREE → 해당 팀 CONSENSUS 도달 보고
- 에이전트가 COUNTER → 협상 진행 중 표시
- Wave 완료 → 전체 요약 + 다음 Wave 예고
- 5라운드 데드락 → AskUserQuestion 에스컬레이션

원칙: **Silent-by-Default** — 리드는 기술적 협상을 자율적으로 처리하고,
사용자에게는 상태 변경과 결과만 보고 (Orchestration Fatigue 방지).
