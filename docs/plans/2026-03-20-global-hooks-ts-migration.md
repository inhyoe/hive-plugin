# Global Hooks TypeScript Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `~/.claude/hooks/`의 복잡한 bash hook 10개를 TypeScript 엔진(`~/.claude/hooks/engine/`)으로 전환하여 타입 안전성, 테스트 가능성, 유지보수성 확보

**Architecture:** 단일 CLI 엔트리포인트 + 핸들러 모듈 패턴 (hive enforcer와 동일). `lib/` 공유 라이브러리(violation-registry 원자적 업데이트, stdin 파싱, transcript 분석)로 중복 제거. 기존 bash 스크립트는 `~/.claude/hooks/archive/`로 이동하여 백업.

**Tech Stack:** TypeScript 5.7+, Node.js (built-in modules only), Vitest 4.x, ES2022 target

---

## Context

글로벌 hook 17개 중 10개가 복잡한 JSON 파싱, regex 패턴 매칭, 공유 상태(violation-registry.json)를 사용. 특히 stop.sh(297 LOC, 28개 regex, 42개 분기)가 가장 취약. plan-gate.sh는 worktree PWD 문제로 실제 장애 경험. 3개 hook(plan-gate, git-safety, stop)이 violation-registry.json을 flock 기반으로 동시 접근.

## Scope

**전환 대상 (10개, 우선순위순):**

| 우선순위 | Script | LOC | Event | 핵심 이유 |
|---------|--------|-----|-------|-----------|
| P1 | stop.sh | 297 | Stop | 28개 regex, 42개 분기, violation-registry |
| P1 | plan-gate.sh | 110 | PreToolUse | worktree PWD 버그, violation-registry |
| P1 | git-safety.sh | 90 | PreToolUse | violation-registry, git push 감지 |
| P2 | brainstorm-gate.sh | 88 | UserPromptSubmit | regex 패턴 매칭 |
| P2 | user-prompt-submit.sh | 83 | UserPromptSubmit | 관련 기능, marker 관리 |
| P2 | session-start.sh | 139 | SessionStart | filesystem 탐색, JSON 조립 |
| P3 | validate-skills.sh | 136 | PostToolUse | grep JSON fallback, flock |
| P3 | obsidian-blog-on-merge.sh | 120 | PostToolUse | fragile regex, sed YAML |
| P3 | obsidian-session-start.sh | 33 | SessionStart | sed YAML 파싱 |
| P3 | obsidian-post-commit.sh | 36 | PostToolUse | sed YAML 파싱 |

**유지 (Bash, 변환 불필요):**
auto-approve-plan.sh, pre-tool-use.sh, semantic-analysis.sh, obsidian-correction-detect.sh, obsidian-session-end.sh, obsidian-pre-commit.sh, setup-dashboard.sh

## Critical Files

**신규 생성:**
- `~/.claude/hooks/engine/package.json`
- `~/.claude/hooks/engine/tsconfig.json`
- `~/.claude/hooks/engine/vitest.config.ts`
- `~/.claude/hooks/engine/src/lib/stdin.ts` — JSON stdin 파싱 (DRY)
- `~/.claude/hooks/engine/src/lib/violations.ts` — violation-registry 원자적 읽기/쓰기
- `~/.claude/hooks/engine/src/lib/transcript.ts` — transcript 분석 유틸
- `~/.claude/hooks/engine/src/lib/obsidian.ts` — CLAUDE.md에서 obsidian folder 추출
- `~/.claude/hooks/engine/src/handlers/stop.ts` — Stop hook 8개 체크
- `~/.claude/hooks/engine/src/handlers/plan-gate.ts` — plan approval marker 검증
- `~/.claude/hooks/engine/src/handlers/git-safety.ts` — git push main/master 차단
- `~/.claude/hooks/engine/src/handlers/brainstorm-gate.ts` — 구현 요청 감지
- `~/.claude/hooks/engine/src/handlers/user-prompt-submit.ts` — approval marker + vague nudge
- `~/.claude/hooks/engine/src/handlers/session-start.ts` — resource registry + active recall
- `~/.claude/hooks/engine/src/handlers/validate-skills.ts` — SKILL quality gate
- `~/.claude/hooks/engine/src/handlers/obsidian-blog-on-merge.ts` — PR merge 블로그 감지
- `~/.claude/hooks/engine/src/handlers/obsidian-hooks.ts` — session-start + post-commit (합본)
- `~/.claude/hooks/engine/src/index.ts` — CLI 엔트리포인트
- `~/.claude/hooks/engine/dist/` — 빌드 산출물

**수정:**
- `~/.claude/settings.json` — bash → node 명령 교체

**백업:**
- `~/.claude/hooks/archive/` — 원본 bash 스크립트 이동

---

## Tasks

### Task 1: Scaffold ~/.claude/hooks/engine package

**Files:** Create `package.json`, `tsconfig.json`, `vitest.config.ts`

**Step 1:** Create package.json (type:module, devDeps: typescript ^5.7.0, vitest ^4.1.0, @types/node)
**Step 2:** Create tsconfig.json (ES2022, bundler resolution, strict, outDir:dist, rootDir:src)
**Step 3:** Create vitest.config.ts (include: `__tests__/**/*.test.ts`)
**Step 4:** `cd ~/.claude/hooks/engine && npm install`
**Step 5:** Commit "chore: scaffold global hooks engine"

---

### Task 2: Shared lib — stdin.ts — TDD

**Files:** Create `__tests__/lib/stdin.test.ts`, `src/lib/stdin.ts`

**Step 1:** Write failing test — extractCommand, extractPrompt, extractAgentInfo, extractToolName, extractFilePath, extractSessionId, extractCwd, extractTranscriptPath, extractStopHookActive, parseStdin (safe JSON.parse)
**Step 2:** Run test → FAIL
**Step 3:** Implement — 타입 안전 JSON 파싱, 모든 hook에서 재사용
**Step 4:** Run test → PASS
**Step 5:** Commit "feat: add shared stdin parsing library"

---

### Task 3: Shared lib — violations.ts — TDD

**Files:** Create `__tests__/lib/violations.test.ts`, `src/lib/violations.ts`

**Step 1:** Write failing test — readRegistry, updateViolationCount (원자적 flock 대체), readRetryState, recordRetry, wasRaised, shouldBlock (critical vs standard), updateQualityBaseline
**Step 2:** Run test → FAIL
**Step 3:** Implement — fs 기반 원자적 업데이트 (writeFileSync + rename), retry state 관리
**Step 4:** Run test → PASS
**Step 5:** Commit "feat: add violation registry manager"

---

### Task 4: Shared lib — transcript.ts — TDD

**Files:** Create `__tests__/lib/transcript.test.ts`, `src/lib/transcript.ts`

**Step 1:** Write failing test — readRecentTranscript(path, lines), countToolUses(text), countFileEdits(text), countSkillCalls(text), hasPattern(text, pattern), extractLastMessage(text)
**Step 2:** Run test → FAIL
**Step 3:** Implement — 파일 읽기 + regex 기반 카운팅
**Step 4:** Run test → PASS
**Step 5:** Commit "feat: add transcript analysis library"

---

### Task 5: Shared lib — obsidian.ts — TDD

**Files:** Create `__tests__/lib/obsidian.test.ts`, `src/lib/obsidian.ts`

**Step 1:** Write failing test — extractObsidianFolder(claudeMdPath) (정확한 YAML folder 추출, sed 대체), hasObsidianMapping(claudeMdPath)
**Step 2:** Run test → FAIL
**Step 3:** Implement — 정규식 기반 YAML 파싱 (sed 취약점 제거)
**Step 4:** Run test → PASS
**Step 5:** Commit "feat: add obsidian folder extraction library"

---

### Task 6: plan-gate handler — TDD

**Files:** Create `__tests__/handlers/plan-gate.test.ts`, `src/handlers/plan-gate.ts`

**Step 1:** Write failing test:
- Edit/Write만 체크, 다른 도구 패스스루
- 예외: plans/, ObsidianVault/, .claude/hooks/, memory/, skills/, sisyphus/
- session marker 존재 → 허용
- project marker 존재 → 허용 (git worktree 감지: `git rev-parse --show-toplevel`로 원본 경로 해시도 체크)
- marker 없음 → deny + violation 카운트
**Step 2:** Run test → FAIL
**Step 3:** Implement — worktree 감지 로직 포함 (기존 bash의 PWD 버그 수정)
**Step 4:** Run test → PASS
**Step 5:** Commit "feat: implement plan-gate handler with worktree fix"

---

### Task 7: git-safety handler — TDD

**Files:** Create `__tests__/handlers/git-safety.test.ts`, `src/handlers/git-safety.ts`

**Step 1:** Write failing test:
- Bash만 체크
- `git push main/master` → deny
- `git push` (plain, on main branch) → deny
- `git push --force` → warn (additionalContext)
- `git push origin feat/x` → 허용
- non-git commands → 패스스루
**Step 2:** Run test → FAIL
**Step 3:** Implement
**Step 4:** Run test → PASS
**Step 5:** Commit "feat: implement git-safety handler"

---

### Task 8: stop handler — TDD

**Files:** Create `__tests__/handlers/stop.test.ts`, `src/handlers/stop.ts`

**Step 1:** Write failing test:
- stop_hook_active → 즉시 종료
- Check 1: 완료 주장 + 도구 증거 없음 → block
- Check 2: feature 작업 + skill 미호출 → block, debug → advisory, test → block
- Check 3: 5+ 파일 수정 + agent 없음 → advisory
- Check 4: 요청된 skill 미호출 → block
- Check 5: "불가능" 주장 → always block (critical)
- Check 6: 10+ 파일 + review 없음 → block
- Check 7: 질문 후 수정 → violation count (no block)
- Check 8: UI 수정 + spec 미확인 → violation count
- Quality baseline 업데이트
- Session marker 정리
- Retry budget: 첫 위반만 block, 반복 시 downgrade (critical 제외)
**Step 2:** Run test → FAIL
**Step 3:** Implement — 8개 체크 + retry budget + quality baseline
**Step 4:** Run test → PASS
**Step 5:** Commit "feat: implement stop handler with 8 checks"

---

### Task 9: brainstorm-gate handler — TDD

**Files:** Create `__tests__/handlers/brainstorm-gate.test.ts`, `src/handlers/brainstorm-gate.ts`

**Step 1:** Write failing test:
- 짧은 입력(< 5자) → 스킵
- slash 명령 → 스킵
- plan approved marker 존재 → 스킵
- 승인/확인 패턴 → 스킵
- "그냥 진행해" → 스킵
- 인사말 → 스킵
- 순수 질문 (구현 의도 없음) → 스킵
- 구현 요청 패턴 → additionalContext 주입
**Step 2:** Run test → FAIL
**Step 3:** Implement
**Step 4:** Run test → PASS
**Step 5:** Commit "feat: implement brainstorm-gate handler"

---

### Task 10: user-prompt-submit handler — TDD

**Files:** Create `__tests__/handlers/user-prompt-submit.test.ts`, `src/handlers/user-prompt-submit.ts`

**Step 1:** Write failing test:
- 빈 입력/slash 명령 → 패스스루
- 승인 패턴 → marker 생성 + 패스스루
- "그냥 진행해" → marker 생성
- 마이크로 변경 패턴 → marker 생성
- 인사말 → 패스스루
- 짧은 모호한 요청(< 10자, 동사 없음) → additionalContext
**Step 2:** Run test → FAIL
**Step 3:** Implement
**Step 4:** Run test → PASS
**Step 5:** Commit "feat: implement user-prompt-submit handler"

---

### Task 11: session-start handler — TDD

**Files:** Create `__tests__/handlers/session-start.test.ts`, `src/handlers/session-start.ts`

**Step 1:** Write failing test:
- skills 수집 (디렉토리 탐색, MAX 50개)
- agents 수집
- MCP 서버 수집 (settings.json 파싱)
- TEAM capabilities 수집
- violation patterns top 5 (violation-registry.json 읽기)
- quality baseline 주입
- 빈 결과 → {} 반환
**Step 2:** Run test → FAIL
**Step 3:** Implement
**Step 4:** Run test → PASS
**Step 5:** Commit "feat: implement session-start handler"

---

### Task 12: validate-skills handler — TDD

**Files:** Create `__tests__/handlers/validate-skills.test.ts`, `src/handlers/validate-skills.ts`

**Step 1:** Write failing test:
- Edit/Write만 체크
- 패턴: skills/*/SKILL.md, .claude-plugin/*, marketplace.json → 검증 실행
- 비매칭 파일 → 스킵
- debounce (3초 이내 재실행 차단)
- validate-all.sh 실행 + exit code 반환
**Step 2:** Run test → FAIL
**Step 3:** Implement — debounce는 timestamp 파일 기반 (기존과 동일하지만 TS)
**Step 4:** Run test → PASS
**Step 5:** Commit "feat: implement validate-skills handler"

---

### Task 13: obsidian-hooks handler — TDD

**Files:** Create `__tests__/handlers/obsidian-hooks.test.ts`, `src/handlers/obsidian-hooks.ts`

**Step 1:** Write failing test:
- obsidian-session-start: CLAUDE.md에서 folder 추출 → systemMessage 생성
- obsidian-post-commit: git commit 감지 → sync 지시 systemMessage
- obsidian-blog-on-merge: gh pr merge 감지 → 6개 기술 신호 분석 → 2+ 시 blog-draft 지시
- CLAUDE.md 없음/obsidian 매핑 없음 → 스킵
**Step 2:** Run test → FAIL
**Step 3:** Implement — lib/obsidian.ts 활용
**Step 4:** Run test → PASS
**Step 5:** Commit "feat: implement obsidian hooks handler"

---

### Task 14: CLI entry point — TDD

**Files:** Create `src/index.ts`, `__tests__/index.test.ts`

**Step 1:** Implement index.ts — readStdin(), handler name from argv[2], dispatch, exit code. Fatal → exit 0.
**Step 2:** Build: `npm run build`
**Step 3:** Write integration test — 각 핸들러 CLI 실행 + exit code 검증
**Step 4:** Run test → PASS
**Step 5:** Commit "feat: add CLI entry point"

---

### Task 15: Build + dist tracking

**Step 1:** `npm run build`
**Step 2:** dist/ 구조 검증
**Step 3:** Commit "build: compile global hooks engine dist/"

---

### Task 16: E2E scenario tests

**Files:** Create `__tests__/e2e-scenarios.test.ts`

**Step 1:** Write E2E tests:
- Scenario A: plan-gate — marker 없음 → deny, marker 생성 → allow, 예외 경로 → allow
- Scenario B: stop — 완료 주장 + 증거 없음 → block, retry budget → downgrade
- Scenario C: git-safety — push main → deny, push feature → allow
- Scenario D: brainstorm + user-prompt-submit 연계 — 구현 요청 → brainstorm hint, 승인 → marker 생성 → plan-gate pass
- Scenario E: obsidian 연계 — session-start → context 로드, post-commit → sync 지시
**Step 2:** Run → PASS
**Step 3:** Commit "test: add E2E scenario tests"

---

### Task 17: Wire hooks in settings.json + archive bash

**Step 1:** `mkdir -p ~/.claude/hooks/archive/` && 원본 bash 10개 이동
**Step 2:** `~/.claude/settings.json` 수정 — bash → `node ~/.claude/hooks/engine/dist/index.js <handler>`
**Step 3:** 검증: 각 핸들러 manual test
**Step 4:** Commit "feat: wire TS hooks, archive bash originals"

---

### Task 18: Final validation

**Step 1:** `cd ~/.claude/hooks/engine && npx vitest run` — 모든 테스트 통과
**Step 2:** Manual E2E 5개 시나리오 검증
**Step 3:** Commit "chore: final validation pass"

---

## Verification

```bash
# 1. Engine unit tests
cd ~/.claude/hooks/engine && npx vitest run

# 2. Manual: plan-gate deny
echo '{"tool_name":"Write","tool_input":{"file_path":"/tmp/test.ts"}}' | node ~/.claude/hooks/engine/dist/index.js plan-gate
# Exit code: deny output

# 3. Manual: git-safety deny push main
echo '{"tool_name":"Bash","tool_input":{"command":"git push origin main"}}' | node ~/.claude/hooks/engine/dist/index.js git-safety
# Exit code: deny output

# 4. Manual: stop block on no evidence
echo '{"transcript_path":"/tmp/empty","stop_hook_active":false}' | node ~/.claude/hooks/engine/dist/index.js stop
# Block output

# 5. Manual: brainstorm-gate on impl request
echo '{"prompt":"새 기능 만들어줘","session_id":"test"}' | node ~/.claude/hooks/engine/dist/index.js brainstorm-gate
# Additional context output
```

## Execution Options

**Subagent-Driven (this session)**: Task별 fresh subagent 디스패치, 태스크 간 코드 리뷰
**Parallel Session**: 별도 세션에서 executing-plans로 배치 실행
