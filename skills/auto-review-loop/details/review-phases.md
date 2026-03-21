## Phase 1: 사전 검증 (MANDATORY)

1. **Codex 연결 확인:**
   ```bash
   ccb-ping codex
   ```
   - 실패 시: "Codex가 실행 중이 아닙니다. `ccb codex`로 시작해주세요." 출력 후 **중단**.

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
   - `tooLarge: true` → "diff가 너무 큽니다 ({lineCount}줄). 범위를 좁혀주세요." 출력 후 **중단**.

4. **상태 초기화 (스크립트 사용):**
   ```bash
   bun run ${CLAUDE_SKILL_DIR}/scripts/state-manager.ts --init --branch {current_branch} --base {base_branch} --max {max_iterations}
   ```

## Phase 2: 리뷰 요청

1. `autonew codex` 실행 — Codex 세션 클리어.
2. **리뷰 프롬프트 생성 (스크립트 사용):**
   ```bash
   bun run ${CLAUDE_SKILL_DIR}/scripts/prompt-builder.ts --type review --diff {tmpdir}/auto-review-diff.txt
   ```
   diff 내용을 임시 파일(`{tmpdir}/auto-review-diff.txt`)에 저장 후 실행. 출력을 `review_prompt`로 사용.
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
   Codex 응답을 임시 파일(`{tmpdir}/codex-response.txt`)에 저장 후:
   ```bash
   bun run ${CLAUDE_SKILL_DIR}/scripts/review-parser.ts --input {tmpdir}/codex-response.txt
   ```
   JSON 출력에서 `hasIssues`, `issues` 확인.
   - `hasIssues: false` → **Phase 4 (완료)** 진행.

2. **상태 확인 (스크립트 사용):**
   파싱된 이슈를 임시 파일(`{tmpdir}/auto-review-issues.json`)에 저장 후:
   ```bash
   bun run ${CLAUDE_SKILL_DIR}/scripts/state-manager.ts --check --state {tmpdir}/auto-review-state-{branch}.json --issues {tmpdir}/auto-review-issues.json
   ```
   JSON 출력에서 `shouldContinue`, `reason` 확인:
   - `reason: "duplicate issues"` → "동일 이슈가 반복되어 자동 수정이 어렵습니다:" + 목록 출력 → **중단**.
   - `reason: "max iterations"` → "최대 {max}회 반복 도달. 잔여 이슈:" + 목록 출력 → **중단**.

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
     bun run ${CLAUDE_SKILL_DIR}/scripts/state-manager.ts --update --state {tmpdir}/auto-review-state-{branch}.json --issues {tmpdir}/auto-review-issues.json
     ```
   - 검증 프롬프트 생성 (스크립트 사용):
     - `git diff HEAD~1..HEAD > {tmpdir}/auto-review-fix.diff`
     ```bash
     bun run ${CLAUDE_SKILL_DIR}/scripts/prompt-builder.ts --type verify --diff {tmpdir}/auto-review-fix.diff --issues {tmpdir}/auto-review-issues.json
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
   Auto Review Loop 완료
   - 반복: {N}회
   - 수정 커밋: {N}개
   - 상태: 모든 이슈 해소

   git push 할까요?
   ```
2. 사용자가 승인하면 `git push` 실행.
