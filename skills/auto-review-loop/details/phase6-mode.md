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
