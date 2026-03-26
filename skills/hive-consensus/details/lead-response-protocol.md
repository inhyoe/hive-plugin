# Lead Response Protocol (Sections 8-9)

## 8. 에이전트의 COUNTER 의무

에이전트는 다음 상황에서 **반드시** COUNTER를 보내야 합니다:

1. **기술적 오류**: 제안에 명백한 버그/결함
2. **성능 문제**: 더 효율적인 대안이 명확
3. **보안 취약점**: 제안이 보안 위험 초래
4. **유지보수 우려**: 장기적 기술 부채 생성
5. **요구사항 불일치**: 제안이 Requirements Summary와 불일치

**무조건 AGREE 금지**: 기술적 문제를 인지하면서 AGREE하면 프로토콜 위반.

---

## 9. 리드의 응답 의무 (MANDATORY)

리드는 에이전트로부터 메시지를 받으면 **반드시** 응답해야 합니다.

### 9-1. Claude 에이전트 응답 시

```
에이전트 -> SendMessage([AGREE/COUNTER/CLARIFY])
  |
리드 -> SendMessage(recipient=에이전트명, content=응답)
  |
  AGREE -> "합의 확인. CONSENSUS 문서 생성합니다." + CONSENSUS 생성
  COUNTER -> 수용/부분수용/거절 + 근거 + 수정 PROPOSAL (필요 시)
  CLARIFY -> 추가 정보 제공 + "검토 후 다시 응답해주세요"
```

### 9-2. tmux-bridge 에이전트 (Codex/Gemini) 응답 시

```
pend로 응답 수집 -> 마커 파싱 (round_id/team_id 확인)
  |
  AGREE -> CONSENSUS 문서 생성 (확인 메시지 불필요 — tmux-bridge는 stateless)
  COUNTER -> 해당 프로바이더로 재응답 (tmux-ask.sh codex 또는 tmux-ask.sh gemini):
             "[FOLLOW-UP — TX — RN] 재제안: ..."
  CLARIFY -> 해당 프로바이더로 재응답:
             "[FOLLOW-UP — TX — RN] 추가 정보: ..."
```

**tmux-bridge는 stateless**: AGREE 시 별도 "확인" 메시지 불필요 (Claude Agent과 다름).

### 9-3. 구현 중 에이전트 질문/보고 시

```
에이전트 -> SendMessage("중간 보고" 또는 "[CLARIFY]")
  |
리드 -> SendMessage(recipient=에이전트명, content=피드백)
  |
  문제 없음 -> "진행하세요"
  방향 조정 -> 구체적 수정 지시
  CONSENSUS 위반 -> "CONSENSUS에 따르면 X입니다. Y 대신 X로 해주세요"
```
