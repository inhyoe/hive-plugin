# Phase 3: Team Decomposition (팀 분해)

Phase 2의 영향 범위 맵을 기반으로 팀을 최대한 세분화합니다.

## 3-1. 팀 분할 알고리즘

```
Step A: 모듈 클러스터링
  각 모듈의 의존성 방향 분석:
  - 독립 모듈 (의존성 없음) → 각각 별도 팀
  - 강결합 모듈 (상호 의존) → 하나의 팀으로 묶음
  - 약결합 모듈 (단방향 의존) → 별도 팀 + 의존성 순서

Step B: 팀 규모 제한
  팀당 최대 2개 모듈 (초과 시 재분할)
  팀당 최소 1개 모듈 (의미 있는 작업 단위)

Step C: 의존성 → 실행 순서 (topological sort)
  foundation (model, repository) → 먼저
  feature (service, viewmodel) → 중간
  presentation (view, widget) → 마지막
```

## 3-2. 프로바이더 배치 전략

| 작업 성격 | Provider | 이유 |
|-----------|----------|------|
| 핵심 로직 / 아키텍처 설계 | **Claude** (Agent tool) | 복잡한 추론, 설계 판단 |
| 직접 구현 / 리팩터링 | **Codex** (`$HIVE_PLUGIN_DIR/scripts/tmux-ask.sh codex`) | 코드 생성 강점, 구체적 파일 수정 |
| 사전 리서치 / 체크리스트 / 문서 | **Gemini** (`$HIVE_PLUGIN_DIR/scripts/tmux-ask.sh gemini`) | 대량 토큰, 반복 작업 |
| 간단한 수정 / 설정 | **Claude haiku** (Agent tool) | 빠른 처리, 저비용 |
| TDD 격리 (Phase 5) | `hive-tdd-pipeline` §1 참조 | Claude=테스트, Codex=구현, Gemini=검증 |

### 프로바이더 분배 비율 (MANDATORY)

비율 상세: hive/SKILL.md `MULTI_PROVIDER_DISTRIBUTION` hard gate 참조.

| 규모 | Claude | Codex | Gemini | 강제 수준 |
|------|--------|-------|--------|----------|
| 대규모 (6+) | 50-60% | 20-30% (최소 2개 직접 구현) | 10-20% | hard gate |
| 중소 (3-5) | 핵심 2-3개 | 최소 1개 직접 구현 | 리서치 | guidance |
| 소규모 (1-2) | 단독 허용 | 사전 리뷰/사후 검증/테스트 중 1회 | 위임 | exception |

교차 검증: Codex↔Claude 상호 리뷰 (변경 diff + CONSENSUS 기준). 타임아웃 5분.

배치 규칙:
1. 팀 리드 = 항상 Claude main
2. 복잡도 높은 팀 = Claude sonnet/opus, 코드 중심 = Codex, 반복 작업 = Gemini
3. **팀 구성안에 프로바이더 분배 비율을 반드시 명시**

## 3-3. 팀 구성안 출력

팀 구성안을 아래 형식으로 사용자에게 표시:

```markdown
## Hive Team Plan

### 프로바이더 분배
| Provider | 모듈 수 | 비율 | 역할 |
|----------|--------|------|------|
| Claude   | N개    | 55%  | 핵심 로직, 아키텍처 |
| Codex    | N개    | 25%  | 직접 구현, 리팩터링 |
| Gemini   | N개    | 20%  | 리서치, 테스트, 문서 |

### 실행 순서: T1 → T2 → [T3, T4] (병렬) → T5

| 팀 ID | 모듈 | 에이전트 | Provider | 태스크 요약 |
|-------|------|---------|----------|------------|
| T1-xxx | module_a | agent-a | Claude sonnet | ... |
| T2-xxx | module_b | agent-b | **Codex** | ... |
| T3-xxx | module_c | agent-c | **Codex** | ... |
| T4-xxx | module_d | agent-d | Gemini | ... |

### 의존성
T2 blocked_by: [T1]
```

**필수 검증**: 대규모(6+)에서 Codex 직접 구현 모듈 최소 2개, 중소(3-5)에서 최소 1개 포함 확인.

## 3-4. 사용자 확인 (필수)

```
AskUserQuestion:
  "위 팀 구성안을 확인해주세요."
  Options:
    A. "승인 — 이대로 진행"
    B. "수정 필요 — 팀 분할 조정"
    C. "프로바이더 변경 — 특정 팀의 프로바이더 교체"
    D. "처음부터 다시"
```

수정 요청 시 해당 부분만 재조정 후 다시 확인.
