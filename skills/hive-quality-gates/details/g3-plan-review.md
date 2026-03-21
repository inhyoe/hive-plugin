# G3: PLAN REVIEW Gate — Procedural Details

## 상호 토론 프로토콜

일방 리뷰가 아닌 Designer(Claude) ↔ Reviewer(Codex) 다중 라운드 debate.

**Round 1**: Designer → 계획 제출, Reviewer → 피드백 + 스코어
**Round 2**: Designer → 반론(수용 또는 근거 제시), Reviewer → 재평가
**Round 3**: 합의 도출

마커 프로토콜:

```
[PLAN DEBATE — R{n} — Designer→Reviewer]
--- PLAN START ---
{계획 + SPEC}
--- PLAN END ---

[PLAN DEBATE — R{n} — Reviewer→Designer]
--- FEEDBACK START ---
scores: {5차원 점수}
issues: [...]
questions: [...]
--- FEEDBACK END ---

[PLAN DEBATE — R{n} — Designer→Reviewer]
--- RESPONSE START ---
accepted: [...]
contested: [{issue, position, rationale}]
--- RESPONSE END ---

[PLAN DEBATE — R{n} — CONSENSUS]
--- AGREEMENT START ---
final_scores: {...}
overall: {score}
pass: true/false
agreed_changes: [...]
--- AGREEMENT END ---
```

## Rubric (5차원)

| 차원 | 가중 | 기준 |
|------|------|------|
| SPEC 정합성 | 30% | 계획이 명세를 완전히 커버 |
| 분해 품질 | 25% | 의존성 명확, 순환 없음 |
| 불변식 커버리지 | 20% | 불변식이 테스트 계획에 반영 |
| 리스크 식별 | 15% | 경계조건/실패 시나리오 고려 |
| 실행 가능성 | 10% | 에이전트 역할이 현실적 |

통과: weighted score >= 7.0 AND 모든 차원 > 3.0

## 합의 불가 시: Gemini 중재

```
[PLAN DEBATE — TIEBREAK — Mediator(Gemini)]
--- MEDIATION START ---
disputed_items: [{issue, designer_position, reviewer_position}]
mediator_ruling: [{issue, ruling, rationale}]
--- MEDIATION END ---
```

3자 다수결: 2/3 → 채택. 전원 불일치 → `[PLAN ESCALATED]` → 유저 결정.

## SPEC 해시 검증

Plan Review 시점에서 G2 해시 재검증:

```
hash(현재SPEC) ≠ hash(G2승인SPEC) → [SPEC TAMPERED] → Phase 0 회귀
```
