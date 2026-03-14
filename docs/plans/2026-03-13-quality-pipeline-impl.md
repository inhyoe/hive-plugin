# Hive Quality Pipeline v2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Hive Plugin v1.6.0 → v2.0.0 — 7단계 품질 게이트를 모든 사용자에게 하드 강제

**Architecture:** 기존 6개 Phase 구조 유지 + 신규 스킬 2개(quality-gates, tdd-pipeline)로 게이트 삽입. 외부 스크립트(validate-gates.sh) + pre-commit hook으로 이중 강제. 기존 스킬은 참조만 추가 (라인 수 제한 준수).

**Tech Stack:** Bash (스크립트/hook), Markdown (SKILL.md), Python (마커 테스트), SHA256 (무결성)

**Critical Constraints:**
- `hive-workflow`: 499줄 (500줄 제한 — 추가 불가, 교체만 가능)
- `hive-consensus`: 474줄 (26줄 여유)
- 모든 SKILL.md: 500줄 미만 필수
- 모든 templates: 200줄 미만 필수

---

### Task 1: 신규 스킬 `hive-quality-gates` 생성

**Files:**
- Create: `skills/hive-quality-gates/SKILL.md`

**Step 1: 스킬 디렉토리 생성**

Run: `mkdir -p skills/hive-quality-gates`

**Step 2: SKILL.md 작성**

```markdown
---
name: hive-quality-gates
description: Defines G1-G7 quality gates with hard-gate enforcement, marker protocol, hash verification, and debate-based plan review for /hive workflow. Loaded when /hive processes any phase transition.
user-invocable: false
---

# Hive Quality Gates

> 7단계 품질 게이트 정의 + 마커 프로토콜 + 해시 검증.
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

<HARD-GATE>
Do NOT proceed to G2 (SPEC) unless the conversation contains
[CLARIFY PASSED]. If absent, execute G1 first. Non-negotiable.
</HARD-GATE>

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

<HARD-GATE>
Do NOT proceed to Phase 1 (Brainstorm) unless the conversation contains
[SPEC APPROVED — hash:{sha256}]. If absent, write SPEC first. Non-negotiable.
</HARD-GATE>

자연어 명세 6개 섹션:
- 목적: {왜 이 변경이 필요한가}
- 입력: {어떤 데이터/이벤트가 트리거하는가}
- 출력: {기대되는 결과물/상태 변화}
- 불변식: {항상 참이어야 하는 조건들} — **최소 2개** (Wlaschin 7패턴 참조)
- 경계조건: {엣지케이스 목록} — **최소 3개**
- 비기능: {성능/보안/호환성 요구사항}

통과: 6섹션 비어있지 않음 + 불변식 2+ + 경계조건 3+
마커: `[SPEC APPROVED — hash:{sha256}]`

해시 계산 (LLM은 SHA256 계산 불가 — 반드시 Bash 도구 사용):
```bash
sha256sum <<< '{SPEC내용}' | cut -d' ' -f1
```

---

## 4. G3: PLAN REVIEW Gate (상호 토론)

<HARD-GATE>
Do NOT proceed to Phase 5 (Execute) unless the conversation contains
[PLAN DEBATE — CONSENSUS — overall:{score}] with score >= 7.0.
Non-negotiable.
</HARD-GATE>

### 상호 토론 프로토콜 (일방 리뷰 아님)

**Round 1**: Designer(Claude) → 계획 제출, Reviewer(Codex) → 피드백 + 스코어
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
```

**Step 3: 라인 수 확인**

Run: `wc -l skills/hive-quality-gates/SKILL.md`
Expected: < 500

**Step 4: 검증 실행**

Run: `bash scripts/validate-plugin.sh`
Expected: All checks PASS

**Step 5: 커밋**

```bash
git add skills/hive-quality-gates/
git commit -m "feat(hive): add hive-quality-gates skill — G1-G3 gate definitions + marker protocol"
```

---

### Task 2: 신규 스킬 `hive-tdd-pipeline` 생성

**Files:**
- Create: `skills/hive-tdd-pipeline/SKILL.md`

**Step 1: 스킬 디렉토리 생성**

Run: `mkdir -p skills/hive-tdd-pipeline`

**Step 2: SKILL.md 작성**

```markdown
---
name: hive-tdd-pipeline
description: TDD Red-Green-Verify pipeline for /hive Phase 5 execution. Enforces agent isolation, mutation testing, property-based testing, and E2E validation with hard gates. Loaded when /hive enters Phase 5.
user-invocable: false
---

# Hive TDD Pipeline

> Phase 5 실행 시 G4~G7 TDD 루프 + 에이전트 격리 규칙.
> 근거: TGen (2024), Meta ACH (FSE 2025), CodeDelegator (2025), PGS (FSE 2025).

---

## 1. 에이전트 격리 원칙 (CodeDelegator 기반)

```
Agent A (Claude)         Agent B (Codex)         Agent C (Gemini)
- 명세 기반 테스트 작성  - 최소 구현             - 검증 (mutation/PBT)
- SPEC만 참조           - 테스트+코드베이스 참조  - 양쪽 결과만 참조
🔒 구현 코드 접근 불가   🔒 테스트 의도 접근 불가  🔒 과정 접근 불가
```

정보 장벽으로 Context Pollution 방지 (Kemple 2025, CP > 0.25 시 품질 저하).

---

## 2. G4: TDD RED

<HARD-GATE>
Do NOT proceed to G5 (IMPLEMENT) unless the conversation contains
[TDD RED PASSED — test_count:{N} fail_count:{N}] where fail_count == test_count.
Non-negotiable.
</HARD-GATE>

입력: G2 SPEC 문서 (코드 아닌 명세만)
작성자: Agent A (Claude) — 구현 코드 접근 불가

### 테스트 3계층

**Layer 1: Example-Based Tests**
- SPEC 입력/출력 쌍에서 도출
- 경계조건 최소 3개 (SPEC에서 가져옴)
- Happy path + Error path 분리
- 최소 5개

**Layer 2: Property-Based Tests (PBT)**
- SPEC 불변식을 직접 변환
- Wlaschin 7패턴 체크리스트:
  □ 역변환(round-trip)? □ 멱등성? □ 크기/구조 보존? □ 검증 용이성?
- 최소 2개 property

**Layer 3: Smoke Test Skeleton**
- 실제 실행 시나리오 골격 (G7에서 완성)

### 통과 조건
- ✅ 테스트 파일 존재
- ✅ 테스트 실행 시 전부 FAIL (구현 없으므로)
- ✅ Layer 1 ≥ 5개 + Layer 2 ≥ 2개

### 실패 조건
- ❌ 테스트가 이미 PASS → 구현에 의존 (오염 의심)
- ❌ Layer 2 부재 → PBT 추가 요구

테스트 파일 해시 기록: `Bash("sha256sum tests/* | cut -d' ' -f1")`
→ `.hive-state/g4-tdd-red.marker`에 저장

---

## 3. G5: IMPLEMENT GREEN

<HARD-GATE>
Do NOT proceed to G6 (CROSS-VERIFY) unless the conversation contains
[IMPLEMENT GREEN PASSED — pass:{N}/{N}]. Non-negotiable.
</HARD-GATE>

구현자: Agent B (Codex 또는 별도 Claude 세션)

### 정보 장벽
- ✅ 볼 수 있음: 테스트 파일, 기존 코드베이스, SPEC 문서
- ❌ 볼 수 없음: 테스트 작성자 의도/코멘트, G3 토론 내역

### 구현 루프 (TGen Remediation)
1. 최소 구현 작성
2. 테스트 실행
   - ALL PASS → G5 통과
   - FAIL → 에러 분석 → 수정 → 재실행 (max 5회)
3. 3회 연속 동일 테스트 실패 → `[IMPLEMENTATION STUCK]` → 유저 개입

### 안전장치: 테스트 변조 탐지
```
hash(현재테스트) ≠ hash(G4승인테스트) → [TEST TAMPERING DETECTED] → G4 회귀
```
워커가 테스트 파일 수정 시 즉시 차단.

---

## 4. G6: CROSS-VERIFY

<HARD-GATE>
Do NOT proceed to G7 (E2E) unless the conversation contains
[CROSS-VERIFY PASSED — mutation:{%} pbt:{pass} review:{verdict}]
with mutation >= 60 and review != REJECT. Non-negotiable.
</HARD-GATE>

### 3중 검증 파이프라인

**Verify 1: Mutation Testing**
- 도구: JS/TS→Stryker, Python→mutmut, Java→PIT, Shell→수동 mutation
- 구현 코드에 mutant 주입 → 테스트 실행 → mutation score 산출
- 통과: mutation score ≥ 60%
- 실패: 살아남은 mutant 목록 → 테스트 보강

**Verify 2: Property-Based Test 실행**
- G4 Layer 2 PBT를 최소 100회 랜덤 입력으로 실행
- 반례 발견 시 자동 shrinking → 최소 반례
- 통과: 반례 0건
- 실패: 최소 반례 반환 → 구현 수정 후 G5 회귀

**Verify 3: Cross-Model Review**
- 구현을 만들지 않은 Agent C (Gemini)가 검토
- AGENT_CAPABILITY_DIRECTIVE 포함 (hive-quality-gates §6)
- 검토: SPEC 누락, 불변식 검증 여부, 놓친 엣지케이스
- verdict: PASS | CONCERN | REJECT
- REJECT → 상호 토론 (G3과 동일한 debate 프로토콜)
- CONCERN → 유저 판단 위임

---

## 5. G7: E2E VALIDATE

<HARD-GATE>
Do NOT declare work complete unless the conversation contains
[E2E VALIDATE PASSED — type:{T} result:{...}]. Non-negotiable.
</HARD-GATE>

### Type A: 스크립트 실행 검증
대상: CLI, 스크립트, 플러그인
- 클린 환경에서 설치/실행
- SPEC 입력 → 기대 출력 비교

### Type B: 통합 시나리오 검증
대상: 멀티 모듈, API, 서비스
- 실제 의존성 연결 (mock 금지)
- 유저 시나리오 재현

### Type C: Hive 플러그인 특화 검증
대상: SKILL.md, plugin.json, 마커 포맷
- validate-plugin.sh → 38 checks PASS
- validate-standards.sh → 10범주 PASS
- test_markers.py → 15 checks PASS (마커 포맷 갱신 필요)
- 라인 수 500줄 미만

### 실패 시
에러 로그 + SPEC 대비 괴리 분석 → G5 회귀 (max 3회 → 유저 에스컬레이션)

---

## 6. 전체 흐름 요약

```
[G1 CLARIFY] → [G2 SPEC] → Phase 1-3 → [G3 PLAN REVIEW]
→ [G4 TDD RED] → [G5 IMPLEMENT GREEN] → [G6 CROSS-VERIFY]
→ [G7 E2E VALIDATE] → ✅ [QUALITY PIPELINE COMPLETE — 7/7]
```
```

**Step 3: 라인 수 확인**

Run: `wc -l skills/hive-tdd-pipeline/SKILL.md`
Expected: < 500

**Step 4: 검증 실행**

Run: `bash scripts/validate-plugin.sh`
Expected: All checks PASS

**Step 5: 커밋**

```bash
git add skills/hive-tdd-pipeline/
git commit -m "feat(hive): add hive-tdd-pipeline skill — G4-G7 TDD loop + agent isolation"
```

---

### Task 3: 스폰 템플릿에 AGENT_CAPABILITY_DIRECTIVE 추가

**Files:**
- Modify: `skills/hive-spawn-templates/templates/claude-agent.md`
- Modify: `skills/hive-spawn-templates/templates/codex-agent.md`
- Modify: `skills/hive-spawn-templates/templates/gemini-agent.md`

**Step 1: claude-agent.md 수정**

`skills/hive-spawn-templates/templates/claude-agent.md` 의 합의 단계 `<instructions>` 블록 앞에 추가:

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

동일 블록을 구현 단계 `<instructions>` 블록 앞에도 추가.

**Step 2: codex-agent.md 수정**

합의 단계 프롬프트 상단 (`당신은 {{MODULE_NAME}}` 앞)에 추가:

```
<AGENT_CAPABILITY_DIRECTIVE>
You MUST utilize ALL available resources before and during your task:
- Invoke all relevant skills available in your session
- Use all connected MCP tools
- If uncertain, use web search to verify before guessing
Do NOT respond based on inference alone when tools are available.
</AGENT_CAPABILITY_DIRECTIVE>
```

구현 단계도 동일.

**Step 3: gemini-agent.md 수정**

codex-agent.md와 동일한 위치에 동일 블록 추가.

**Step 4: 라인 수 확인**

Run: `wc -l skills/hive-spawn-templates/templates/*.md`
Expected: 각 파일 < 200줄

**Step 5: 검증 실행**

Run: `bash scripts/validate-plugin.sh`
Expected: All checks PASS

**Step 6: 커밋**

```bash
git add skills/hive-spawn-templates/templates/
git commit -m "feat(hive): add AGENT_CAPABILITY_DIRECTIVE to all spawn templates"
```

---

### Task 4: `hive` 엔트리포인트 수정

**Files:**
- Modify: `skills/hive/SKILL.md:11` (참조 스킬 목록)
- Modify: `skills/hive/SKILL.md:18` (핵심 역할)
- Modify: `skills/hive/SKILL.md:126-156` (Phase Router)

**Step 1: 참조 스킬 목록 확장 (line 11)**

변경 전:
```
> **참조 스킬**: `hive-workflow`, `hive-consensus`, `hive-spawn-templates`
```

변경 후:
```
> **참조 스킬**: `hive-workflow`, `hive-consensus`, `hive-spawn-templates`, `hive-quality-gates`, `hive-tdd-pipeline`
```

**Step 2: 핵심 역할에 품질 게이트 추가 (line 18)**

변경 전:
```
핵심 역할: **Prompt Engineering → Brainstorm → Serena → Team → Consensus → Execute**
```

변경 후:
```
핵심 역할: **Clarify → Spec → Prompt Eng → Brainstorm → Serena → Team → Consensus(Debate) → TDD Red → Implement Green → Cross-Verify → E2E Validate**
```

**Step 3: Phase Router에 품질 게이트 참조 추가 (lines 126-156)**

Phase 0 항목에 추가:
```
Phase 0: Prompt Engineering & Resource Discovery
  → ⛔ G1: CLARIFY + G2: SPEC 게이트 (참조: hive-quality-gates §2-3) 선행 필수
  → MCP improve_prompt → 리소스 매칭 ...
```

Phase 4 항목에 추가:
```
Phase 4: Consensus Loop (합의) ⚠️ 상호 토론 필수
  → G3: PLAN REVIEW 상호 토론 (참조: hive-quality-gates §4)
  ...
```

Phase 5 항목에 추가:
```
Phase 5: Execute & Monitor (실행) ⚠️ TDD Pipeline 필수
  → G4-G7 TDD Pipeline (참조: hive-tdd-pipeline)
  ...
```

**Step 4: 라인 수 확인**

Run: `wc -l skills/hive/SKILL.md`
Expected: < 500 (현재 158줄, 충분한 여유)

**Step 5: 검증 + 커밋**

```bash
bash scripts/validate-plugin.sh
git add skills/hive/SKILL.md
git commit -m "feat(hive): add quality gate references to entrypoint"
```

---

### Task 5: `hive-workflow` 수정 (Phase 0에 G1+G2 참조, Phase 5에 TDD 참조)

**Files:**
- Modify: `skills/hive-workflow/SKILL.md`

**Critical:** 현재 499줄. 1줄도 순증가 불가. 교체만 가능.

**Step 1: Phase 0 상단에 G1+G2 참조 삽입 (line 14 뒤)**

기존 Phase 0 설명 (`사용자의 원본 요청($ARGUMENTS)을 분석하여...`) 앞에 3줄 추가, 대신 Phase 0 결과물 형식 (`PROMPT ENGINEERING COMPLETE` 블록, lines 78-97)의 중복 주석을 3줄 줄여서 상쇄:

삽입 (line 16 앞):
```
<HARD-GATE>
Phase 0 진입 전 G1(CLARIFY) + G2(SPEC) 게이트 통과 필수. 참조: hive-quality-gates §2-3.
</HARD-GATE>
```

**Step 2: Phase 5 상단에 TDD Pipeline 참조 삽입 (line 372 뒤)**

기존 `### 5-1. 실행 순서 (Wave 기반)` 앞에 삽입, Phase 5-6 최종 출력 블록 (lines 491-499)의 중복 마크다운을 동일 줄 수만큼 줄여서 상쇄:

삽입:
```
<HARD-GATE>
Phase 5 실행 시 hive-tdd-pipeline 의 G4-G7 게이트를 반드시 따라야 한다.
TDD Red → Implement Green → Cross-Verify → E2E Validate 순서 강제.
참조: hive-tdd-pipeline §2-5.
</HARD-GATE>
```

**Step 3: 라인 수 확인**

Run: `wc -l skills/hive-workflow/SKILL.md`
Expected: ≤ 500 (순증가 0)

**Step 4: 검증 + 커밋**

```bash
bash scripts/validate-plugin.sh && bash scripts/validate-standards.sh
git add skills/hive-workflow/SKILL.md
git commit -m "feat(hive-workflow): add G1-G2 and TDD pipeline hard-gate references"
```

---

### Task 6: `hive-consensus` 수정 (상호 토론 참조 추가)

**Files:**
- Modify: `skills/hive-consensus/SKILL.md`

**Budget:** 현재 474줄, 26줄 여유.

**Step 1: §1 핵심 원칙에 상호 토론 원칙 추가 (line 23 뒤)**

```markdown
8. **Plan Review 상호 토론**: Phase 4 합의 전 G3 Plan Review 상호 토론을 거쳐야 한다 (hive-quality-gates §4). 일방 리뷰가 아닌 Designer↔Reviewer 다중 라운드 debate. 합의 불가 시 Gemini 중재.
```

**Step 2: §7 합의 완료 조건 뒤에 G3 참조 추가 (line 235 뒤)**

```markdown
### 7-1. G3 Plan Review 연동

Phase 4 합의 루프 시작 전 G3 (PLAN REVIEW) 상호 토론이 완료되어야 한다.
G3 debate 프로토콜 및 rubric은 hive-quality-gates §4 참조.
G3 통과 마커: `[PLAN DEBATE — CONSENSUS — overall:{score≥7.0}]`
이 마커 없이 Phase 4 합의 시작 금지.
```

**Step 3: 라인 수 확인**

Run: `wc -l skills/hive-consensus/SKILL.md`
Expected: ~480줄 (< 500)

**Step 4: 검증 + 커밋**

```bash
bash scripts/validate-plugin.sh
git add skills/hive-consensus/SKILL.md
git commit -m "feat(hive-consensus): add G3 plan review debate integration"
```

---

### Task 7: `validate-gates.sh` 스크립트 생성

**Files:**
- Create: `scripts/validate-gates.sh`

**Step 1: 스크립트 작성**

```bash
#!/usr/bin/env bash
# validate-gates.sh — Verify .hive-state/ marker chain integrity
# Exit 0 if all required markers present and hashes valid, else exit 1

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="$REPO_ROOT/.hive-state"

PASS=0
FAIL=0
WARN=0

check() {
    local label="$1" file="$2"
    if [ -f "$file" ]; then
        printf "  PASS: %s\n" "$label"
        PASS=$((PASS + 1))
    else
        printf "  WARN: %s (marker not found — pipeline may not have been run)\n" "$label"
        WARN=$((WARN + 1))
    fi
}

check_hash() {
    local label="$1" marker_file="$2" field="$3" target_file="$4"
    if [ ! -f "$marker_file" ]; then
        return 0  # no marker = no hash to verify
    fi
    local stored_hash
    stored_hash=$(grep -oP "${field}:\K[a-f0-9]{64}" "$marker_file" 2>/dev/null || echo "")
    if [ -z "$stored_hash" ]; then
        return 0  # no hash field in marker
    fi
    if [ ! -f "$target_file" ]; then
        printf "  FAIL: %s — target file missing: %s\n" "$label" "$target_file"
        FAIL=$((FAIL + 1))
        return 1
    fi
    local current_hash
    current_hash=$(sha256sum "$target_file" | cut -d' ' -f1)
    if [ "$stored_hash" = "$current_hash" ]; then
        printf "  PASS: %s (hash match)\n" "$label"
        PASS=$((PASS + 1))
    else
        printf "  FAIL: %s (hash mismatch — stored:%s current:%s)\n" "$label" "${stored_hash:0:12}..." "${current_hash:0:12}..."
        FAIL=$((FAIL + 1))
    fi
}

echo "=== HIVE QUALITY GATE VALIDATION ==="
echo ""

# Check .hive-state directory
if [ ! -d "$STATE_DIR" ]; then
    echo "  INFO: .hive-state/ directory not found — quality pipeline has not been run."
    echo "  This is normal for commits that do not go through /hive workflow."
    exit 0
fi

echo "--- Marker Chain ---"
check "G1: CLARIFY"       "$STATE_DIR/g1-clarify.marker"
check "G2: SPEC"          "$STATE_DIR/g2-spec.marker"
check "G3: PLAN REVIEW"   "$STATE_DIR/g3-plan-review.marker"
check "G4: TDD RED"       "$STATE_DIR/g4-tdd-red.marker"
check "G5: IMPLEMENT"     "$STATE_DIR/g5-implement.marker"
check "G6: CROSS-VERIFY"  "$STATE_DIR/g6-cross-verify.marker"
check "G7: E2E VALIDATE"  "$STATE_DIR/g7-e2e-validate.marker"

echo ""
echo "--- Hash Integrity ---"
# Hash checks only run if marker files exist with hash fields
check_hash "SPEC hash"    "$STATE_DIR/g2-spec.marker"       "hash" "$STATE_DIR/spec-content.txt"
check_hash "TEST hash"    "$STATE_DIR/g4-tdd-red.marker"    "hash" "$STATE_DIR/test-content.txt"
check_hash "IMPL hash"    "$STATE_DIR/g5-implement.marker"  "hash" "$STATE_DIR/impl-content.txt"

echo ""
echo "=== GATE VALIDATION SUMMARY ==="
printf "  Passed: %d\n" "$PASS"
printf "  Warnings: %d\n" "$WARN"
printf "  Failed: %d\n" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
    echo "  Result: [FAIL] — Hash integrity violation detected"
    exit 1
else
    echo "  Result: [PASS]"
    exit 0
fi
```

**Step 2: 실행 권한 부여**

Run: `chmod +x scripts/validate-gates.sh`

**Step 3: 테스트 실행**

Run: `bash scripts/validate-gates.sh`
Expected: INFO message (no .hive-state/ yet), exit 0

**Step 4: 커밋**

```bash
git add scripts/validate-gates.sh
git commit -m "feat(scripts): add validate-gates.sh — marker chain + hash integrity verifier"
```

---

### Task 8: `run-tests.sh`에 gate 검증 추가

**Files:**
- Modify: `scripts/run-tests.sh:34` (CCB 테스트 뒤)

**Step 1: gate 검증 추가**

line 34 (`run_test "[CCB]..."`) 뒤에 추가:

```bash
# Gate marker validation
run_test "[Gates]     validate-gates.sh" "$SCRIPTS_DIR/validate-gates.sh"
```

**Step 2: 테스트 실행**

Run: `bash scripts/run-tests.sh`
Expected: 4 tests, all PASS

**Step 3: 커밋**

```bash
git add scripts/run-tests.sh
git commit -m "feat(scripts): add gate validation to test suite"
```

---

### Task 9: 마커 테스트 갱신

**Files:**
- Modify: `scripts/test_markers.py`

**Step 1: 신규 마커 패턴 추가**

`test_markers.py`의 `MARKER_PATTERNS` dict에 신규 마커 패턴 추가:

```python
"CLARIFY PASSED": {
    "template": r"^\[CLARIFY PASSED — scope:\{[^}]+\} criteria:\{[^}]+\} constraints:\{[^}]+\}\]",
    "instance": r"^\[CLARIFY PASSED — scope:.+ criteria:.+ constraints:.+\]"
},
"SPEC APPROVED": {
    "template": r"^\[SPEC APPROVED — hash:\{[^}]+\}\]",
    "instance": r"^\[SPEC APPROVED — hash:[a-f0-9]{64}\]"
},
"PLAN DEBATE": {
    "template": r"^\[PLAN DEBATE — R\{[^}]+\} — (Designer→Reviewer|Reviewer→Designer|CONSENSUS|TIEBREAK)",
    "instance": r"^\[PLAN DEBATE — R\d+ — (Designer→Reviewer|Reviewer→Designer|CONSENSUS|TIEBREAK)"
},
"TDD RED PASSED": {
    "template": r"^\[TDD RED PASSED — test_count:\{[^}]+\} fail_count:\{[^}]+\}\]",
    "instance": r"^\[TDD RED PASSED — test_count:\d+ fail_count:\d+\]"
},
"IMPLEMENT GREEN PASSED": {
    "template": r"^\[IMPLEMENT GREEN PASSED — pass:\{[^}]+\}/\{[^}]+\} iterations:\{[^}]+\}\]",
    "instance": r"^\[IMPLEMENT GREEN PASSED — pass:\d+/\d+ iterations:\d+\]"
},
"CROSS-VERIFY PASSED": {
    "template": r"^\[CROSS-VERIFY PASSED — mutation:\{[^}]+\}% pbt:\{[^}]+\} review:\{[^}]+\}\]",
    "instance": r"^\[CROSS-VERIFY PASSED — mutation:\d+% pbt:(pass|fail) review:(PASS|CONCERN|REJECT)\]"
},
"E2E VALIDATE PASSED": {
    "template": r"^\[E2E VALIDATE PASSED — type:\{[^}]+\} result:\{[^}]+\}\]",
    "instance": r"^\[E2E VALIDATE PASSED — type:(A|B|C) result:.+\]"
},
```

또한 `TARGET_FILES`에 신규 스킬 파일 추가:
```python
"skills/hive-quality-gates/SKILL.md",
"skills/hive-tdd-pipeline/SKILL.md",
```

**Step 2: 테스트 실행**

Run: `python3 scripts/test_markers.py`
Expected: All checks PASS (기존 + 신규)

**Step 3: 커밋**

```bash
git add scripts/test_markers.py
git commit -m "feat(tests): add quality gate marker patterns to test_markers.py"
```

---

### Task 10: `plugin.json` 버전 업데이트

**Files:**
- Modify: `.claude-plugin/plugin.json`

**Step 1: 버전 업데이트**

변경 전: `"version": "1.6.0"`
변경 후: `"version": "2.0.0"`

**Step 2: description 업데이트**

기존 description에 quality pipeline 언급 추가.

**Step 3: 커밋**

```bash
git add .claude-plugin/plugin.json
git commit -m "chore: bump version to 2.0.0 — quality pipeline integration"
```

---

### Task 11: `.gitignore`에 `.hive-state/` 추가

**Files:**
- Modify: `.gitignore`

**Step 1: 추가**

`.hive-state/` 는 런타임 상태이므로 git에서 제외:

```
# Hive quality pipeline runtime state
.hive-state/
```

**Step 2: 커밋**

```bash
git add .gitignore
git commit -m "chore: add .hive-state/ to gitignore"
```

---

### Task 12: 전체 검증 실행

**Step 1: 전체 테스트 스위트 실행**

Run: `bash scripts/run-tests.sh`
Expected: All PASS (Structure + Markers + CCB + Gates)

**Step 2: 표준 검증**

Run: `bash scripts/validate-standards.sh`
Expected: All PASS

**Step 3: 라인 수 최종 확인**

Run: `wc -l skills/*/SKILL.md skills/hive-spawn-templates/templates/*.md`
Expected: 모든 SKILL.md < 500, 모든 template < 200

**Step 4: 결과 확인 후 완료**

모든 체크 통과 시 구현 완료.
