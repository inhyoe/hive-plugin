# PR #8 CodeRabbit + Copilot 리뷰 통합 수정 계획

## 상태: G2 SPEC

## 배경
PR #8 (Hook-based enforcement engine)에 대해 CodeRabbit 3회 + Copilot 3회 리뷰 발생.
총 22건 지적 중 10건은 이미 수정 확인, 잔존 12건을 수정한다.

## 수정 대상 (12건)

### Critical (3건)
| ID | 파일 | 설명 |
|----|------|------|
| C1 | `phase-guard.ts` | `.hive-state/*` 직접 쓰기 미차단 → session.json 조작으로 FSM 우회 가능 |
| C2 | `phase-guard.ts` | `create-marker.sh && git commit` 체인 명령에서 early return → 뒤쪽 검사 우회 |
| C3 | `index.ts:52-59` | `extractCommandFromStdin` null 반환 시 fail-open → fail-closed로 변경 |

### Major (4건)
| ID | 파일 | 설명 |
|----|------|------|
| M1 | `state.ts:71-92` | `readSession→mutate→writeSession` 경쟁 조건. lockfile 기반 updateSession 필요 |
| M2 | `agent-tracker.ts` | `Date.now()+teamId` 파일명 충돌 → process.pid suffix 추가 |
| M3 | `create-marker.sh` | G2 증빙 파일 미존재 시 silent pass → hard-fail로 변경 |
| M4 | `types.ts` + `create-marker.sh` | `HiveSession.mode` 타입에 `'DONE'` 누락 → 스키마 정합 |

### Minor (3건)
| ID | 파일 | 설명 |
|----|------|------|
| m1 | `patterns.ts` | `extractCreateMarkerGate` 플래그가 gate 앞에 오면 오판 |
| m2 | `agent-dispatcher.test.ts` | 중복 `createSession` 호출 |
| m3 | `agent-tracker.test.ts` | `chmodSync` 테스트 + `console.error` spy 추가 |

### Nitpick (2건)
| ID | 파일 | 설명 |
|----|------|------|
| N1 | `intent-gate.test.ts` | `parse_error` 복구 경로 테스트 추가 |
| N2 | `e2e-scenario.test.ts` | phase 텔레포트 대신 실제 전이 흐름 테스트 추가 |

## 영향 파일
- `hooks/enforcer/src/handlers/phase-guard.ts`
- `hooks/enforcer/src/index.ts`
- `hooks/enforcer/src/lib/state.ts`
- `hooks/enforcer/src/lib/types.ts`
- `hooks/enforcer/src/lib/patterns.ts`
- `hooks/enforcer/src/handlers/agent-tracker.ts`
- `scripts/create-marker.sh`
- `hooks/enforcer/__tests__/agent-dispatcher.test.ts`
- `hooks/enforcer/__tests__/agent-tracker.test.ts`
- `hooks/enforcer/__tests__/intent-gate.test.ts`
- `hooks/enforcer/__tests__/e2e-scenario.test.ts`

## 의존성
- M4 (DONE 타입) → C1, M1에 영향 (모드 비교 로직 변경)
- M1 (updateSession) → M2 참조 (addAgentSpawn이 updateSession 사용)
- C1 + C2 (phase-guard 변경) → 기존 테스트 업데이트 필요
