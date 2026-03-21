# 합의 단계 리드 동작 (양방향 대화 필수)

```
1. 팀 레지스트리 생성 (mkdir -p .hive-state/consensus)

2. 독립 팀들에게 동시 TASK PROPOSAL 전송 (구현 지시 포함 금지):
   - Claude: Agent tool (합의 프롬프트 — templates/claude-agent.md S1 사용)
   - Codex: /ask codex (합의 프롬프트 — templates/codex-agent.md S1 사용)
   - Gemini: /ask gemini (합의 프롬프트 — templates/gemini-agent.md S1 사용)
   이 단계에서 구현을 함께 지시하면 안 됨

3. 응답 수신 + 리드 응답 (MANDATORY):
   Claude 에이전트:
     - SendMessage 자동 수신
     - 마커 파싱 (AGREE/COUNTER/CLARIFY)
     - 리드 -> SendMessage(recipient=에이전트명, content=응답)
   CCB 에이전트:
     - pend로 수집
     - 마커 파싱 (round_id/team_id 확인)
     - AGREE -> CONSENSUS 문서 생성 (CCB에 확인 메시지 불필요 — stateless)
     - COUNTER -> /ask codex/gemini "[FOLLOW-UP — {team_id} — R{N} — parent:R{N-1}] 재제안: ..."
     - CLARIFY -> /ask codex/gemini "[FOLLOW-UP — {team_id} — R{N} — parent:R{N-1}] 추가 정보: ..."

4. 응답별 리드 행동:
   Claude 에이전트:
     AGREE:
       -> CONSENSUS 문서 생성
       -> SendMessage: "CONSENSUS가 확정되었습니다: {요약}"
     COUNTER:
       -> 반론 검토 (수용/부분수용/거절)
       -> SendMessage: 수정 PROPOSAL + 근거
       -> 에이전트 재응답 대기
     CLARIFY:
       -> 추가 정보 제공
       -> SendMessage: 답변 + "검토 후 다시 응답해주세요"
       -> 에이전트 재응답 대기
   CCB 에이전트:
     AGREE -> CONSENSUS 문서 생성 (확인 메시지 불필요 — CCB는 stateless)
     COUNTER -> /ask codex/gemini "[FOLLOW-UP — {team_id} — R{N} — parent:R{N-1}] 재제안: ..."
     CLARIFY -> /ask codex/gemini "[FOLLOW-UP — {team_id} — R{N} — parent:R{N-1}] 추가 정보: ..."

5. 합의 루프 반복 (max 5 rounds)
6. 전체 CONSENSUS 도달 -> Phase 5로

금지: 에이전트 응답 무시하고 바로 Phase 5 진입
금지: 합의 프롬프트에 "문제 찾아서 수정해줘" 포함
```
