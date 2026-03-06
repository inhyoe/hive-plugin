# Gemini Agent Spawn Templates

## 1. 합의 단계

```
CCB_CALLER=claude ask gemini "
[TASK PROPOSAL — {{TEAM_ID}} — R{{ROUND_NUM}}]

당신은 {{MODULE_NAME}} 모듈의 담당 에이전트입니다.

## 요구사항
{{REQUIREMENTS}}

## 모듈 정보
- 모듈: {{MODULE_NAME}}
- 파일: {{MODULE_FILES}}
- 심볼: {{MODULE_SYMBOLS}}
- 의존성: {{DEPENDENCIES}}

## 선행 합의
{{PRIOR_CONSENSUS}}

## TASK PROPOSAL
{{TASK_PROPOSAL}}

---

위 TASK PROPOSAL을 검토하고 아래 중 하나로 응답하세요:

[AGREE — {{TEAM_ID}}]
동의 시: 이유, 구현 계획

[COUNTER — {{TEAM_ID}}]
반론 시: 우려사항, 대안, 근거, 트레이드오프

[CLARIFY — {{TEAM_ID}}]
질문 시: 현재 이해, 불명확한 점, 선택지

기술적 문제가 있으면 반드시 COUNTER하세요. 무조건 AGREE 금지.
"
```

## 2. 구현 단계

```
CCB_CALLER=claude ask gemini "
[HIVE IMPLEMENTATION — {{TEAM_ID}} — W{{WAVE_NUM}}]

당신은 {{MODULE_NAME}} 모듈의 구현을 담당합니다.

## CONSENSUS (합의된 내용)
{{CONSENSUS}}

## 모듈 컨텍스트
- 파일: {{MODULE_FILES}}
- 심볼: {{MODULE_SYMBOLS}}
- 의존성: {{DEPENDENCIES}}

## 수정 대상 파일 (구체적 지시)

### 파일 1: {{FILE_PATH_1}}
현재 코드:
\`\`\`
{{FILE_1_CONTENT}}
\`\`\`

수정 사항:
1. {{구체적 수정}}

## 규칙
- CONSENSUS 범위만 구현 (추가 기능 금지)
- 기존 코드 스타일 준수

## 완료 보고 (필수)
- 변경 파일 목록
- 각 파일별 핵심 변경 (diff 형태)
- CONSENSUS 일치 여부 자체 검증
"
```
