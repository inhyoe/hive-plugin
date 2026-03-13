---
name: hive-quality-gates
description: Defines G1-G3 quality gates, marker protocol (G1-G7), hash chain verification, and debate-based plan review for /hive workflow. G4-G7 gate details are in hive-tdd-pipeline. Loaded when /hive processes phase transitions.
user-invocable: false
---

# Hive Quality Gates

> G1-G3 게이트 정의 + 마커 프로토콜(G1-G7) + 해시 검증.
> G4-G7 게이트는 `hive-tdd-pipeline` 참조.
> 근거: AgentSpec (ICSE 2026), Meta ACH (FSE 2025), Du et al. (2023).

---

## 1. 마커 체인 (불변 순서)

각 게이트 통과 시 마커 발행. 다음 게이트는 이전 마커 존재를 검증한 뒤에만 진입.

| 순서 | 마커 | 페이로드 |
|------|------|---------|
| 1 | `[CLARIFY PASSED]` | `scope:{파일목록} criteria:{조건} constraints:{제약}` |
| 2 | `[SPEC APPROVED]` | `hash:{sha256}` |
| 3 | `[PLAN DEBATE — CONSENSUS]` | `overall:{score}` |
| 4 | `[TDD RED PASSED]` | `test_count:{N} fail_count:{N}` |
| 5 | `[IMPLEMENT GREEN PASSED]` | `pass:{N}/{N} iterations:{M}` |
| 6 | `[CROSS-VERIFY PASSED]` | `mutation:{%} pbt:{pass/fail} review:{verdict}` |
| 7 | `[E2E VALIDATE PASSED]` | `type:{A|B|C} result:{상세}` |

마커 파일 저장 (컨텍스트 비대화 방지):

```
.hive-state/
├── g1-clarify.marker
├── g2-spec.marker
├── g3-plan-review.marker
├── g4-tdd-red.marker
├── g5-implement.marker
├── g6-cross-verify.marker
└── g7-e2e-validate.marker
```

대화에는 `[G1 ✓] [G2 ✓] ...` 요약만 표시.

---

## 2. G1: CLARIFY Gate

<hard_gate rule="G1_BEFORE_G2">
Do NOT proceed to G2 (SPEC) unless the conversation contains
[CLARIFY PASSED]. If absent, execute G1 first. Non-negotiable.
</hard_gate>

유저 요청 수신 시 3가지 명확성 기준 검사:

1. **범위(Scope)**: 어떤 파일/모듈이 영향받는가?
2. **성공기준(Criteria)**: 완료 조건이 측정 가능한가?
3. **제약(Constraints)**: 성능/호환성/의존성 제한?

3개 모두 충족 → `[CLARIFY PASSED — scope:{...} criteria:{...} constraints:{...}]`
불명확 → 다지선다 질문 (1회 1질문, max 3라운드)
3라운드 후 불명확 → `[CLARIFY ESCALATED]` + 유저 직접 명세 요청

질문 규칙 (ICLR 2025):
- 반드시 다지선다 (2~4개 선택지)
- 1회 1질문
- 불명확한 축 하나만 타겟팅

---

## 3. G2: SPEC Gate

<hard_gate rule="G2_BEFORE_PHASE0">
Do NOT proceed to Phase 0 (Prompt Engineering) unless the conversation contains
[SPEC APPROVED — hash:{sha256}]. If absent, write SPEC first. Non-negotiable.
</hard_gate>

자연어 명세 6개 섹션:

```
## 기능 명세
- 목적: {왜 이 변경이 필요한가}
- 입력: {어떤 데이터/이벤트가 트리거하는가}
- 출력: {기대되는 결과물/상태 변화}
- 불변식: {항상 참이어야 하는 조건들} — 최소 2개 (Wlaschin 7패턴 참조)
- 경계조건: {엣지케이스 목록} — 최소 3개
- 비기능: {성능/보안/호환성 요구사항}
```

통과: 6섹션 비어있지 않음 + 불변식 2+ + 경계조건 3+
마커: `[SPEC APPROVED — hash:{sha256}]`

해시 계산 (LLM은 SHA256 계산 불가 — 반드시 Bash 도구 사용):

```bash
sha256sum <<< '{SPEC내용}' | cut -d' ' -f1
```

불변식 → G4에서 Property-Based Test로 직접 변환.
근거: PGS (FSE 2025) — 명세 기반이면 자기기만 사이클 차단.

---

## 4. G3: PLAN REVIEW Gate (상호 토론)

<hard_gate rule="G3_BEFORE_EXECUTE">
Do NOT proceed to Phase 4 (Consensus) or Phase 5 (Execute) unless the conversation
contains [PLAN DEBATE — CONSENSUS — overall:{score}] with score >= 7.0.
Non-negotiable.
</hard_gate>

### 상호 토론 프로토콜

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

Rubric (5차원):

| 차원 | 가중 | 기준 |
|------|------|------|
| SPEC 정합성 | 30% | 계획이 명세를 완전히 커버 |
| 분해 품질 | 25% | 의존성 명확, 순환 없음 |
| 불변식 커버리지 | 20% | 불변식이 테스트 계획에 반영 |
| 리스크 식별 | 15% | 경계조건/실패 시나리오 고려 |
| 실행 가능성 | 10% | 에이전트 역할이 현실적 |

통과: weighted score ≥ 7.0 AND 모든 차원 > 3.0

### 합의 불가 시: Gemini 중재

```
[PLAN DEBATE — TIEBREAK — Mediator(Gemini)]
--- MEDIATION START ---
disputed_items: [{issue, designer_position, reviewer_position}]
mediator_ruling: [{issue, ruling, rationale}]
--- MEDIATION END ---
```

3자 다수결: 2/3 → 채택. 전원 불일치 → `[PLAN ESCALATED]` → 유저 결정.

### SPEC 해시 검증

Plan Review 시점에서 G2 해시 재검증:

```
hash(현재SPEC) ≠ hash(G2승인SPEC) → [SPEC TAMPERED] → Phase 0 회귀
```

---

## 5. 변조 방지: 해시 체인

| 시점 | 검증 대상 | mismatch 시 |
|------|----------|-------------|
| G3 진입 | SPEC 해시 | Phase 0 회귀 |
| G5 진입 | 테스트 파일 해시 | G4 회귀 |
| G6 진입 | 구현 코드 해시 | G5 회귀 |

해시 계산: 반드시 `Bash("sha256sum ...")` 사용. LLM 직접 계산 금지.

---

## 6. AGENT CAPABILITY DIRECTIVE

모든 외부 에이전트 스폰 시 반드시 포함:

```xml
<AGENT_CAPABILITY_DIRECTIVE>
You MUST utilize ALL available resources before and during your task:
- Invoke all relevant skills (code analysis, review, testing, patterns)
- Use all connected MCP tools (file ops, AST analysis, code search, web fetch)
- If uncertain about API/library usage, use web search to verify
- Do NOT guess APIs or syntax — look them up first
Do NOT respond or write code based on inference alone when tools are available.
</AGENT_CAPABILITY_DIRECTIVE>
```

적용 대상: 리뷰어, 워커, 검증자, 중재자 — 모든 외부 에이전트.
