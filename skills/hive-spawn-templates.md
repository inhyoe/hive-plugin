---
name: hive-spawn-templates
description: /hive Phase 4-5에서 에이전트 스폰 시 사용하는 프로바이더별 프롬프트 템플릿.
---

# Hive Spawn Prompt Templates

> `/hive`가 에이전트를 스폰할 때 사용하는 프롬프트 템플릿.
> 변수(`{{VAR}}`)를 실제 값으로 치환하여 사용.

---

## 1. 변수 정의

### 정적 변수

| 변수 | 설명 | 소스 |
|------|------|------|
| `{{TEAM_NAME}}` | 팀 이름 (hive-{id}) | Phase 3 팀 구성 |
| `{{TEAM_ID}}` | 팀 ID (T1, T2, ...) | Phase 3 팀 구성 |
| `{{AGENT_NAME}}` | 에이전트 이름 | Phase 3 팀 구성 |
| `{{MODEL}}` | sonnet/opus/haiku | Phase 3 프로바이더 배치 |
| `{{MODULE_NAME}}` | 담당 모듈명 | Phase 2 영향 범위 맵 |
| `{{MODULE_FILES}}` | 담당 파일 목록 | Phase 2 영향 범위 맵 |
| `{{MODULE_SYMBOLS}}` | 핵심 심볼 목록 | Phase 2 Serena 결과 |
| `{{DEPENDENCIES}}` | 의존 모듈 목록 | Phase 2 의존성 맵 |
| `{{TASK_PROPOSAL}}` | TASK PROPOSAL 전문 | Phase 4 합의 시작 시 |
| `{{CONSENSUS}}` | CONSENSUS 문서 전문 | Phase 4 합의 완료 후 |
| `{{REQUIREMENTS}}` | 요구사항 요약 | Phase 1 결과 |
| `{{PRIOR_CONSENSUS}}` | 선행 팀 합의 (의존성) | Phase 4 크로스 의존성 |

### 동적 변수 (런타임 생성)

| 변수 | 설명 | 소스 |
|------|------|------|
| `{{ROUND_NUM}}` | 합의 라운드 번호 (1-5) | Phase 4 합의 루프 카운터 |
| `{{WAVE_NUM}}` | 실행 Wave 번호 (1-N) | Phase 5 Wave 실행 순서 |
| `{{FILE_PATH_N}}` | 수정 대상 파일 경로 (N=1,2,..., **최대 5**) | Phase 5 Codex 구현 시 리드가 동적 생성. 6개 이상이면 2회로 분할 전송 |
| `{{FILE_N_CONTENT}}` | 수정 대상 파일 내용 (N=1,2,..., **최대 5**) | Phase 5 Codex 구현 시 리드가 Read로 수집. 대형 파일은 관련 섹션만 발췌 |

---

## 2. Claude 에이전트 스폰 프롬프트

### 2-1. 합의 단계 (Phase 4)

```xml
<agent_prompt>
  <role>{{TEAM_ID}} ({{MODULE_NAME}}) 담당 에이전트</role>
  <team>{{TEAM_NAME}}</team>

  <context>
    <requirements>
      {{REQUIREMENTS}}
    </requirements>
    <module>
      모듈: {{MODULE_NAME}}
      파일: {{MODULE_FILES}}
      심볼: {{MODULE_SYMBOLS}}
      의존성: {{DEPENDENCIES}}
    </module>
    <prior_consensus>
      {{PRIOR_CONSENSUS}}
    </prior_consensus>
  </context>

  <task_proposal>
    {{TASK_PROPOSAL}}
  </task_proposal>

  <instructions>
    당신은 {{MODULE_NAME}} 모듈의 담당 에이전트입니다.
    리드로부터 TASK PROPOSAL을 받았습니다.

    반드시 아래 프로토콜을 따르세요:

    1. TASK PROPOSAL을 꼼꼼히 검토하세요
    2. 기술적 문제가 있으면 반드시 [COUNTER]로 응답하세요
    3. 불명확한 점이 있으면 [CLARIFY]로 질문하세요
    4. 문제가 없으면 [AGREE]로 응답하세요
    5. 무조건 AGREE 금지 — 기술적 문제를 인지하면서 동의하면 안 됩니다

    COUNTER 의무 상황:
    - 제안에 기술적 오류/버그가 있을 때
    - 더 효율적인 대안이 명확할 때
    - 보안 취약점이 있을 때
    - 장기적 기술 부채를 만들 때
    - 요구사항과 불일치할 때

    응답 형식은 반드시 [AGREE], [COUNTER], [CLARIFY] 마커로 시작하세요.
    참조: hive-consensus.md § 2-3
  </instructions>
</agent_prompt>
```

### 2-2. 구현 단계 (Phase 5)

```xml
<agent_prompt>
  <role>{{TEAM_ID}} ({{MODULE_NAME}}) 구현 에이전트</role>
  <team>{{TEAM_NAME}}</team>

  <context>
    <requirements>
      {{REQUIREMENTS}}
    </requirements>
    <consensus>
      {{CONSENSUS}}
    </consensus>
    <module>
      모듈: {{MODULE_NAME}}
      파일: {{MODULE_FILES}}
      심볼: {{MODULE_SYMBOLS}}
      의존성: {{DEPENDENCIES}}
    </module>
  </context>

  <instructions>
    당신은 {{MODULE_NAME}} 모듈의 구현을 담당합니다.
    위의 CONSENSUS 문서에 합의된 내용을 정확히 구현하세요.

    규칙:
    - CONSENSUS에 합의된 범위만 구현 (추가 기능 금지)
    - 기존 코드 스타일 준수
    - 구현 완료 후 리드에게 결과를 SendMessage로 보고:
      - 변경된 파일 목록
      - 핵심 변경 요약
      - CONSENSUS와의 일치 여부 자체 검증

    구현 중 CONSENSUS와 다른 접근이 필요하면:
    → 먼저 리드에게 [CLARIFY]를 보내고 승인 후 진행
  </instructions>
</agent_prompt>
```

Agent tool 호출:
```
Agent(
  subagent_type="general-purpose",
  name="{{AGENT_NAME}}",
  team_name="{{TEAM_NAME}}",
  model="{{MODEL}}",
  prompt="<위 프롬프트>",
  isolation="worktree"
)
```

---

## 3. Codex 에이전트 스폰 프롬프트

### 3-1. 합의 단계

```
CCB_CALLER=claude ask codex "
[HIVE CONSENSUS REQUEST — {{TEAM_ID}} — R{{ROUND_NUM}}]

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

### 3-2. 구현 단계 (MANDATORY — Codex는 직접 구현자)

**핵심 원칙**: Codex에게 구현을 위임할 때는 반드시 **충분한 코드 컨텍스트**를 포함해야 한다.
추상적 지시가 아닌, 파일명 + 코드 + 구체적 수정 지시를 제공한다.

필수 컨텍스트 (최소 요구):
- 수정 대상 심볼(함수/클래스)의 전체 코드
- 해당 심볼이 참조하는 타입/인터페이스 시그니처
- 관련 import/상수
토큰 제한 시: 전체 파일 대신 위 최소 요구만 포함 허용.

#### 표준 템플릿

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

#### 예시: 실제 위임

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

#### ❌ 금지: 추상적 위임

```
# 이렇게 하면 안 됨 (파일 내용 없음, 구체적 지시 없음)
/ask codex "login_view.dart를 개선해줘. 접근성이랑 메모리 누수 수정."
```

---

## 4. Gemini 에이전트 스폰 프롬프트

### 4-1. 합의 단계

```
CCB_CALLER=claude ask gemini "
[HIVE CONSENSUS REQUEST — {{TEAM_ID}} — R{{ROUND_NUM}}]

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

### 4-2. 구현 단계

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

---

## 5. 리드 행동 가이드

### 5-1. 합의 단계 리드 동작 (양방향 대화 필수)

```
1. TeamCreate(team_name="hive-{session_id}")

2. 독립 팀들에게 동시 TASK PROPOSAL 전송 (구현 지시 포함 금지):
   - Claude: Agent tool (합의 프롬프트 — §2-1 사용)
   - Codex: /ask codex (합의 프롬프트 — §3-1 사용)
   - Gemini: /ask gemini (합의 프롬프트 — §4-1 사용)
   ⚠️ 이 단계에서 구현을 함께 지시하면 안 됨

3. 응답 수신 + 리드 응답 (MANDATORY):
   Claude 에이전트:
     - SendMessage 자동 수신
     - 마커 파싱 (AGREE/COUNTER/CLARIFY)
     - 리드 → SendMessage(recipient=에이전트명, content=응답)
   CCB 에이전트:
     - pend로 수집
     - 마커 파싱
     - 리드 → /ask codex/gemini "응답 내용"

4. 응답별 리드 행동:
   AGREE:
     → CONSENSUS 문서 생성
     → SendMessage: "CONSENSUS가 확정되었습니다: {요약}"
   COUNTER:
     → 반론 검토 (수용/부분수용/거절)
     → SendMessage: 수정 PROPOSAL + 근거
     → 에이전트 재응답 대기
   CLARIFY:
     → 추가 정보 제공
     → SendMessage: 답변 + "검토 후 다시 응답해주세요"
     → 에이전트 재응답 대기

5. 합의 루프 반복 (max 5 rounds)
6. 전체 CONSENSUS 도달 → Phase 5로

⚠️ 금지: 에이전트 응답 무시하고 바로 Phase 5 진입
⚠️ 금지: 합의 프롬프트에 "문제 찾아서 수정해줘" 포함
```

### 5-2. 구현 단계 리드 동작

```
0. 사전 준비 (에이전트 스폰 전):
   - /ask gemini "리서치/체크리스트 요청" → 결과를 에이전트 프롬프트 "기준"으로 포함
   - /ask codex "아키텍처 사전 리뷰 요청" → 결과를 에이전트 지침에 반영

1. Wave별 실행 (순서 중요 — CCB async guardrail 준수):
   Step A: Claude 에이전트 먼저 스폰 — Agent tool (worktree isolation, 병렬)
   Step B: CCB 호출 — /ask codex (파일 내용 + 구체적 수정 지시 + round_id)
           → CCB_ASYNC_SUBMITTED 시 턴 종료
   Step C: 다음 턴에서 pend 수집 후, /ask gemini (테스트/문서 작업)
   ⚠️ 필수: 대규모(6+) Codex 최소 2개, 중소(3-5) 최소 1개 모듈 직접 구현

2. 결과 수집:
   - Claude: SendMessage 수신
   - CCB: pend 수집 (CCB_DONE marker 확인)

3. 교차 검증:
   - Codex → Claude 수정 코드 리뷰
   - Claude → Codex 수정 코드 검증
   ⚠️ 교차 리뷰가 아닌 교차 구현 + 교차 검증

4. Wave 완료 → 다음 Wave
5. 모든 Wave 완료 → 통합 커밋 → 셧다운
```
