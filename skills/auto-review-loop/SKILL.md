---
name: auto-review-loop
description: "Automated Codex review loop for PR code. Use on /auto-review-loop or '자동 리뷰'."
argument-hint: "[--max N] [--base branch]"
user-invocable: true
---

# Auto Review Loop

$ARGUMENTS

Codex 리뷰 → Claude 수정 → Codex 재검증 자동 반복 루프.
`/auto-review-loop [--max N] [--base branch]`

## Flow
P1 사전검증 → P2 리뷰요청 → P3 수정+검증 → P4 완료

## 종료
`NO ISSUES FOUND`→완료 | 동일이슈 2회→중단 | max도달→중단 | ping실패→중단/fallback | diff없음/5000줄+→중단

`$ARGUMENTS`에서 추출:
- `--max N`: 최대 반복 횟수. 기본 10. 최대 10.
- `--base BRANCH`: 비교 대상 브랜치. 기본: 자동 감지.

## 실행 흐름

```text
[Phase 1] 사전 검증: tmux-bridge status, 브랜치/diff 확인
[Phase 2] 리뷰 요청: autonew codex → ask codex "[REVIEW]" → 턴 종료
[Phase 3] 리뷰 대응: 파싱 → 수정 → commit → autonew → ask codex "[VERIFY]" → 턴 종료
[Phase 4] 완료: 이슈 0 → push 확인
```

## Phase 1: 사전 검증 (MANDATORY)

1. **Codex 연결 확인:**
   ```bash
   node hooks/tmux-bridge/dist/cli.js status --reconcile
   ```
   - 실패 시(빈 레지스트리): tmux-bridge `ask` 명령의 `ensureProvider()`가 자동 스폰하므로 **중단하지 않고 계속 진행**.
   - tmux 자체가 없는 경우에만 중단.

2. **베이스 브랜치 감지:**
   ```bash
   git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'
   ```
   `--base` 인자가 있으면 해당 값 사용. 감지 실패 시 `main` 사용.

3. **Diff 수집 (스크립트 사용):**
   ```bash
   bun run ${CLAUDE_SKILL_DIR}/scripts/diff-collector.ts --base {base_branch}
   ```
   JSON 출력에서 `empty`, `tooLarge`, `lineCount` 확인:
   - `empty: true` → "변경사항이 없습니다." 출력 후 **중단**.
   - `tooLarge: true` → "⚠️ diff가 너무 큽니다 ({lineCount}줄). 범위를 좁혀주세요." 출력 후 **중단**.

4. **상태 초기화 (스크립트 사용):**
   ```bash
   bun run ${CLAUDE_SKILL_DIR}/scripts/state-manager.ts --init --branch {current_branch} --base {base_branch} --max {max_iterations}
   ```

## Phase 2: 리뷰 요청

1. `autonew codex` 실행 — Codex 세션 클리어.
2. **리뷰 프롬프트 생성 (스크립트 사용):**
   ```bash
   bun run ${CLAUDE_SKILL_DIR}/scripts/prompt-builder.ts --type review --diff /tmp/auto-review-diff.txt
   ```
   diff 내용을 `/tmp/auto-review-diff.txt`에 저장 후 실행. 출력을 `review_prompt`로 사용.
3. 실행:
   ```bash
   Bash("$HIVE_PLUGIN_DIR/scripts/tmux-ask.sh codex '{review_prompt}' --purpose review --base {base_branch}")
   ```
4. 백그라운드 응답 수집:
   ```bash
   Bash("$HIVE_PLUGIN_DIR/scripts/tmux-pend.sh codex --timeout 300 --keep", run_in_background=true)
   ```
   → 사용자 개입 없이 Codex 응답 도착 시 자동 알림 → Phase 3 진행.
5. 출력: `Auto Review Loop 시작 — Codex processing...`

## Phase 3: 리뷰 대응 (백그라운드 pend 완료 시)

**IMPORTANT:** `run_in_background` pend가 완료되면 자동으로 Phase 3을 실행한다.
사용자 개입 불필요.

1. **응답 파싱 (스크립트 사용):**
   Codex 응답을 `/tmp/codex-response.txt`에 저장 후:
   ```bash
   bun run ${CLAUDE_SKILL_DIR}/scripts/review-parser.ts --input /tmp/codex-response.txt
   ```
   JSON 출력에서 `hasIssues`, `issues` 확인.
   - `hasIssues: false` → **Phase 4 (완료)** 진행.

2. **상태 확인 (스크립트 사용):**
   파싱된 이슈를 `/tmp/auto-review-issues.json`에 저장 후:
   ```bash
   bun run ${CLAUDE_SKILL_DIR}/scripts/state-manager.ts --check --state /tmp/auto-review-state-{branch}.json --issues /tmp/auto-review-issues.json
   ```
   JSON 출력에서 `shouldContinue`, `reason` 확인:
   - `reason: "duplicate issues"` → "⚠️ 동일 이슈가 반복되어 자동 수정이 어렵습니다:" + 목록 출력 → **중단**.
   - `reason: "max iterations"` → "🛑 최대 {max}회 반복 도달. 잔여 이슈:" + 목록 출력 → **중단**.

3. **이슈 수정:**
   - 각 이슈의 파일과 라인을 찾아 수정.
   - 수정 후:
     ```bash
     git add <수정된_파일들>
     git commit -m "fix(auto-review): <이슈 요약>

     Auto Review Loop iteration {N}

     Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
     ```

4. **재검증 요청:**
   - `autonew codex` 실행 — Codex 세션 클리어.
   - 상태 업데이트:
     ```bash
     bun run ${CLAUDE_SKILL_DIR}/scripts/state-manager.ts --update --state /tmp/auto-review-state-{branch}.json --issues /tmp/auto-review-issues.json
     ```
   - 검증 프롬프트 생성 (스크립트 사용):
     - `git diff HEAD~1..HEAD > /tmp/auto-review-fix.diff`
     ```bash
     bun run ${CLAUDE_SKILL_DIR}/scripts/prompt-builder.ts --type verify --diff /tmp/auto-review-fix.diff --issues /tmp/auto-review-issues.json
     ```
   - 실행:
     ```bash
     Bash("$HIVE_PLUGIN_DIR/scripts/tmux-ask.sh codex '{verify_prompt}' --purpose verify")
     ```
   - 백그라운드 응답 수집:
     ```bash
     Bash("$HIVE_PLUGIN_DIR/scripts/tmux-pend.sh codex --timeout 300 --keep", run_in_background=true)
     ```
   - 출력: `Auto Review Loop — Iteration {N}/{max} — Codex processing...`

5. 백그라운드 pend 완료 → Phase 3 처음부터 반복.

## Phase 4: 완료

1. 모든 이슈 해소됨. 사용자에게 확인:
   ```
   ✅ Auto Review Loop 완료
   - 반복: {N}회
   - 수정 커밋: {N}개
   - 상태: 모든 이슈 해소

   git push 할까요?
   ```
2. 사용자가 승인하면 `git push` 실행.

## Review Prompt Template (OMO Oracle 패턴)

`prompt-builder.ts`의 `buildReviewPrompt()`가 생성. 구조:

```xml
[REVIEW REQUEST]

<role>역할 정의 + 접근 방식</role>
<decision_framework>승인 편향, HIGH SIGNAL만, 최대 5개</decision_framework>
<tool_usage_rules>파일 직접 읽기, Serena MCP 활용, 추론 금지</tool_usage_rules>
<scope_discipline>보고하지 않을 것 목록</scope_discipline>
<output_verbosity_spec>### Issues 또는 NO ISSUES FOUND</output_verbosity_spec>
<high_risk_self_check>파일:라인 검증, 근거 확인, 단정 제거</high_risk_self_check>

--- DIFF START ---
{diff}
--- DIFF END ---
```

## Verify Prompt Template (OMO Oracle 경량)

`prompt-builder.ts`의 `buildVerifyPrompt()`가 생성. 구조:

```xml
[VERIFY REQUEST]

<role>수정 검증 전문가</role>
<tool_usage_rules>파일 직접 읽기, Serena 참조 확인</tool_usage_rules>
<scope_discipline>이전 지적만 확인, 기존 이슈 제외</scope_discipline>
<output_verbosity_spec>### Issues 또는 NO ISSUES FOUND</output_verbosity_spec>
<high_risk_self_check>수정 전후 비교 검증</high_risk_self_check>

이전 지적사항: {previous_issues}
수정 diff: {fix_diff}
```

## Phase 6 모드 (Hive 통합)

hive-workflow Phase 5 완료 후 자동 호출되는 모드.
standalone 모드와 다른 점:

### 파일 기반 리뷰

diff를 프롬프트에 인라인하지 않고, 변경 파일을 `.hive-state/review/`에 수집.
리뷰어가 직접 파일을 Read로 읽어 검토. **줄 수 제한 없음**.

```bash
bun run ${CLAUDE_SKILL_DIR}/scripts/phase6-orchestrator.ts --base {base_branch} --max 5
```

출력 JSON의 `reviewer` 필드로 실행 방식 결정.

### 리뷰어 선택

| 조건 | 리뷰어 | 실행 |
|------|--------|------|
| Codex 연결됨 | codex | `Bash("$HIVE_PLUGIN_DIR/scripts/tmux-ask.sh codex '{prompt}'")` |
| Codex 미연결 | claude-team | `Agent(description="Phase6-Review", prompt="{prompt}", isolation="worktree")` |

Codex 미연결 시 **중단하지 않고** Claude Team을 생성하여 리뷰 수행.

### 삭제된 파일 처리

`diff-collector.ts --mode files`는 삭제된 파일을 `deletedFiles` 필드로 분리.
리뷰어에게는 존재하는 파일(`files`)만 전달.

## 종료 조건 요약

| 조건 | 동작 |
|------|------|
| `NO ISSUES FOUND` | Phase 4 → 완료, push 확인 |
| 동일 이슈 2회 연속 | ⚠️ 중단, 목록 보고 |
| max iterations 도달 | 🛑 중단, 잔여 이슈 보고 |
| tmux-bridge status 실패 (standalone) | ❌ 즉시 중단 |
| tmux-bridge status 실패 (Phase 6) | Claude Team fallback |
| diff 비어있음 | 변경사항 없음, 중단 |
| diff 5000줄 초과 (standalone) | 범위 초과, 중단 |
| diff 5000줄 초과 (Phase 6) | 파일 기반이므로 제한 없음 |

## 규칙

- **Async Guardrail 필수 준수**: `ask codex` 후 반드시 턴 종료.
- **autonew 필수**: 매 리뷰/검증 요청 전 Codex 세션 클리어 (확증 편향 방지).
- **커밋 메시지**: `fix(auto-review):` 접두사, iteration 번호 포함.
- **git push는 사용자 확인 후**: 자동 push 금지.
