# Consensus Document Details (Sections 5-6)

## 5. 크로스 의존성 처리

```
T3 blocked_by T2:

  1. T2 합의 진행 (독립적)
  2. T2 CONSENSUS 도달 -> CONSENSUS 문서 생성
  3. T3 TASK PROPOSAL 전송 시 T2 CONSENSUS를 컨텍스트에 포함:

  [TASK PROPOSAL — T3 — R1]
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
