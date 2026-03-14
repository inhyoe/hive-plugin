# Hive Event Emission Reference

## Usage in SKILL.md instructions

When the hive lead agent needs to emit an event, it should use:

```
Bash("./dashboard/scripts/emit-event.sh <type> <session_id> '<payload>'")
```

## Event emission points in hive-workflow

| Workflow Point | Event Type | Payload Example |
|----------------|-----------|-----------------|
| Phase enter | phase.transition | {"phase":0,"status":"enter"} |
| Phase exit | phase.transition | {"phase":0,"status":"exit"} |
| Gate pass/fail | gate.update | {"gate":"G1","status":"passed"} |
| Team created | team.created | {"teamId":"T1","modules":["auth"],"provider":"claude","agentName":"agent-1"} |
| Agent spawned | agent.spawn | {"teamId":"T1","provider":"claude","spawnMethod":"Agent"} |
| Agent status change | agent.status | {"teamId":"T1","provider":"claude","status":"working","currentTask":"Implementing auth"} |
| Lead-Worker message | agent.message | {"from":"T1","to":"lead","direction":"worker->lead","summary":"70% done"} |
| Consensus response | consensus.update | {"teamId":"T1","round":1,"response":"AGREE"} |
| Lead decision | lead.decision | {"teamId":"T1","reason":"timeout","round":3} |
| Wave start/complete | wave.transition | {"waveId":1,"teams":["T1","T2"],"status":"start"} |
| Execution result | execution.result | {"teamId":"T1","changedFiles":["a.ts"],"linesAdded":100,"linesRemoved":5,"success":true} |
| Cross feedback | cross_feedback | {"fromTeam":"T2","toTeam":"T1","waveId":2,"severity":"minor","summary":"Missing header"} |
| Phase error | phase.error | {"phase":5,"teamId":"T1","errorType":"stuck","message":"3 retries failed"} |
| Execution retry | execution.retry | {"teamId":"T1","attempt":2,"maxAttempts":3,"reentryPoint":"Phase 5"} |
| Session complete | session.summary | {"totalTeams":3,"passed":3,"failed":0,"totalFiles":8,"totalChanges":500} |
