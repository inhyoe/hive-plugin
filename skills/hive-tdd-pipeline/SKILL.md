---
name: hive-tdd-pipeline
description: "G4-G7 TDD pipeline with agent isolation. Loaded when /hive enters Phase 5."
user-invocable: false
---
# Hive TDD Pipeline
Phase 5 G4-G7 TDD 루프. Enforcer가 detail Read를 강제합니다.

Agent isolation: A(테스트)↔B(구현)↔C(검증) 정보 장벽으로 Context Pollution 방지.

## Gates

<hard_gate rule="G4_RED_BEFORE_GREEN">[TDD RED PASSED] 없이 G5 진입 금지.</hard_gate>

<hard_gate rule="G5_GREEN_BEFORE_VERIFY">[IMPLEMENT GREEN PASSED] 없이 G6 진입 금지.</hard_gate>

<hard_gate rule="G6_VERIFY_BEFORE_E2E">[CROSS-VERIFY PASSED] (mutation>=60, pbt=pass, review!=REJECT) 없이 G7 진입 금지.</hard_gate>

<hard_gate rule="G7_E2E_BEFORE_COMPLETE">[E2E VALIDATE PASSED] 없이 완료 선언 금지.</hard_gate>

## Flow
`[G4 RED] → [G5 GREEN] → [G6 CROSS-VERIFY] → [G7 E2E] → COMPLETE`
