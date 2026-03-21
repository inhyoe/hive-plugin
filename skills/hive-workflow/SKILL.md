---
name: hive-workflow
description: "Phase 0-3 and 5-6 execution engine. Loaded when /hive is invoked."
user-invocable: false
---
# Hive Workflow Engine
Phase 전환 시 enforcer가 필수 detail 파일 Read를 강제합니다.

## Phases
- P0: Prompt Engineering (G1+G2 선행 필수)
- P1: Brainstorm
- P2: Serena Context
- P3: Team Decomposition
- P5: Execute & Monitor (validate-phase5-entry.sh 통과 필수, G4-G7 TDD 강제)
- P6: Auto Review (Phase 5 완료 + G7 + clean git 필수)
