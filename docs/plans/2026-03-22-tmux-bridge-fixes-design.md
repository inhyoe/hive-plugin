# tmux-bridge 3건 개선작업 설계

## Issue 1: pasteFile() 타이밍 버그

**파일**: `hooks/tmux-bridge/src/tmux.ts` — `pasteFile()`

현재 흐름: `paste-buffer → sleep 0.5s → Enter → sleep 0.3s → Enter`
수정 흐름: `paste-buffer → sleep 1.0s → Enter → sleep 0.5s → Enter → sleep 0.3s → Enter`

Codex TUI(v0.116.0)가 paste-buffer 수신 후 Enter를 1회 더 필요로 하는 타이밍 이슈.

## Issue 2: 테스트 커버리지 강화

### 기존 테스트 수정
- `registry.test.ts`: 실모듈 `import` + `reconcile()` 테스트 추가
- `sender.test.ts`: `buildPromptFileContent()` 실호출 테스트

### 신규 테스트
- `poller.test.ts`: 응답 파일 기반 폴링 (파일 존재/미존재/타임아웃)
- `cli.test.ts`: CLI 인자 파싱 + 에러 케이스 (Usage 출력 확인)

tmux 의존 함수는 모킹하여 CI 호환성 유지.

## Issue 3: parser.ts dead code 정리

**제거**: `IDLE_PROMPT_PATTERNS`, `isIdle()`, `extractLatestResponse()`, `extractResponse()`, `extractCurrentRound()`
**유지**: `NOISE_PATTERNS`, `isNoiseLine()`, `parseTokenRemaining()`, `findMarker()`

parser.test.ts에서 제거 함수 관련 테스트도 삭제.
