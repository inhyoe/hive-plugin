# Edge Cases & Advanced Protocols (Sections 10, 12-14)

## 10. Re-entry / Invalidation (Phase 5 실패 복귀)

Phase 5 실패 후 이전 Phase로 복귀할 때, 기존 CONSENSUS의 유효성을 결정하는 규칙:

### 10-1. CONSENSUS 무효화 매트릭스

| 복귀 대상 | 무효화 범위 | 이유 |
|-----------|------------|------|
| Phase 1 (요구사항 재조정) | **전체 CONSENSUS 무효화** | 요구사항이 변경되면 모든 합의 전제가 바뀜 |
| Phase 3 (팀 재구성) | **재구성된 팀의 CONSENSUS만 무효화** | 변경되지 않은 팀의 합의는 유지 |
| Phase 4 (특정 팀 재합의) | **해당 팀 CONSENSUS만 무효화** | 다른 팀에 영향 없음 |
| Phase 5 재시도 (동일 CONSENSUS) | **무효화 없음** | 합의 내용은 변경 없이 재실행 |

### 10-2. blocked_by 의존성 전파

```
T3 blocked_by T2:
  T2 CONSENSUS 무효화 시 -> T3 CONSENSUS도 자동 무효화
  T2 LEAD DECISION 무효화 시 -> T3도 자동 무효화 (동일 규칙)
  T2만 재합의 후 -> T3에게 수정된 T2 CONSENSUS를 컨텍스트로 재전송
```

### 10-3. LEAD DECISION 전파

LEAD DECISION으로 종료된 팀의 의존 팀(downstream):
- LEAD DECISION 내용을 CONSENSUS와 동등하게 컨텍스트로 전달
- 의존 팀은 LEAD DECISION의 한계를 인지하고 COUNTER할 수 있음

---

## 12. 에이전트 상태와 합의 이벤트 동기화 (MANDATORY)

COUNTER 또는 CLARIFY 수신 시, 에이전트는 아직 토론 중이다.
`agent.status`를 `done`으로 설정하면 안 되며, `working`을 유지해야 한다.

### 이벤트 발행 순서

```
COUNTER/CLARIFY 수신 시:
  1. emit consensus.update COUNTER/CLARIFY  <- 반드시 먼저
  2. emit agent.status working "R{N} 토론 중" <- 반드시 나중

AGREE 수신 + 합의 완료 시:
  1. emit consensus.update AGREE             <- 반드시 먼저
  2. emit agent.status done                  <- 합의 후에만 done 허용
```

### 금지 패턴

```
# 이렇게 하면 안 됨
emit agent.status done        <- done으로 표시됨
emit consensus.update COUNTER <- 실제로는 아직 토론 중
-> 대시보드에서 에이전트가 완료된 것처럼 표시되는 버그 유발
```

---

## 13. Event-Driven Progress Reporting

합의/구현 중 사용자에게 진행 상황을 보고합니다.
주기적 heartbeat 대신 **상태 변경 시에만** 1줄 업데이트:

```
[HIVE PROGRESS]
T1-Auth: CONSENSUS reached (1 round)
T2-API: CONSENSUS reached (2 rounds)
T3-UI: COUNTER received, negotiating... [2/3 completed]
```

보고 트리거:
- 에이전트가 AGREE -> 해당 팀 CONSENSUS 도달 보고
- 에이전트가 COUNTER -> 협상 진행 중 표시
- Wave 완료 -> 전체 요약 + 다음 Wave 예고
- 5라운드 데드락 -> AskUserQuestion 에스컬레이션

원칙: **Silent-by-Default** -- 리드는 기술적 협상을 자율적으로 처리하고,
사용자에게는 상태 변경과 결과만 보고 (Orchestration Fatigue 방지).

---

## 14. CROSS FEEDBACK 프로토콜 (Phase 5 교차 피드백)

Phase 5 실행 중 후속 Wave 에이전트가 선행 Wave 결과의 문제를 발견한 경우.

### 14-1. 마커 형식

```markdown
[CROSS FEEDBACK — {발견 팀 ID}->{대상 팀 ID} — {wave_id}]
- 문제 유형: bug | performance | security | consensus_violation
- 상세: {구체적 설명}
- 영향 파일: {파일 목록}
- 재현: {테스트 코드 또는 재현 단계}
```

### 14-2. 리드 의무

| 문제 심각도 | 리드 대응 |
|------------|----------|
| 경미 (스타일, 네이밍) | 리드 직접 수정 또는 무시 |
| 중대 (로직 버그, 테스트 실패) | 대상 팀에 수정 요청 -> 발견 팀이 재검증 |
| 치명 (설계 결함, 보안) | Phase 4 해당 팀 재합의 (10-1 무효화 적용) |

수정 요청 시 correlation key: `[FIX REQUEST — {대상 팀 ID} — {wave_id} — ref:{CROSS FEEDBACK message_id}]`
