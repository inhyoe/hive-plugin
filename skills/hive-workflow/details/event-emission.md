# Event Emission (Dashboard 연동)

각 Phase 진입/종료 시 아래 패턴으로 이벤트를 발행합니다:

```
SID 읽기 (모든 emit 호출에서 사용):
  SID=$(cat .hive-state/session-id 2>/dev/null || echo "no-session")

Phase 진입 시:
  Bash("SID=$(cat .hive-state/session-id 2>/dev/null || echo no-session) && bash $HIVE_PLUGIN_DIR/dashboard/scripts/emit-event.sh phase.transition $SID '{\"phase\":N,\"status\":\"enter\"}'" || true)

Phase 종료 시:
  Bash("SID=$(cat .hive-state/session-id 2>/dev/null || echo no-session) && bash $HIVE_PLUGIN_DIR/dashboard/scripts/emit-event.sh phase.transition $SID '{\"phase\":N,\"status\":\"exit\"}'" || true)

Gate 통과 시:
  Bash("SID=$(cat .hive-state/session-id 2>/dev/null || echo no-session) && bash $HIVE_PLUGIN_DIR/dashboard/scripts/emit-event.sh gate.update $SID '{\"gate\":\"G1\",\"status\":\"passed\"}'" || true)

팀 생성 시 (Phase 3):
  Bash("SID=$(cat .hive-state/session-id 2>/dev/null || echo no-session) && bash $HIVE_PLUGIN_DIR/dashboard/scripts/emit-event.sh team.created $SID '{\"teamId\":\"T1\",\"modules\":[\"auth\"],\"provider\":\"claude\",\"agentName\":\"a1\"}'" || true)

에이전트 상태 변경 시:
  Bash("SID=$(cat .hive-state/session-id 2>/dev/null || echo no-session) && bash $HIVE_PLUGIN_DIR/dashboard/scripts/emit-event.sh agent.status $SID '{\"teamId\":\"T1\",\"provider\":\"claude\",\"status\":\"working\",\"currentTask\":\"구현 중\"}'" || true)

이벤트 발행 순서 (MANDATORY):
  consensus.update를 agent.status보다 먼저 발행해야 한다.
  COUNTER/CLARIFY 수신 시:
    1. emit consensus.update (response: "COUNTER"/"CLARIFY")  ← 먼저
    2. emit agent.status (status: "working")                   ← 나중
  AGREE 수신 후 최종 완료 시:
    1. emit consensus.update (response: "AGREE")               ← 먼저
    2. emit agent.status (status: "done")                      ← 나중
  잘못된 순서 (agent.status done → consensus.update COUNTER)는
  대시보드에서 에이전트가 done으로 잘못 표시되는 버그를 유발한다.

핵심: 환경변수는 Bash() 호출 간 유지 안 됨 → .hive-state/session-id 파일에서 매번 읽음.
emit-event.sh 부재/실패 시 워크플로우는 중단하지 않음 (|| true 필수).
```
