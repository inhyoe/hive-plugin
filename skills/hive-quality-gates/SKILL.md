---
name: hive-quality-gates
description: "G1-G3 quality gates and marker chain. Loaded when /hive processes gate transitions."
user-invocable: false
---
# Hive Quality Gates
G1-G3 게이트 + 마커 체인. G4-G7은 hive-tdd-pipeline 참조. Enforcer가 detail Read를 강제합니다.

## 마커 체인 (불변 순서)

| # | 마커 | 페이로드 |
|---|------|---------|
| 1 | `[CLARIFY PASSED]` | `scope criteria constraints` |
| 2 | `[SPEC APPROVED]` | `hash:{sha256}` |
| 3 | `[PLAN DEBATE — CONSENSUS — overall:{score}]` | |
| 4 | `[TDD RED PASSED]` | `test_count fail_count` |
| 5 | `[IMPLEMENT GREEN PASSED]` | `pass iterations` |
| 6 | `[CROSS-VERIFY PASSED]` | `mutation pbt review` |
| 7 | `[E2E VALIDATE PASSED]` | `type result` |

## Gates

<hard_gate rule="G1_BEFORE_G2">G1 CLARIFY 통과 전 G2 진입 금지.</hard_gate>

<hard_gate rule="G2_BEFORE_PHASE0">G2 SPEC 통과 전 Phase 0 진입 금지.</hard_gate>

<hard_gate rule="G3_BEFORE_EXECUTE">G3 PLAN REVIEW (score>=7.0) 통과 전 Phase 4/5 진입 금지.</hard_gate>
