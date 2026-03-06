# Codex Agent Spawn Templates

## 1. 합의 단계

```
CCB_CALLER=claude ask codex "
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

## 2. 구현 단계 (MANDATORY — Codex는 직접 구현자)

**핵심 원칙**: Codex에게 구현을 위임할 때는 반드시 **충분한 코드 컨텍스트**를 포함해야 한다.
추상적 지시가 아닌, 파일명 + 코드 + 구체적 수정 지시를 제공한다.

필수 컨텍스트 (최소 요구):
- 수정 대상 심볼(함수/클래스)의 전체 코드
- 해당 심볼이 참조하는 타입/인터페이스 시그니처
- 관련 import/상수
토큰 제한 시: 전체 파일 대신 위 최소 요구만 포함 허용.

### 표준 템플릿

```
CCB_CALLER=claude ask codex "
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
\`\`\`dart
{{FILE_1_CONTENT}}
\`\`\`

수정 사항:
1. {{구체적 수정 1}} ({{해당 함수/클래스명}})
2. {{구체적 수정 2}} ({{해당 라인 범위}})

### 파일 2: {{FILE_PATH_2}}
현재 코드:
\`\`\`dart
{{FILE_2_CONTENT}}
\`\`\`

수정 사항:
1. {{구체적 수정}}

## 규칙
- CONSENSUS 범위만 구현 (추가 기능 금지)
- 기존 코드 스타일 준수
- 수정 후 \`flutter analyze\` 실행해서 결과 알려줘

## 완료 보고 (필수)
- 변경 파일 목록
- 각 파일별 핵심 변경 (diff 형태)
- CONSENSUS 일치 여부 자체 검증
- flutter analyze 결과
"
```

### 예시: 실제 위임

```
/ask codex "[HIVE IMPLEMENTATION — T3 — W1]

lib/presentation/views/login_view.dart 파일을 수정해줘:

현재 코드:
\`\`\`dart
class _LoginViewState extends ConsumerState<LoginView> {
  final _emailController = TextEditingController();
  // ... (파일 전문)
}
\`\`\`

수정 사항:
1. _showForgotPasswordDialog()에서 취소 시 dialogEmailController.dispose() 누락 → 추가
2. build() 메서드의 Semantics 라벨 누락 → 이메일/비밀번호 필드에 추가
3. 에러 상태에서 실제 에러 메시지 표시 (현재 항상 generic 메시지)

수정 후 flutter analyze 실행해서 결과 알려줘"
```

### 금지: 추상적 위임

```
# 이렇게 하면 안 됨 (파일 내용 없음, 구체적 지시 없음)
/ask codex "login_view.dart를 개선해줘. 접근성이랑 메모리 누수 수정."
```
