## Event Emission

각 Phase/Gate 전환 시 이벤트를 발행합니다. 대시보드가 실행 중이 아니어도 안전합니다.

```
이벤트 발행 방법:
  Bash("bash $HIVE_PLUGIN_DIR/dashboard/scripts/emit-event.sh <type> $HIVE_SESSION_ID '<payload>'")

발행 시점:
  | 시점 | type | payload 예시 |
  |------|------|-------------|
  | Phase 진입 | phase.transition | {"phase":0,"status":"enter"} |
  | Phase 종료 | phase.transition | {"phase":0,"status":"exit"} |
  | Gate 통과/실패 | gate.update | {"gate":"G1","status":"passed"} |
  | 팀 생성 | team.created | {"teamId":"T1","modules":["auth"],"provider":"claude","agentName":"a1"} |
  | 에이전트 스폰 | agent.spawn | {"teamId":"T1","provider":"claude","spawnMethod":"Agent"} |
  | 에이전트 상태 | agent.status | {"teamId":"T1","provider":"claude","status":"working","currentTask":"구현 중"} |
  | 리드↔워커 메시지 | agent.message | {"from":"T1","to":"lead","direction":"worker→lead","summary":"70% 완료"} |
  | 합의 응답 | consensus.update | {"teamId":"T1","round":1,"response":"AGREE"} |
  | Wave 전환 | wave.transition | {"waveId":1,"teams":["T1","T2"],"status":"start"} |
  | 실행 결과 | execution.result | {"teamId":"T1","changedFiles":["a.ts"],"linesAdded":100,"linesRemoved":5,"success":true} |
  | 세션 완료 | session.summary | {"totalTeams":3,"passed":3,"failed":0,"totalFiles":8,"totalChanges":500} |

emit-event.sh가 없거나 실패해도 워크플로우는 중단하지 않음 (|| true).
```
