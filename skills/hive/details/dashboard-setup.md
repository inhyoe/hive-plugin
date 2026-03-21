## Dashboard Auto-Launch

/hive 진입 시 실시간 대시보드를 자동 기동합니다.

```
/hive 진입 즉시 (Phase Router 전):
  Step 1. 플러그인 경로 탐색:
    HIVE_PLUGIN_DIR 탐색 순서:
      a) 환경변수 CLAUDE_PLUGIN_ROOT (Claude Plugin 시스템이 자동 설정)
      b) 환경변수 HIVE_PLUGIN_DIR (수동 설정)
      c) ~/.claude/plugins/cache/hive/ (Plugin 설치 캐시)
      d) ~/.claude/plugins/hive/ (수동 git clone 설치)
      e) 현재 프로젝트에 .claude-plugin/plugin.json이 있으면 현재 디렉토리
      f) 없으면 대시보드 없이 진행 (경고만 출력, 스킵)
  Step 2. 세션 ID 생성 + 파일에 저장 + 대시보드 시작:
    Bash("mkdir -p .hive-state && echo 'hive-'$(date +%s)'-'$$ > .hive-state/session-id && HIVE_SESSION_ID=$(cat .hive-state/session-id) bash $HIVE_PLUGIN_DIR/dashboard/scripts/hive-launcher.sh start")
  Step 3. 상태 확인:
    Bash("HIVE_SESSION_ID=$(cat .hive-state/session-id) bash $HIVE_PLUGIN_DIR/dashboard/scripts/hive-launcher.sh status")

/hive 완료 시 (Phase 5 종료 후 또는 중단 시):
  Bash("HIVE_SESSION_ID=$(cat .hive-state/session-id) bash $HIVE_PLUGIN_DIR/dashboard/scripts/hive-launcher.sh stop")

이벤트 발행 시 (모든 Phase/Gate 전환):
  Bash("HIVE_SESSION_ID=$(cat .hive-state/session-id) bash $HIVE_PLUGIN_DIR/dashboard/scripts/emit-event.sh <type> $(cat .hive-state/session-id) '<payload>'" || true)

핵심: HIVE_SESSION_ID는 .hive-state/session-id 파일에서 읽음 — Bash() 호출 간 환경변수 유지 불가하므로.

대시보드 시작 실패 시 /hive 워크플로우는 중단하지 않음 (대시보드는 부가 기능).
```
