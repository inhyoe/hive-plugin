# Provider Communication Details (Section 4)

## 4. Provider별 합의 통신

| Provider | 전송 방법 | 수신 방법 |
|----------|----------|----------|
| Claude (Agent) | SendMessage(recipient, content) | 자동 수신 (idle notification) |
| Codex (tmux-bridge) | `Bash("$HIVE_PLUGIN_DIR/scripts/tmux-ask.sh codex \"[TASK PROPOSAL — TX — R1] ...\"")` | `$HIVE_PLUGIN_DIR/scripts/tmux-pend.sh codex` |
| Gemini (tmux-bridge) | `Bash("$HIVE_PLUGIN_DIR/scripts/tmux-ask.sh gemini \"[TASK PROPOSAL — TX — R1] ...\"")` | `$HIVE_PLUGIN_DIR/scripts/tmux-pend.sh gemini` |

### tmux-bridge 프로바이더 합의 시 주의사항

- 마커 기반 파싱: `[AGREE — {팀 ID}]`, `[COUNTER — {팀 ID}]`, `[CLARIFY — {팀 ID}]` 마커로 응답 유형 식별
- `HIVE_DONE` = 응답 완료
- 마커 없이 응답이 오면 -> 전체 내용을 파싱하여 의도 추론
- tmux-bridge Async Guardrail: `HIVE_ASYNC_SUBMITTED` -> 턴 종료, pend로 나중에 수집

### tmux-bridge Correlation Keys (split-brain 방지)

tmux-bridge는 stateless이므로, 지연/중복/순서역전 응답을 방지하기 위해 **필수 correlation key**를 포함한다:

| Key | 형식 | 용도 |
|-----|------|------|
| `team_id` | T1, T2, ... | 팀 식별 |
| `round_id` | R1, R2, ... | 합의 라운드 식별 |
| `wave_id` | W1, W2, ... | 구현 Wave 식별 (Phase 5) |
| `parent_round_id` | R1 (이전 라운드) | COUNTER/CLARIFY follow-up 시 선행 라운드 참조 |
| `message_id` | 세션 단위 고유 식별자 (형식: `{team_id}-{round_id}-{seq}`, 예: `T2-R1-001`) | 중복 응답(duplicate reply) 감지 및 멱등성 보장 |

마커 형식: `[TASK PROPOSAL — {team_id} — {round_id}]`
follow-up: `[FOLLOW-UP — {team_id} — {round_id} — parent:{parent_round_id}]`
구현: `[HIVE IMPLEMENTATION — {team_id} — {wave_id}]`

**중복/순서역전 처리**:
- pend 수집 시 `team_id + round_id` 조합으로 기대 응답과 매칭
- 이미 처리된 round_id의 응답이 다시 오면 무시 (idempotent)
- 현재 라운드보다 이전 round_id 응답이 오면 무시 (stale)

### tmux-bridge 라운드 타임아웃 정책

```
soft timeout: 3분 — pend 1회 확인, 미응답 시 tmux-ask.sh로 재요청
hard timeout: 10분 — 라운드 종료, LEAD DECISION으로 에스컬레이션
pend 확인 간격: 최소 1분 (즉시 연속 확인 금지)
```

### 동시 COUNTER + 타임아웃 충돌 해소

```
tmux-bridge 에이전트가 COUNTER를 보냈으나 hard timeout도 동시에 도달한 경우:
  1. pend로 응답이 이미 도착했으면 -> COUNTER 응답 우선 (타임아웃 무시)
  2. pend로 응답 미도착 + hard timeout -> LEAD DECISION 에스컬레이션
  3. LEAD DECISION 후 뒤늦게 COUNTER 도착 -> 무시 (stale response)
원칙: 실제 도착한 응답이 항상 타임아웃보다 우선한다.
```
