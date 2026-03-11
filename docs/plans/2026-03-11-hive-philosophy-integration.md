# Hive Philosophy Integration — 4가지 개선 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Obsidian에 기록된 멀티에이전트 설계 철학과 실전 교훈(Ralph Loop V2, 컨텍스트 제로섬, 교차 피드백)을 hive-plugin에 반영

**Architecture:** hive-workflow(519줄, 500줄 제한 근접), hive-consensus(448줄), hive-spawn-templates(125줄) 3개 스킬 파일을 수정. 라인 예산을 엄격 관리하며 기존 섹션 교체/압축 방식으로 진행.

**Tech Stack:** Claude Code Skills (SKILL.md markdown), no code — 순수 문서 수정

---

## 라인 예산 계획

| 파일 | 현재 | 추가 | 삭제 | 예상 | 500줄 제한 |
|------|------|------|------|------|-----------|
| hive-workflow | 519 | +30 | -50 | ~499 | OK |
| hive-consensus | 448 | +25 | 0 | ~473 | OK |
| hive-spawn-templates | 125 | +45 | 0 | ~170 | OK |

**핵심 전략**: hive-workflow는 이미 519줄이므로, Phase 5의 기존 5-4 실패 처리(8줄)를 교체하고 Phase 1 질문 은행의 일부 예시를 압축하여 공간을 확보한다.

---

## Task 1: 실패 분석 메커니즘 (Ralph Loop V2)

**Files:**
- Modify: `skills/hive-workflow/SKILL.md:489-496` (5-4 실패 처리 → 확장 교체)
- Modify: `skills/hive-workflow/SKILL.md:161-209` (Phase 1 질문 은행 → 압축)

### Step 1: Phase 1 질문 은행 압축 (라인 예산 확보)

현재 161-209줄의 질문 은행에서 코드블록 내 Options 설명을 단축하여 ~20줄 절약.

**old_string** (lines 162-209, 48줄):
```markdown
**Problem Clarity (30%)**
```
(아래까지)
```markdown
  C. "MVP로 검증 → 점진적 확장" → 10pts
```

**new_string** (28줄로 압축):
```markdown
**Problem Clarity (30%)** — "어떤 유형의 작업인가요?"
Options: A. 버그 수정(27) B. 새 기능(27) C. 성능 개선(24) D. 리팩터링(18)

**Functional Scope (25%)** — "기능 범위가 어느 정도인가요?"
Options: A. 단일 모듈(23) B. 2-3개 모듈(20) C. 크로스커팅(18) D. 분석 필요(10)

**Success Criteria (20%)** — "성공을 어떻게 검증할 건가요?"
Options: A. 자동화 테스트(18) B. 성능 벤치마크(18) C. 수동 체크리스트(14) D. 미정의(6)

**Constraints (15%)** — "주요 제약사항이 있나요?"
Options: A. 하위호환 필수(14) B. 라이브러리 제한(12) C. 성능 SLA(12) D. 없음(15)

**Priority/MVP (10%)** — "우선순위를 어떻게 나누시겠어요?"
Options: A. 전부 한번에(8) B. 핵심 먼저(10) C. MVP 검증(10)
```

### Step 2: 5-4 실패 처리를 Failure Analysis로 교체

**old_string** (lines 489-496):
```markdown
### 5-4. 실패 처리

| 상황 | 동작 |
|------|------|
| Claude 에이전트 실패 | 에러 확인 → 리드 재시도 또는 직접 처리 |
| CCB 타임아웃 | soft 3min pend 확인 → hard 10min 에스컬레이션 (hive-consensus §4 참조) → 실패 시 AskUserQuestion |
| 구현이 CONSENSUS와 불일치 | 리드 diff 검토 → 재지시 또는 직접 수정 |
| Wave 중 하나 실패 | 해당 Wave 중단 → 의존 Wave 대기 → AskUserQuestion |
```

**new_string**:
```markdown
### 5-4. Failure Analysis (실패 분석 — Ralph Loop V2)

Phase 5 실패 시 **동일 프롬프트 재시도 금지**. 원인 분류 후 맞춤 재진입.

#### 실패 원인 분류

| 분류 | 진단 기준 | 리드 대응 | 재진입 지점 |
|------|----------|----------|------------|
| 컨텍스트 부족 | 에이전트가 잘못된 파일/심볼 참조 | "이 N개 파일에 집중" — 파일 목록 재선정 | Phase 5 재시도 (CONSENSUS 유지) |
| 잘못된 방향 | 구현이 CONSENSUS와 불일치 | CONSENSUS 부분 무효화 + 재합의 | Phase 4 재진입 (해당 팀만) |
| 요구사항 오해 | 결과가 사용자 의도와 불일치 | 요구사항 재명확화 | Phase 1 재진입 (§10-1 전체 무효화) |
| 기술적 장벽 | API 미지원, 라이브러리 한계 | 대안 접근 탐색 + 팀 재구성 | Phase 3 재진입 (해당 팀 무효화) |
| CCB 타임아웃 | soft 3min 미응답 → hard 10min | pend 재확인 → LEAD DECISION 에스컬레이션 | Phase 4 (hive-consensus §4) |

#### 실패 분석 프로세스

```
Phase 5 실패 감지
  ↓
Step 1: 원인 분류 (위 표 기준)
  ↓
Step 2: 프롬프트 재작성
  - 컨텍스트 부족 → 파일 선택 알고리즘(hive-spawn-templates §3) 재실행
  - 잘못된 방향 → CONSENSUS 변경 사항을 새 프롬프트에 명시
  - 요구사항 오해 → AskUserQuestion으로 사용자 재확인
  ↓
Step 3: 패턴 기록 (auto-memory 활용)
  성공: "이 프롬프트 구조가 {작업 유형}에 효과적"
  실패: "Codex에게 {X}는 타입 정의 사전 제공 필수"
  ↓
Step 4: 재진입 (무효화 매트릭스 §10-1 참조)
```

#### 재시도 제한

- 동일 팀 최대 3회 재시도
- 3회 실패 시 AskUserQuestion:
  Options: A. 리드가 직접 처리 B. 해당 팀 제외 C. 전체 중단
```

### Step 3: 변경 검증

Run: `wc -l skills/hive-workflow/SKILL.md`
Expected: ≤500 lines

### Step 4: Commit

```bash
git add skills/hive-workflow/SKILL.md
git commit -m "feat(hive-workflow): add Failure Analysis mechanism (Ralph Loop V2)

Replace simple failure table with structured failure classification,
prompt rewriting, pattern recording, and targeted phase re-entry.
Compress Phase 1 question bank to stay within line budget."
```

---

## Task 2: 교차 에이전트 피드백 루프

**Files:**
- Modify: `skills/hive-workflow/SKILL.md:470-486` (5-3 결과 수집 → 교차 피드백 추가)
- Modify: `skills/hive-consensus/SKILL.md:429-448` (§12 뒤에 §13 추가)

### Step 1: hive-workflow 5-3에 교차 피드백 추가

**old_string** (lines 484-486, 5-3 마지막):
```markdown
Wave 완료 조건: 해당 Wave 모든 팀 completed → 다음 Wave 실행
```
```

**new_string**:
```markdown
Wave 완료 조건: 해당 Wave 모든 팀 completed → 다음 Wave 실행
```

### 5-3a. 교차 에이전트 피드백 (Cross-Agent Feedback)

Wave N+1 에이전트가 Wave N 결과에서 문제를 발견한 경우:

```
Wave 1: Codex 구현 완료
Wave 2: Gemini 테스트 작성 → Codex 코드에서 버그 발견
  ↓
[CROSS_FEEDBACK — T3→T2 — W2]
  - 발견 팀: T3 (Gemini)
  - 대상 팀: T2 (Codex)
  - 문제: {구체적 버그/이슈}
  - 영향: {어떤 테스트가 실패하는지}
  ↓
리드 판단:
  A. 경미 → 리드가 직접 수정 (Phase 5 내 처리)
  B. 중대 → T2에게 수정 요청 (/ask codex + correlation key)
           → T3 테스트 재실행으로 검증
  C. 설계 결함 → Phase 4 해당 팀 재합의 (§10-1 적용)
```

교차 피드백은 **Wave 간에만** 발생 (동일 Wave 내 팀은 독립).
리드는 `[CROSS_FEEDBACK]` 수신 시 반드시 판단 + 조치 (무시 금지).
```

### Step 2: hive-consensus에 §13 CROSS_FEEDBACK 마커 추가

`skills/hive-consensus/SKILL.md` 파일 끝(448줄 뒤)에 추가:

**append after line 449**:
```markdown

---

## 13. CROSS_FEEDBACK 프로토콜 (Phase 5 교차 피드백)

Phase 5 실행 중 후속 Wave 에이전트가 선행 Wave 결과의 문제를 발견한 경우.

### 13-1. 마커 형식

```markdown
[CROSS_FEEDBACK — {발견 팀 ID}→{대상 팀 ID} — {wave_id}]
- 문제 유형: bug | performance | security | consensus_violation
- 상세: {구체적 설명}
- 영향 파일: {파일 목록}
- 재현: {테스트 코드 또는 재현 단계}
```

### 13-2. 리드 의무

| 문제 심각도 | 리드 대응 |
|------------|----------|
| 경미 (스타일, 네이밍) | 리드 직접 수정 또는 무시 |
| 중대 (로직 버그, 테스트 실패) | 대상 팀에 수정 요청 → 발견 팀이 재검증 |
| 치명 (설계 결함, 보안) | Phase 4 해당 팀 재합의 (§10-1 무효화 적용) |

수정 요청 시 correlation key: `[FIX_REQUEST — {대상 팀 ID} — {wave_id} — ref:{CROSS_FEEDBACK message_id}]`
```

### Step 3: 변경 검증

Run: `wc -l skills/hive-workflow/SKILL.md skills/hive-consensus/SKILL.md`
Expected: hive-workflow ≤500, hive-consensus ≤475

### Step 4: Commit

```bash
git add skills/hive-workflow/SKILL.md skills/hive-consensus/SKILL.md
git commit -m "feat(hive): add Cross-Agent Feedback protocol

Add [CROSS_FEEDBACK] marker for inter-wave bug reporting.
Lead must triage severity and dispatch fix requests.
New hive-consensus §13 defines marker format and obligations."
```

---

## Task 3: Variable Sourcing 알고리즘

**Files:**
- Modify: `skills/hive-spawn-templates/SKILL.md:54-55` (§2 리드 행동 가이드 앞에 §3 삽입)

### Step 1: §3 Variable Sourcing 알고리즘 추가

`skills/hive-spawn-templates/SKILL.md`의 현재 §2 앞(line 56)에 새 섹션 삽입.

**old_string** (line 56-58):
```markdown
---

## 2. 리드 행동 가이드
```

**new_string**:
```markdown
---

## 3. Variable Sourcing 알고리즘

리드가 `{{FILE_PATH_N}}`과 `{{FILE_N_CONTENT}}`를 선택하는 기준.

### 3-1. 파일 선택 우선순위

```
1순위: Phase 2 Serena 영향 범위 맵의 수정 대상 파일
       → impact_map.modules[].files에서 직접 수정이 필요한 파일
2순위: 의존성 그래프의 인터페이스/타입 파일
       → import되는 타입 시그니처, abstract class, enum 정의
3순위: 기존 테스트 파일 (패턴 참조용)
       → 동일 모듈의 기존 test 파일 → 테스트 스타일/모킹 패턴 참조
4순위: 설정/라우트 파일 (변경이 필요한 경우)
       → router, DI 설정, pubspec 등
```

### 3-2. 파일 수 제한 및 분할

```
파일 5개 이하: 단일 /ask로 전송
파일 6-10개: 2회 분할 (의존성 순서로 묶음)
  - 1차: foundation 파일 (모델, 인터페이스, 타입)
  - 2차: feature 파일 (서비스, 뷰모델, 위젯)
파일 11개+: 팀 재분할 검토 (Phase 3 재진입 권장)
```

### 3-3. 콘텐츠 발췌 기준

```
파일 200줄 이하: 전체 포함
파일 200줄 초과: 관련 섹션만 발췌
  - 수정 대상 함수/클래스 ± 10줄 컨텍스트
  - import 블록 전체
  - 참조되는 타입 정의
발췌 시 "// ... (생략)" 마커로 생략 위치 표시
```

---

## 2. 리드 행동 가이드
```

### Step 2: 기존 §2를 §4로 리넘버링

hive-spawn-templates의 기존 "## 2. 리드 행동 가이드"를 "## 4. 리드 행동 가이드"로 변경.
(새 §3이 삽입되었으므로 기존 §2 → §4)

**old_string**:
```markdown
## 2. 리드 행동 가이드
```

**new_string**:
```markdown
## 4. 리드 행동 가이드
```

그리고 기존 §2 내의 하위 참조도 업데이트:
- "2-1. 합의 단계" → "4-1. 합의 단계"
- "2-2. 구현 단계" → "4-2. 구현 단계"

### Step 3: 변경 검증

Run: `wc -l skills/hive-spawn-templates/SKILL.md`
Expected: ~170 lines

### Step 4: Commit

```bash
git add skills/hive-spawn-templates/SKILL.md
git commit -m "feat(hive-spawn-templates): add Variable Sourcing algorithm

Define file selection priority, splitting strategy, and content
extraction rules for {{FILE_PATH_N}} and {{FILE_N_CONTENT}} variables.
Renumber existing sections for consistency."
```

---

## Task 4: 컨텍스트 예산 원칙

**Files:**
- Modify: `skills/hive-workflow/SKILL.md:299-302` (Phase 2 원칙 뒤에 추가)
- Modify: `skills/hive-spawn-templates/SKILL.md:9-11` (§1 변수 정의 앞에 원칙 삽입)

### Step 1: hive-workflow Phase 2에 컨텍스트 예산 원칙 추가

**old_string** (lines 299-303):
```markdown
원칙:
- **최소 토큰**: `include_body=false`로 시작, 필요한 심볼만 `include_body=true`
- **Serena 우선**: Read로 전체 파일 읽기 대신 심볼 단위 탐색
- **영향 범위 맵이 Phase 3의 입력**
```

**new_string**:
```markdown
원칙:
- **최소 토큰**: `include_body=false`로 시작, 필요한 심볼만 `include_body=true`
- **Serena 우선**: Read로 전체 파일 읽기 대신 심볼 단위 탐색
- **영향 범위 맵이 Phase 3의 입력**
- **컨텍스트 예산** (제로섬 원칙):
  - 리드: 요구사항 + 아키텍처 + 의존성 맵 유지 (비즈니스 컨텍스트)
  - Claude 에이전트: 모듈 심볼 + 의존성 (worktree로 추가 탐색 가능)
  - Codex: 수정 대상 코드 + 타입 시그니처만 (최소 컨텍스트 — hive-spawn-templates §3)
  - Gemini: 요약 컨텍스트 + 참조 패턴 (대량 작업 최적화)
```

### Step 2: hive-spawn-templates에 컨텍스트 예산 원칙 섹션 추가

**old_string** (lines 12-13):
```markdown
- Gemini 에이전트 템플릿: [templates/gemini-agent.md](templates/gemini-agent.md)

---
```

**new_string**:
```markdown
- Gemini 에이전트 템플릿: [templates/gemini-agent.md](templates/gemini-agent.md)

---

## 2. 컨텍스트 예산 원칙 (Context Budget — Zero-Sum)

> 컨텍스트 윈도우는 제로섬이다. 코드로 채우면 비즈니스 컨텍스트가 사라지고, 비즈니스로 채우면 코드 공간이 없다.

| 역할 | 컨텍스트 우선 | 포함 | 제외 |
|------|-------------|------|------|
| 리드 (오케스트레이터) | 비즈니스 + 아키텍처 | 요구사항, 의존성 맵, CONSENSUS, 팀 상태 | 전체 파일 내용 (Serena 심볼로 대체) |
| Claude 에이전트 | 모듈 심볼 + 설계 | MODULE_SYMBOLS, DEPENDENCIES, CONSENSUS | 무관한 모듈 코드, 전체 프로젝트 구조 |
| Codex 에이전트 | 수정 대상 코드 | 함수/클래스 코드, 타입 시그니처, import | 아키텍처 설명, 비즈니스 컨텍스트, 무관 파일 |
| Gemini 에이전트 | 요약 + 패턴 | 요구사항 요약, 참조 테스트 패턴, 체크리스트 | 전체 코드, 상세 심볼 정보 |

**적용 시점**: Phase 5에서 spawn-templates 변수 치환 시 이 예산을 기준으로 컨텍스트 양을 조절한다.

---
```

### Step 3: hive-spawn-templates 섹션 번호 조정

새 §2 삽입으로 기존 번호 재조정:
- §1 변수 정의 (유지)
- §2 컨텍스트 예산 원칙 (NEW)
- §3 Variable Sourcing 알고리즘 (Task 3에서 추가)
- §4 리드 행동 가이드 (기존 §2)

### Step 4: 변경 검증

Run: `wc -l skills/hive-workflow/SKILL.md skills/hive-spawn-templates/SKILL.md`
Expected: hive-workflow ≤500, hive-spawn-templates ~185

### Step 5: Commit

```bash
git add skills/hive-workflow/SKILL.md skills/hive-spawn-templates/SKILL.md
git commit -m "feat(hive): add Context Budget principle (Zero-Sum)

Formalize context window management: lead holds business context,
agents get only their domain-specific context.
Provider-specific budget table in hive-spawn-templates."
```

---

## Task 5: 최종 검증

### Step 1: 라인 수 확인

Run:
```bash
wc -l skills/hive-workflow/SKILL.md skills/hive-consensus/SKILL.md skills/hive-spawn-templates/SKILL.md
```

Expected:
- hive-workflow: ≤500
- hive-consensus: ≤475
- hive-spawn-templates: ≤190

### Step 2: 마크다운 구조 검증

Run:
```bash
bash scripts/validate-plugin.sh
bash scripts/validate-standards.sh
```

Expected: All checks PASS

### Step 3: 교차 참조 확인

검증 항목:
- hive-workflow 5-4에서 "hive-spawn-templates §3" 참조 → §3이 존재하는지
- hive-consensus §13에서 "§10-1 무효화 적용" 참조 → §10-1이 존재하는지
- hive-spawn-templates §2에서 Phase 5 참조 → hive-workflow §5와 일치하는지

### Step 4: Final Commit (모든 태스크 통합 후)

```bash
git add -A
git commit -m "feat(hive): v2.1.0 — integrate multi-agent design philosophy

4 improvements from Obsidian design philosophy analysis:
1. Failure Analysis mechanism (Ralph Loop V2) — hive-workflow §5-4
2. Cross-Agent Feedback protocol — hive-consensus §13
3. Variable Sourcing algorithm — hive-spawn-templates §3
4. Context Budget principle — hive-workflow §2, hive-spawn-templates §2"
```

---

## 실행 순서 요약

```
Task 1 (실패 분석) → hive-workflow 수정 (질문 은행 압축 + 5-4 교체)
  ↓
Task 2 (교차 피드백) → hive-workflow 5-3a 추가 + hive-consensus §13 추가
  ↓
Task 3 (Variable Sourcing) → hive-spawn-templates §3 추가 + 섹션 리넘버링
  ↓
Task 4 (컨텍스트 예산) → hive-workflow Phase 2 추가 + hive-spawn-templates §2 추가
  ↓
Task 5 (최종 검증) → 라인 수 + 구조 + 교차 참조 검증
```

Task 3과 4는 hive-spawn-templates를 동시에 수정하므로 순서 의존성 있음 (Task 3 → Task 4).
Task 1과 2는 hive-workflow를 동시에 수정하지만 다른 섹션이므로 순차 실행.
