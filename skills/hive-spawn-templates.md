---
name: hive-spawn-templates
description: /hive Phase 4-5에서 에이전트 스폰 시 사용하는 프로바이더별 프롬프트 템플릿.
---

# Hive Spawn Prompt Templates

> `/hive`가 에이전트를 스폰할 때 사용하는 프롬프트 템플릿.
> 변수(`{{VAR}}`)를 실제 값으로 치환하여 사용.

---

## 1. 변수 정의

| 변수 | 설명 | 소스 |
|------|------|------|
| `{{TEAM_NAME}}` | 팀 이름 (hive-{id}) | Phase 3 팀 구성 |
| `{{TEAM_ID}}` | 팀 ID (T1, T2, ...) | Phase 3 팀 구성 |
| `{{AGENT_NAME}}` | 에이전트 이름 | Phase 3 팀 구성 |
| `{{PROVIDER}}` | claude/codex/gemini | Phase 3 프로바이더 배치 |
| `{{MODEL}}` | sonnet/opus/haiku | Phase 3 프로바이더 배치 |
| `{{MODULE_NAME}}` | 담당 모듈명 | Phase 2 영향 범위 맵 |
| `{{MODULE_FILES}}` | 담당 파일 목록 | Phase 2 영향 범위 맵 |
| `{{MODULE_SYMBOLS}}` | 핵심 심볼 목록 | Phase 2 Serena 결과 |
| `{{DEPENDENCIES}}` | 의존 모듈 목록 | Phase 2 의존성 맵 |
| `{{TASK_PROPOSAL}}` | TASK PROPOSAL 전문 | Phase 4 합의 시작 시 |
| `{{CONSENSUS}}` | CONSENSUS 문서 전문 | Phase 4 합의 완료 후 |
| `{{REQUIREMENTS}}` | 요구사항 요약 | Phase 1 결과 |
| `{{PRIOR_CONSENSUS}}` | 선행 팀 합의 (의존성) | Phase 4 크로스 의존성 |

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
[HIVE CONSENSUS REQUEST — {{TEAM_ID}}]

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

### 3-2. 구현 단계

```
CCB_CALLER=claude ask codex "
[HIVE IMPLEMENTATION — {{TEAM_ID}}]

당신은 {{MODULE_NAME}} 모듈의 구현을 담당합니다.

## CONSENSUS (합의된 내용)
{{CONSENSUS}}

## 모듈 정보
- 파일: {{MODULE_FILES}}
- 심볼: {{MODULE_SYMBOLS}}

## 규칙
- CONSENSUS 범위만 구현 (추가 기능 금지)
- 기존 코드 스타일 준수
- 완료 후 보고: 변경 파일, 핵심 변경, CONSENSUS 일치 여부
"
```

---

## 4. Gemini 에이전트 스폰 프롬프트

### 4-1. 합의 단계

Codex와 동일 구조, `ask codex` → `ask gemini`으로 변경.

```
CCB_CALLER=claude ask gemini "
[HIVE CONSENSUS REQUEST — {{TEAM_ID}}]
... (Codex 합의 프롬프트와 동일 구조)
"
```

### 4-2. 구현 단계

```
CCB_CALLER=claude ask gemini "
[HIVE IMPLEMENTATION — {{TEAM_ID}}]
... (Codex 구현 프롬프트와 동일 구조)
"
```

---

## 5. 리드 행동 가이드

### 5-1. 합의 단계 리드 동작

```
1. TeamCreate(team_name="hive-{session_id}")
2. 독립 팀들에게 동시 TASK PROPOSAL 전송:
   - Claude: Agent tool (합의 프롬프트)
   - Codex: cask (합의 프롬프트)
   - Gemini: gask (합의 프롬프트)
3. 응답 수집:
   - Claude: SendMessage 자동 수신
   - CCB: pend로 수집
4. 응답 파싱 → AGREE/COUNTER/CLARIFY 판별
5. 필요 시 합의 루프 반복 (max 5 rounds)
6. CONSENSUS 문서 생성
7. 의존 팀 합의 시작 트리거
```

### 5-2. 구현 단계 리드 동작

```
1. Wave별 실행:
   - Wave N의 팀들에게 동시 구현 프롬프트 전송
2. 결과 수집:
   - Claude: SendMessage 수신
   - CCB: pend 수집
3. 결과 검증:
   - CONSENSUS와 일치하는지 확인
   - 불일치 시 재지시 또는 직접 수정
4. Wave 완료 → 다음 Wave
5. 모든 Wave 완료 → 셧다운
```
