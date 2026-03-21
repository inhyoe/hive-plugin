# 구현 단계 리드 동작

```
0. 사전 준비 (에이전트 스폰 전):
   - /ask gemini "리서치/체크리스트 요청" -> 결과를 에이전트 프롬프트 "기준"으로 포함
   - /ask codex "아키텍처 사전 리뷰 요청" -> 결과를 에이전트 지침에 반영

1. Wave별 실행 (순서 중요 — CCB async guardrail 준수):
   Step A: Claude 에이전트 먼저 스폰 — Agent tool (worktree isolation, 병렬)
   Step B: CCB 호출 — /ask codex (파일 내용 + 구체적 수정 지시 + round_id)
           -> CCB_ASYNC_SUBMITTED 시 턴 종료
   Step C: 다음 턴에서 pend 수집 후, /ask gemini (테스트/문서 작업)
   필수: 대규모(6+) Codex 최소 2개, 중소(3-5) 최소 1개 모듈 직접 구현

2. 결과 수집:
   - Claude: SendMessage 수신
   - CCB: pend 수집 (CCB_DONE marker 확인)

3. 교차 검증:
   - Codex -> Claude 수정 코드 리뷰
   - Claude -> Codex 수정 코드 검증
   교차 리뷰가 아닌 교차 구현 + 교차 검증

4. Wave 완료 -> 다음 Wave
5. 모든 Wave 완료 -> 통합 커밋 -> 셧다운
```
