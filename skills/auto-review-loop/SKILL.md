---
name: auto-review-loop
description: PR 코드를 Codex에게 독립 리뷰 받고 Claude가 수정하는 자동 루프. Use when user types /auto-review-loop, or says "자동 리뷰", "리뷰 루프", "auto review".
argument-hint: "[--max N] [--base branch]"
user-invocable: true
---

# Auto Review Loop

Codex에게 독립 리뷰를 요청하고, 지적사항을 Claude가 수정한 뒤, Codex에게 재검증을 반복하는 자동화 루프.

## 사용법

```text
/auto-review-loop                    # 기본 (main 대비, 최대 10회)
/auto-review-loop --max 5            # 최대 5회 반복
/auto-review-loop --base develop     # develop 브랜치 대비 diff
```

## 인자 파싱

`$ARGUMENTS`에서 추출:
- `--max N`: 최대 반복 횟수. 기본 10. 최대 10.
- `--base BRANCH`: 비교 대상 브랜치. 기본: 자동 감지.

## 실행 흐름

```text
[Phase 1] 사전 검증: ccb-ping codex, 브랜치/diff 확인
[Phase 2] 리뷰 요청: autonew codex → ask codex "[REVIEW]" → 턴 종료
[Phase 3] 리뷰 대응: 파싱 → 수정 → commit → autonew → ask codex "[VERIFY]" → 턴 종료
[Phase 4] 완료: 이슈 0 → push 확인
```

## Phase 1: 사전 검증 (MANDATORY)

1. **Codex 연결 확인:**
   ```bash
   ccb-ping codex
   ```
   - 실패 시: "❌ Codex가 실행 중이 아닙니다. `ccb codex`로 시작해주세요." 출력 후 **중단**.

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
   CCB_CALLER=claude ask codex "{review_prompt}"
   ```
4. 출력: `Auto Review Loop 시작 — Codex processing...`
5. **턴 즉시 종료** (Async Guardrail 준수).

## Phase 3: 리뷰 대응 (Codex 응답 도착 시)

**IMPORTANT:** Codex 응답이 대화에 도착하면 이 Phase를 자동 실행한다.
이전 턴에서 `[REVIEW REQUEST]` 또는 `[VERIFY REQUEST]`를 보냈다면, 이 응답은 Auto Review Loop의 일부이다.

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
     CCB_CALLER=claude ask codex "{verify_prompt}"
     ```
   - 출력: `Auto Review Loop — Iteration {N}/{max} — Codex processing...`
   - **턴 즉시 종료**.

5. Codex 응답 도착 → Phase 3 처음부터 반복.

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

## Review Prompt Template

```
[REVIEW REQUEST]
아래 코드 변경사항을 리뷰해주세요.

HIGH SIGNAL 이슈만 보고하세요:
- 컴파일/파싱 실패 (구문 오류, 타입 오류, missing imports)
- 확실한 로직 오류 (입력과 무관하게 잘못된 결과)
- 보안 취약점
- CLAUDE.md 규칙 위반 (정확한 규칙 인용)

보고하지 마세요:
- 코드 스타일, 품질 우려
- 특정 입력에만 발생하는 잠재적 이슈
- 주관적 개선 제안
- linter가 잡을 수 있는 것

출력 형식:
이슈가 있으면:
### Issues
1. **[파일:라인]** 설명
2. ...

이슈가 없으면 정확히:
NO ISSUES FOUND

--- DIFF START ---
{diff}
--- DIFF END ---
```

## Verify Prompt Template

```
[VERIFY REQUEST]
이전 리뷰에서 지적된 이슈들이 수정되었습니다.
수정된 부분만 검증해주세요. 새로운 이슈도 확인해주세요.

이전 지적사항:
{previous_issues}

수정 diff:
--- FIX DIFF START ---
{fix_diff}
--- FIX DIFF END ---

출력 형식:
이슈가 있으면:
### Issues
1. **[파일:라인]** 설명
2. ...

이슈가 없으면 정확히:
NO ISSUES FOUND
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
| Codex 연결됨 | codex | `ask codex "{prompt}"` |
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
| ccb-ping 실패 (standalone) | ❌ 즉시 중단 |
| ccb-ping 실패 (Phase 6) | Claude Team fallback |
| diff 비어있음 | 변경사항 없음, 중단 |
| diff 5000줄 초과 (standalone) | 범위 초과, 중단 |
| diff 5000줄 초과 (Phase 6) | 파일 기반이므로 제한 없음 |

## 규칙

- **Async Guardrail 필수 준수**: `ask codex` 후 반드시 턴 종료.
- **autonew 필수**: 매 리뷰/검증 요청 전 Codex 세션 클리어 (확증 편향 방지).
- **커밋 메시지**: `fix(auto-review):` 접두사, iteration 번호 포함.
- **git push는 사용자 확인 후**: 자동 push 금지.
