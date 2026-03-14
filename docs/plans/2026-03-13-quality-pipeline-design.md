# Hive Quality Pipeline v2 — Design Document

**Date**: 2026-03-13
**Status**: Approved
**Target**: Hive Plugin v1.6.0 → v2.0.0

---

## 1. Problem Statement

현재 Hive 워크플로우의 Phase 5 (Execute)는 에이전트가 코드를 작성하고 "완료"를 선언하면 끝난다. 이로 인해:

1. **할루시네이션** — 에이전트가 존재하지 않는 API/문법을 사용
2. **자기기만 사이클** — 같은 에이전트가 테스트와 구현을 모두 작성하여 공통 맹점 발생
3. **테스트 통과 ≠ 실제 동작** — 코드 커버리지만 높고 실제 결함 미탐지
4. **모호한 요구사항** — 불명확한 요청으로 잘못된 방향 구현
5. **품질 불일치** — 사용자마다 다른 수준의 검증 적용

## 2. Design Goals

- 모든 플러그인 설치 유저에게 **동일한 품질 게이트를 하드 강제**
- **연구 기반 설계** — 논문과 프로덕션 사례로 검증된 패턴만 적용
- 기존 Hive Phase 0~5 구조를 **대체하지 않고 강화**
- **멀티에이전트 교차 검증** (Claude/Codex/Gemini)으로 편향 탈상관

## 3. Research Foundation

| 패턴 | 출처 | 핵심 결과 |
|------|------|----------|
| Multi-Agent Debate | Du et al. (2023), arXiv:2305.14325 | 멀티에이전트 토론이 단일 패스 대비 사실성/추론 정확도 유의미 개선 |
| TGen TDD Framework | Mathews et al. (2024), arXiv:2402.13521 | TDD 적용 시 solve rate 80.5% → 92.5% (+12%), remediation loop로 95.3% |
| Mutation Testing at Google | Petrovic et al. (2021), ICSE | 15M mutants 연구, mutation testing이 실제 버그 탐지와 강한 상관관계 |
| Meta ACH | FSE 2025 Industry Track | Mutation 기반 테스트가 coverage 기반 대비 6x 결함 탐지 |
| CodeDelegator | arXiv:2601.14914 | 에이전트 격리(정보 장벽) 시 상관 실패 감소 |
| MoA Mixture-of-Agents | Wang et al. (2024), arXiv:2406.04692 | 이종 모델 레이어드 아키텍처 65.1% win rate (GPT-4o 단일 57.5%) |
| PGS Property-Generated Solver | FSE 2025, arXiv:2506.18315 | PBT+EBT 결합 시 81.25% 버그 탐지 (개별 68.75%) |
| AgentSpec | ICSE 2026, arXiv:2503.18666 | 런타임 제약 강제 90%+ 차단률, ms 수준 오버헤드 |
| Constitutional AI | Bai et al. (2022), arXiv:2212.08073 | 자기비판+수정으로 Pareto 개선 |
| CollabEval | Amazon (2025) | 독립 평가 → 다중 라운드 토론 → 최종 판정 3단계 최적 |
| Testing Trophy | Kent C. Dodds | 통합 테스트 중심 투자가 단위 테스트만보다 실질적 신뢰도 높음 |
| Knight Capital Postmortem | 2012 | $440M 손실 — 죽은 코드 + 수동 배포 + 회귀 테스트 부재 |

## 4. Architecture Overview

### 4.1 State Machine

```
Phase 0 ─── [G1: CLARIFY] ──→ [G2: SPEC] ──→ Phase 1~3
Phase 4 ─── [G3: PLAN REVIEW (상호 토론)] ──→ Phase 5
Phase 5 ─── [G4: TDD RED] → [G5: IMPLEMENT GREEN] → [G6: CROSS-VERIFY] → [G7: E2E VALIDATE] → ✅
```

### 4.2 Seven Gates Summary

| Gate | 이름 | 통과 조건 | 실패 시 | Max 재시도 |
|------|------|----------|---------|-----------|
| G1 | CLARIFY | scope+criteria+constraints 명확 | 다지선다 질문 | 3 |
| G2 | SPEC | 6섹션 + 불변식 2+ + 경계조건 3+ | 명세 재작성 | 3 |
| G3 | PLAN REVIEW | 상호 토론 후 score ≥ 7.0, 모든 차원 > 3.0 | 수정 후 재토론 | 3 |
| G4 | TDD RED | 테스트 존재 + 전부 FAIL | 테스트 수정 | — |
| G5 | IMPLEMENT GREEN | 모든 테스트 PASS + regression 없음 | 구현 수정 | 5 (3연속 동일 실패 시 중단) |
| G6 | CROSS-VERIFY | mutation ≥ 60% + PBT pass + review ≠ REJECT | 테스트/구현 보강 | 3 |
| G7 | E2E VALIDATE | 실제 실행 성공 | 구현 수정 | 3 |

모든 게이트: max 재시도 초과 → 유저 에스컬레이션

### 4.3 Agent Isolation (CodeDelegator 기반)

```
Agent A (Claude)         Agent B (Codex)         Agent C (Gemini)
- 명세 작성              - 구현                  - 검증
- 테스트 작성            - 리팩토링              - PBT 생성
                                                 - 대안 제시
🔒 구현 못봄             🔒 테스트 의도 못봄      🔒 양쪽 결과만 볼 수 있음
```

정보 장벽으로 Context Pollution 방지.

### 4.4 Agent Capability Directive

모든 외부 에이전트 스폰 시 (리뷰어, 워커, 검증자) 아래 블록이 반드시 포함:

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

## 5. Gate Specifications

### 5.1 G1: CLARIFY

유저 요청 수신 시 3가지 명확성 기준 검사:

1. **범위(Scope)**: 어떤 파일/모듈이 영향받는가?
2. **성공기준(Criteria)**: 완료 조건이 측정 가능한가?
3. **제약(Constraints)**: 성능/호환성/의존성 제한?

질문 생성 규칙 (ICLR 2025 기반):
- 반드시 다지선다 (2~4개 선택지)
- 1회 1질문
- 불명확한 축 하나만 타겟팅

마커: `[CLARIFY PASSED — scope:{파일목록} criteria:{측정가능조건} constraints:{제약}]`

### 5.2 G2: SPEC

자연어 명세 문서 6개 섹션:

```
## 기능 명세
- 목적: {왜 이 변경이 필요한가}
- 입력: {어떤 데이터/이벤트가 트리거하는가}
- 출력: {기대되는 결과물/상태 변화}
- 불변식: {항상 참이어야 하는 조건들} (최소 2개)
- 경계조건: {엣지케이스 목록} (최소 3개)
- 비기능: {성능/보안/호환성 요구사항}
```

왜 코드가 아닌 명세인가: PGS (FSE 2025) — LLM이 코드를 보고 테스트를 작성하면 자기기만 사이클. 명세 기반이면 "구현이 뭘 해야 하는가"를 검증.

불변식 → G4에서 Property-Based Test로 직접 변환.

마커: `[SPEC APPROVED — hash:{sha256}]` (해시는 Bash 도구로 계산)

### 5.3 G3: PLAN REVIEW (상호 토론)

일방 리뷰가 아닌 Designer(Claude) ↔ Reviewer(Codex) 상호 토론:

**Round 1**: Designer → 계획 제출, Reviewer → 피드백 + 스코어
**Round 2**: Designer → 반론(수용 또는 근거 제시), Reviewer → 재평가
**Round 3**: 합의 도출

합의 불가 시: Gemini가 중재자(Tiebreaker)로 참여. 3자 다수결 (2/3 동의 → 채택).
전원 불일치 → 유저 에스컬레이션.

Rubric (5차원):

| 차원 | 가중 | 평가 기준 |
|------|------|----------|
| SPEC 정합성 | 30% | 계획이 명세를 완전히 커버하는가 |
| 분해 품질 | 25% | 태스크 간 의존성 명확, 순환 없음 |
| 불변식 커버리지 | 20% | SPEC 불변식이 테스트 계획에 반영 |
| 리스크 식별 | 15% | 경계조건/실패 시나리오 고려 |
| 실행 가능성 | 10% | 에이전트별 역할이 현실적 |

통과: weighted score ≥ 7.0 AND 모든 차원 > 3.0

SPEC 해시 검증: hash(현재SPEC) ≠ hash(G2승인SPEC) → `[SPEC TAMPERED]` → Phase 0로 회귀

토론 마커 프로토콜:
```
[PLAN DEBATE — R{n} — Designer→Reviewer]
[PLAN DEBATE — R{n} — Reviewer→Designer]
[PLAN DEBATE — R{n} — CONSENSUS — overall:{score}]
[PLAN DEBATE — TIEBREAK — Mediator(Gemini)] (필요 시)
```

### 5.4 G4: TDD RED

입력: G2 SPEC 문서 (코드 아닌 명세만)
작성자: Agent A (Claude) — 구현 코드 접근 불가

테스트 3계층:

**Layer 1: Example-Based Tests (TDD 전통)**
- SPEC의 입력/출력 쌍으로부터 도출
- 경계조건 최소 3개 포함
- Happy path + Error path 분리

**Layer 2: Property-Based Tests (PBT)**
- SPEC 불변식을 직접 변환
- Wlaschin 7패턴 체크리스트:
  - □ 역변환(round-trip)?
  - □ 멱등성?
  - □ 크기/구조 보존?
  - □ 검증 용이성?
- 최소 2개 property 필수

**Layer 3: Smoke Test Skeleton (E2E 준비)**
- 실제 실행 시나리오 골격
- G7에서 완성

통과 조건:
- 테스트 파일 존재
- 테스트 실행 시 전부 FAIL (구현 없으므로)
- Layer 1 최소 5개 + Layer 2 최소 2개

실패 조건:
- 테스트가 이미 PASS → 구현에 의존하는 오염 의심
- Layer 2 부재 → PBT 추가 요구

마커: `[TDD RED PASSED — test_count:{N} fail_count:{N}]`

### 5.5 G5: IMPLEMENT GREEN

구현자: Agent B (Codex 또는 다른 Claude 세션)

정보 장벽:
- ✅ 볼 수 있음: 테스트 파일, 기존 코드베이스, SPEC 문서
- ❌ 볼 수 없음: 테스트 작성자 의도/코멘트, G3 토론 내역, 다른 에이전트 구현 제안

구현 루프 (TGen Remediation 기반):
1. 최소 구현 작성
2. 테스트 실행
   - ALL PASS → G5 통과
   - FAIL 존재 → 에러 분석 → 수정 → 재실행 (max 5회)
3. 3회 연속 동일 테스트 실패 → `[IMPLEMENTATION STUCK]` → 유저 개입

안전장치:
- 워커가 테스트 파일 수정 시 즉시 차단: `[TEST TAMPERING DETECTED]` → G4로 회귀
- 테스트 파일 해시 비교 (G4 승인 해시 vs 현재 해시)

마커: `[IMPLEMENT GREEN PASSED — pass:{N}/{N} iterations:{M}]`

### 5.6 G6: CROSS-VERIFY

3중 검증 파이프라인:

**Verify 1: Mutation Testing**
- 도구: JS/TS → Stryker, Python → mutmut, Java → PIT, Shell → 수동
- 구현 코드에 mutant 주입 → 테스트 실행 → mutation score 산출
- 통과: mutation score ≥ 60%
- 실패: 살아남은 mutant 목록 → 해당 라인 테스트 보강

**Verify 2: Property-Based Test 실행**
- G4 Layer 2 PBT를 최소 100회 랜덤 입력으로 실행
- 반례 발견 시 자동 shrinking → 최소 반례 도출
- 통과: 반례 0건
- 실패: 최소 반례 + 위반 property 반환 → 구현 수정 후 G5 회귀

**Verify 3: Cross-Model Review**
- 구현을 만들지 않은 Agent C (Gemini)가 검토
- AGENT_CAPABILITY_DIRECTIVE 포함
- 검토 관점: SPEC 대비 누락, 불변식 검증 여부, 놓친 엣지케이스, 대안 접근
- verdict: PASS | CONCERN | REJECT
- REJECT → 상호 토론 (G3과 동일한 debate 프로토콜)
- CONCERN → 유저 판단 위임

마커: `[CROSS-VERIFY PASSED — mutation:{%} pbt:{pass/fail} review:{verdict}]`

### 5.7 G7: E2E VALIDATE

**Type A: 스크립트 실행 검증** (CLI, 플러그인)
- 클린 환경에서 설치/실행
- SPEC 입력 → 기대 출력 비교

**Type B: 통합 시나리오 검증** (멀티 모듈, API)
- 실제 의존성 연결 (mock 금지)
- 유저 시나리오 재현

**Type C: Hive 플러그인 특화 검증**
- validate-plugin.sh → 38 checks PASS
- validate-standards.sh → 10범주 PASS
- test_markers.py → 15 checks PASS
- 라인 수 제한 확인 (500줄 미만)

마커: `[E2E VALIDATE PASSED — type:{A|B|C} result:{상세}]`

## 6. Enforcement Mechanism (Dual Layer)

### 6.1 프롬프트 레이어 (1차 방어 — 안내)

SKILL.md 내 HARD-GATE 지시문:
```xml
<HARD-GATE>
Do NOT proceed to [다음 단계] unless the conversation contains
the marker [이전 마커]. If the marker is absent, you MUST
execute [현재 단계] first. This is non-negotiable.
</HARD-GATE>
```

### 6.2 외부 검증 레이어 (2차 방어 — 물리적 차단)

`validate-gates.sh` 스크립트 + pre-commit hook:
- 마커 파일 존재 여부 regex 검증
- 해시 무결성 검증
- 마커 체인 불완전 시 커밋 차단

### 6.3 마커 파일 저장 (컨텍스트 비대화 방지)

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

각 파일에 마커 내용 + 해시 저장. 대화에는 `[G1 ✓] [G2 ✓] ...` 요약만 표시.

### 6.4 해시 계산 (LLM 할루시네이션 방지)

LLM은 SHA256을 계산할 수 없음. 반드시 Bash 도구 사용:
```bash
sha256sum <<< '{content}' | cut -d' ' -f1
```

## 7. Plugin Skill Structure

### 7.1 신규 스킬

| 스킬 | 역할 | 내용 |
|------|------|------|
| `hive-quality-gates` | 게이트 정의 + 마커 검증 | G1~G7 정의, 마커 포맷, HARD-GATE, 해시 검증 |
| `hive-tdd-pipeline` | TDD 루프 + 격리 규칙 | G4~G7 실행 로직, 에이전트 격리, mutation/PBT 실행 |

### 7.2 기존 스킬 수정

| 스킬 | 변경 내용 |
|------|----------|
| `hive-workflow` | Phase 0에 G1+G2 HARD-GATE 삽입, Phase 5에 hive-tdd-pipeline 호출 |
| `hive-consensus` | G3 상호 토론 프로토콜로 교체 (일방 → debate) |
| `hive-spawn-templates` | 3개 템플릿에 AGENT_CAPABILITY_DIRECTIVE 추가 |
| `hive` (엔트리포인트) | quality pipeline 스킬 참조 추가 |

### 7.3 신규 스크립트

| 스크립트 | 역할 |
|---------|------|
| `scripts/validate-gates.sh` | 마커 체인 검증 + 해시 무결성 |
| `pre-commit hook` | validate-gates.sh + 기존 검증 스크립트 통합 실행 |

## 8. Gemini Review Feedback (Incorporated)

| 지적 | 대응 |
|------|------|
| HARD-GATE는 사실상 소프트 게이트 | 외부 validate-gates.sh + pre-commit hook 이중 강제 |
| LLM은 SHA256 계산 불가 | Bash 도구 강제 사용 지시문 추가 |
| 마커 의역/축약 위험 | regex 기반 추출 + 마커 파일 저장 |
| 컨텍스트 비대화 | .hive-state/ 파일 기반 + 대화에 요약만 표시 |
| 마커 할루시네이션 위험 | 외부 스크립트로 실제 실행 결과 검증 |

## 9. Success Metrics

- 모든 플러그인 사용자가 7개 게이트를 통과해야 작업 완료 가능
- mutation score 60% 이상 달성
- 테스트-현실 괴리 제거 (E2E 검증 필수)
- 에이전트 간 정보 장벽으로 자기기만 사이클 차단
