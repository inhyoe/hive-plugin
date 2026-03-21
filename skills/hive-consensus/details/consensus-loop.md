# Consensus Loop Details (Sections 2-3)

## 2. 병렬 개별 합의 흐름

<hard_gate rule="PHASE4_TEAM_REGISTRY">
Phase 4 시작 시 반드시 팀 등록 + 마커 디렉토리를 생성한다:
  Bash("mkdir -p .hive-state/consensus && echo '{\"teams\":[\"T1\",\"T2\",...]}' > .hive-state/teams.json")
팀별 합의 도달 시 반드시 마커를 생성한다:
  Bash("echo 'type:CONSENSUS round:N provider:X' > .hive-state/consensus/${TEAM_ID}.marker")
모든 팀 합의 완료 시:
  Bash("echo 'all teams consensus' > .hive-state/phase4-complete.marker")
Phase 5 진입 시 validate-phase5-entry.sh가 이 마커들을 검증한다. 마커 없으면 진입 차단.
</hard_gate>

### 2-1. 합의 시작 (리드 -> 각 에이전트)

리드가 각 에이전트에게 **해당 팀의 태스크만** 동시 발송:

```
독립 팀 (blocked_by 없음):
  -> 모든 독립 팀에게 동시에 TASK PROPOSAL 전송
  -> 각자 병렬로 합의 진행

의존 팀 (blocked_by 있음):
  -> 선행 팀 CONSENSUS 완료 후에만 TASK PROPOSAL 전송
  -> 선행 CONSENSUS를 컨텍스트로 포함
```

### 2-2. TASK PROPOSAL 형식

```markdown
[TASK PROPOSAL — {팀 ID} — R{라운드}]
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
  리드 -> 에이전트X: [TASK PROPOSAL — TX — R1]
  에이전트X -> 리드: [AGREE/COUNTER/CLARIFY — TX]

IF AGREE:
  -> TX CONSENSUS 도달 -> CONSENSUS 문서 생성
  -> TX의 의존 팀이 있으면 해당 팀 합의 시작 트리거

IF COUNTER:
  리드가 반론 검토:
    -> 반론 수용 시: 수정된 TASK PROPOSAL 재전송
    -> 반론 거절 시: 거절 근거 명시 + 재전송
  에이전트X: 다시 AGREE/COUNTER/CLARIFY
  (max 5 rounds)

IF CLARIFY:
  리드가 추가 정보 제공
  에이전트X: 다시 AGREE/COUNTER/CLARIFY
```

### 3-2. 리드의 반론 응답

리드도 COUNTER에 대해 3가지로 응답 가능:
- **수용**: 에이전트 대안 채택 -> 수정 PROPOSAL
- **부분 수용**: 일부만 반영 -> 이유 명시
- **거절**: 원안 유지 -> 거절 근거 명시 (에이전트가 다시 판단)
