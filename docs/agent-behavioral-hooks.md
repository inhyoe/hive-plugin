# AI Agent Behavioral Hooks — 플랫폼 무관 규칙서

> Claude Code 훅 시스템에서 추출한 행동 규칙.
> Codex, Gemini, OpenCode, Cursor 등 모든 AI 에이전트에 동일 적용 가능.

---

## 목차

1. [핵심 원칙](#1-핵심-원칙)
2. [워크플로우 강제](#2-워크플로우-강제)
3. [안전 게이트](#3-안전-게이트)
4. [품질 보증](#4-품질-보증)
5. [입력 분석](#5-입력-분석)
6. [지식 관리](#6-지식-관리-obsidian)
7. [세션 부트스트랩](#7-세션-부트스트랩)
8. [구현 가이드](#8-플랫폼별-구현-가이드)

---

## 1. 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **Plan Before Code** | 코드 수정 전 반드시 명확화 + 계획 수립 |
| **No Bypass** | 권한 우회 모드에서도 규칙 적용 |
| **Hard Gate > Soft Nudge** | 위험 행위는 차단, 개선 가능 행위는 안내 |
| **Retry Budget** | 동일 경고는 1회만 차단, 2회째부터 경고로 전환 (critical 제외) |
| **Self-Audit** | 세션 종료 시 자체 점검 수행 |

---

## 2. 워크플로우 강제

### 2-1. Brainstorm Gate (입력 시점)

```
시점: 사용자 메시지 수신 직후 (코드 작성 전)
조건: 구현 요청 감지 AND 계획 마커 미존재
동작: Plan Mode 강제 진입 → 명확화 → 계획 수립 → 즉시 구현
```

**구현 요청 감지 패턴:**

```
# 한국어
만들어|구현|추가해|개발|작성해|수정해|고쳐|바꿔|변경해|리팩토링
새.*기능|새.*화면|새.*페이지|새.*컴포넌트
버그.*수정|에러.*수정|훅.*만들|설정해|세팅

# 영어
create|implement|add.*feature|build|develop|fix|modify
change|refactor|setup|write.*code
```

**제외 패턴:**
- 순수 질문 (`왜`, `어떻게`, `뭐가` + 구현 동사 없음)
- 승인/확인 (`네`, `좋아`, `진행해`, `ok`)
- 인사 (`안녕`, `감사`, `hello`)
- 마이크로 변경 (`오타 수정`, `이름 바꿔`, `한줄 수정`)
- 슬래시 커맨드 (`/`로 시작)

**에이전트 행동 규칙:**
```
1. Plan Mode(또는 동등한 계획 단계)에 진입
2. 모호한 점이 있으면 사용자에게 질문
3. 변경 대상 파일, 접근 방식, 범위를 명시한 계획 작성
4. 계획 완료 즉시 구현 시작 (사용자 승인 대기 불필요)
```

### 2-2. Plan Gate (코드 편집 시점)

```
시점: 파일 편집/생성 직전
조건: 계획 승인 마커가 없으면 차단
예외:
  - 계획 파일 자체 (.claude/plans/)
  - 설정/훅 파일 (.claude/hooks/, .claude/settings)
  - 메모리 파일 (.claude/projects/*/memory/)
  - 스킬 파일 (.claude/skills/)
  - 문서 파일 (ObsidianVault/)
```

**에이전트 행동 규칙:**
```
코드 파일을 수정하려 할 때:
  IF 이 세션에서 계획을 수립했는가?
    YES → 수정 허용
    NO  → "계획을 먼저 수립하세요" 후 Plan Mode 진입
```

### 2-3. Auto-Approve (계획 완료 시점)

```
시점: Plan Mode 종료 직후
동작: 계획 승인 마커 자동 생성
효과: 이후 모든 Edit/Write 허용
```

---

## 3. 안전 게이트

### 3-1. 민감 파일 보호 (Hard Block)

```
시점: 파일 편집 직전
동작: 무조건 차단 (예외 없음)
대상:
  - .env (단, .env.example은 허용)
  - credentials, secrets
  - *.pem, *.key, *.p12, *.jks, keystore
```

**에이전트 행동 규칙:**
```
절대 수정하지 않는 파일:
  - 환경 변수 (.env)
  - 인증서/키 파일 (*.pem, *.key)
  - 자격 증명 파일 (credentials.*, secrets.*)
사용자가 명시적으로 요청해도 거부하고 위험성 설명.
```

### 3-2. Git 안전 (main/master 보호)

```
시점: git 명령어 실행 직전
규칙:
  1. git push main/master → 차단 ("PR을 통해 병합하세요")
  2. 현재 브랜치가 main에서 git push → 차단
  3. --force push → 경고 (차단은 아님)
```

**에이전트 행동 규칙:**
```
- main/master 브랜치에 직접 push 금지
- 반드시 feature 브랜치 생성 → PR로 병합
- force push 시 사용자에게 경고 후 확인 요청
```

---

## 4. 품질 보증

### 4-1. 완료 선언 검증

```
시점: 에이전트 응답 완료 직전
조건: "완료/수정했/고쳤/done/fixed" 키워드 포함 시
검증:
  - 실제 도구 사용(편집/실행) 증거가 있는가?
  - 없으면 → "실제 변경/검증을 수행하세요"
```

**에이전트 행동 규칙:**
```
"완료"를 말하기 전:
  1. 실제로 코드를 수정했는가? (도구 사용 증거)
  2. 테스트/실행으로 검증했는가?
  3. UI 변경이면 결과를 보여주었는가?
하나라도 NO면 → 완료 선언 금지, 검증 먼저 수행.
```

### 4-2. "불가능" 판단 금지

```
시점: 응답에 "불가능/할 수 없/impossible" 포함 시
동작: 무조건 차단 (Critical — retry budget 없음)
규칙: 최소 3가지 대안을 실제로 시도한 후에만 "어렵습니다" 표현 허용
```

**에이전트 행동 규칙:**
```
"불가능"을 말하기 전:
  1. 대안 A 시도 → 실패 이유 명시
  2. 대안 B 시도 → 실패 이유 명시
  3. 대안 C 시도 → 실패 이유 명시
3개 모두 실패 시에만 "현재 조건에서 어렵습니다" + 각 시도 결과 제시.
```

### 4-3. 리뷰 요구

```
시점: 세션 중 3개 이상 파일 수정 시
동작: 코드 리뷰 수행 요구
```

### 4-4. 스킬/도구 사용 검증

```
시점: 응답 완료 시
검증:
  - 새 기능 작업 → scaffold/feature 스킬 사용했는가?
  - 테스트 작업 → test 스킬 사용했는가?
  - 시스템이 요구한 스킬을 실제로 호출했는가?
```

---

## 5. 입력 분석

### 5-1. 질문 ≠ 수정 요청

```
시점: 사용자 메시지 수신 시
규칙: "왜?", "이유가 뭐야?" → 설명만 제공, 코드 수정 금지
       "수정해", "고쳐", "바꿔" → 코드 수정 허용
```

**에이전트 행동 규칙:**
```
질문 동사: 왜, 어떻게, 뭐가, 원인, why, how, what
  → 원인/설명만 제공. 코드 변경 절대 금지.

수정 동사: 수정해, 고쳐, 바꿔, 해줘, fix, modify, change
  → 코드 수정 가능 (계획 수립 후).
```

### 5-2. 모호한 요청 개선

```
시점: 사용자 메시지 20자 미만
동작: 프롬프트 개선 제안 (차단은 아님)
```

### 5-3. UI 사양 확인

```
시점: UI/화면/위젯 구현 요청 시
조건: 색상/크기/간격 사양이 불명확
동작: 구현 전 사용자에게 사양 질문 (추측 구현 금지)
```

### 5-4. 버그 리포트 대응

```
시점: 사용자가 버그/에러/오작동 리포트 시
규칙: 사용자 경험 = 사실. "코드상 문제없다" 금지.
순서: 재현 → 로그 확인 → 코드 추적
```

### 5-5. 사용자 동사 리터럴 해석

```
| 사용자 발화     | 올바른 해석           | 잘못된 해석          |
|---------------|---------------------|-------------------|
| "테스트해봐"    | 실제로 실행해서 돌린다   | 테스트 코드 작성      |
| "돌려봐"       | 실제로 실행한다        | 실행 스크립트 작성     |
| "확인해"       | 직접 확인한다          | 검증 코드 작성       |
| "N회 반복"     | 실제로 N번 수행한다     | N개 테스트 케이스 작성  |
```

---

## 6. 지식 관리 (Obsidian)

> 이 섹션은 Obsidian 연동이 있는 프로젝트에만 적용.
> 다른 지식 관리 시스템(Notion, Wiki 등)에도 동일 패턴 적용 가능.

### 6-1. 세션 시작 — 컨텍스트 로드

```
시점: 세션 시작
조건: 프로젝트에 지식 저장소 매핑이 있으면
동작: _context.md (현재 상태, 최근 작업, 주의사항) 읽기
```

### 6-2. 교정 감지 — 학습 기록

```
시점: 사용자 메시지 수신 시
패턴: "아니", "틀렸", "그거 아니고", "wrong", "not that"
동작: 교정이 기술적으로 의미 있으면 learnings/ 노트 생성
```

### 6-3. 커밋 전 — 동기화 확인

```
시점: git commit 직전
동작: 지식 저장소 동기화 완료 확인. 미완료 시 차단.
```

### 6-4. 커밋 후 — 강제 동기화

```
시점: git commit 성공 직후
동작: sprint, decisions, tech, _context.md 갱신 지시
```

### 6-5. 세션 종료 — 자체 점검

```
시점: 에이전트 응답 완료 (마지막 응답 직전)
동작:
  1. 이 세션에서 교정/발견/의사결정이 있었는가?
  2. 있었으면 → learnings/ 또는 decisions/에 기록
  3. 없었으면 → "기록할 학습 없음" 1줄 명시
```

---

## 7. 세션 부트스트랩

### 7-1. 리소스 레지스트리

```
시점: 세션 시작
동작: 사용 가능한 리소스 목록을 컨텍스트에 주입
  - 스킬 목록
  - 에이전트 목록
  - MCP 서버 목록
  - 팀 역량 (멀티에이전트)
```

### 7-2. Active Recall (반복 위반 패턴)

```
시점: 세션 시작
동작: 과거 위반 기록에서 상위 5개를 컨텍스트에 주입
목적: 같은 실수를 반복하지 않도록 세션 시작 시 상기
형식: "[ACTIVE RECALL] 다음 규칙을 반드시 준수: - 규칙 (위반 N회)"
```

### 7-3. 품질 기준선

```
시점: 세션 시작/종료
동작: 리뷰율, E2E 검증율 등 품질 메트릭 추적
갱신: 세션 종료 시 이동평균으로 업데이트
```

---

## 8. 플랫폼별 구현 가이드

### Claude Code

이미 구현됨. `~/.claude/settings.json`의 `hooks` 섹션 참조.

| 훅 이벤트 | 스크립트 |
|----------|---------|
| SessionStart | `session-start.sh` (리소스 + Active Recall) |
| UserPromptSubmit | `user-prompt-submit.sh` (승인 감지 + 모호함 넛지) |
| UserPromptSubmit | `brainstorm-gate.sh` (구현 감지 → Plan Mode 강제) |
| PreToolUse (Edit\|Write) | `pre-tool-use.sh` (민감 파일 차단) |
| PreToolUse (Edit\|Write) | `plan-gate.sh` (계획 없이 편집 차단) |
| PreToolUse (Bash) | `git-safety.sh` (main push 차단) |
| PostToolUse (ExitPlanMode) | `auto-approve-plan.sh` (계획 후 자동 승인) |
| Stop | `stop.sh` (완료 검증 + 품질 게이트) |

### Codex / 다른 CLI 에이전트

```yaml
# AGENTS.md 또는 시스템 프롬프트에 삽입:

## Behavioral Rules (Non-Negotiable)

### Before Writing Code
1. Detect if the request is an implementation task
2. If yes: create a plan first (files, approach, scope)
3. If anything is ambiguous: ask the user before proceeding
4. After plan: implement immediately (no approval wait)

### Never Do
- Edit .env, credentials, key files
- Push directly to main/master
- Say "impossible" without trying 3 alternatives
- Modify code when user only asked a question
- Claim "done" without running/testing
- Guess UI specs (colors, sizes, spacing)

### Always Do
- Treat user bug reports as fact
- Interpret user verbs literally ("run it" = execute, not write code)
- Review when modifying 3+ files
- Record learnings when corrections happen
- Load project context at session start
```

### Cursor / Windsurf (IDE 에이전트)

```
.cursorrules 또는 동등한 규칙 파일에 위 AGENTS.md 내용을 삽입.
IDE 에이전트는 훅 시스템이 없으므로 시스템 프롬프트로 규칙을 주입.
```

### OpenAI Codex (자율 에이전트)

```
AGENTS.md에 위 규칙 삽입.
Codex는 sandbox에서 실행되므로:
- git safety → sandbox 정책으로 대체
- plan gate → AGENTS.md 규칙으로 대체
- 파일 보호 → .codexignore로 보완
```

---

## 부록: 훅 체인 흐름도

```
사용자 메시지 수신
  │
  ├─ UserPromptSubmit ─────────────────────────────────────
  │   ├─ user-prompt-submit.sh
  │   │   ├─ 승인/확인? → 마커 생성 → pass
  │   │   ├─ 마이크로 변경? → 마커 생성 → pass
  │   │   ├─ 인사? → pass
  │   │   └─ 모호한 짧은 요청? → "프롬프트 개선" 넛지
  │   │
  │   ├─ brainstorm-gate.sh
  │   │   ├─ 마커 있음? → pass
  │   │   ├─ 구현 요청? → "Plan Mode 진입하세요" 주입
  │   │   └─ 질문/인사/기타? → pass
  │   │
  │   └─ prompt hooks (질문≠수정, UI사양, 버그리포트, 프로세스)
  │
  ├─ Claude 처리 중...
  │   │
  │   ├─ Edit/Write 시도 시:
  │   │   ├─ pre-tool-use.sh → .env/credential 차단
  │   │   └─ plan-gate.sh → 마커 없으면 차단
  │   │
  │   ├─ Bash(git push) 시도 시:
  │   │   └─ git-safety.sh → main/master 차단
  │   │
  │   └─ ExitPlanMode 시:
  │       └─ auto-approve-plan.sh → 마커 자동 생성
  │
  └─ Stop (응답 완료)
      ├─ stop.sh
      │   ├─ 완료 증거 확인
      │   ├─ 스킬 호출 검증
      │   ├─ "불가능" 차단
      │   ├─ 리뷰 요구
      │   └─ 품질 기준선 갱신
      └─ 세션 학습 기록 확인
```

---

## 변경 이력

| 날짜 | 변경 |
|------|------|
| 2026-03-17 | 초기 작성 — Claude Code 훅에서 추출 |
| 2026-03-17 | brainstorm-gate + auto-approve-plan 추가 |
