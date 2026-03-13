# Hive — 멀티 프로바이더 오케스트레이션 팀 빌더

[English](README.md) | **[한국어]** | [日本語](README.ja.md)

> **v2.0.0** — 7단계 품질 파이프라인 + 하드 게이트 강제

멀티 프로바이더 AI 팀(Claude/Codex/Gemini)을 구성하고, 연구 기반의 품질 파이프라인을 통해 **모든 사용자에게 동일한 품질 게이트를 강제**합니다.

```
[G1 CLARIFY] → [G2 SPEC] → 프롬프트 엔지니어링 → 브레인스톰 → Serena → 팀 구성
→ [G3 PLAN REVIEW] → 합의 → [G4 TDD RED] → [G5 IMPLEMENT GREEN]
→ [G6 CROSS-VERIFY] → [G7 E2E VALIDATE] → 완료
```

---

## 왜 v2.0.0인가?

기존 AI 코딩 워크플로우에는 3가지 근본 문제가 있습니다:

1. **모호한 요청은 모호한 코드를 낳는다** — 요구사항이 불명확하면 결과도 불명확
2. **테스트는 통과하는데 코드가 안 돌아간다** — 에이전트가 자기 가정을 검증하는 테스트를 작성
3. **책임 소재 없음** — 단일 에이전트 셀프 리뷰는 아무것도 잡지 못함

Hive v2.0.0은 이를 해결합니다:

- **필수 명확화** (G1+G2) — 작업 시작 전 반드시 범위/기준/제약 확인
- **에이전트 격리** — 테스트 작성자는 구현을 볼 수 없고, 구현자는 테스트 의도를 볼 수 없음 (CodeDelegator 패턴)
- **멀티 에이전트 교차 검증** — 뮤테이션 테스팅 + 속성 기반 테스팅 + 교차 모델 리뷰
- **하드 게이트** — 각 단계는 이전 마커가 존재해야만 진입 가능; 우회 불가

연구 근거: AgentSpec (ICSE 2026), TGen TDD (2024), Meta ACH (FSE 2025), CodeDelegator (2025), Du et al. 멀티 에이전트 토론 (2023), PGS PBT (FSE 2025).

---

## 주요 기능

### 품질 파이프라인 (7 하드 게이트)

| 게이트 | 이름 | 역할 | 강제 |
|--------|------|------|------|
| G1 | **CLARIFY** | 범위/성공기준/제약 명확화, 다지선다 질문 (최대 3라운드) | G2 진입 전 필수 |
| G2 | **SPEC** | 6섹션 자연어 명세 작성, 불변식 2개+, 경계조건 3개+, SHA256 해시 | Phase 0 진입 전 필수 |
| G3 | **PLAN REVIEW** | Designer↔Reviewer 상호 토론 (일방 리뷰 아님), 5차원 루브릭, 점수 >= 7.0 | Phase 4/5 진입 전 필수 |
| G4 | **TDD RED** | SPEC 기반 테스트 작성 (3계층: 예제/속성/스모크), 모든 테스트 FAIL 필수 | G5 진입 전 필수 |
| G5 | **IMPLEMENT GREEN** | 격리된 구현자가 모든 테스트 PASS (최대 5회 반복), 테스트 변조 탐지 | G6 진입 전 필수 |
| G6 | **CROSS-VERIFY** | 뮤테이션 테스팅 (>= 60%), PBT (100회+), 비관여 에이전트의 교차 리뷰 | G7 진입 전 필수 |
| G7 | **E2E VALIDATE** | 실제 실행 검증 (스크립트/통합/Hive 특화), mock 금지 | 완료 선언 전 필수 |

모든 게이트는 마커를 발행합니다 (예: `[CLARIFY PASSED — scope:{...}]`). 다음 게이트는 이전 마커의 존재를 확인합니다. **마커 없으면 진행 불가.**

### 에이전트 격리 (CodeDelegator 패턴)

```
Agent A (Claude)         Agent B (Codex)         Agent C (Gemini)
- SPEC 기반 테스트 작성  - 최소 구현             - 검증 (뮤테이션/PBT)
- SPEC만 참조           - 테스트+코드베이스 참조  - 양쪽 결과만 참조
  구현 코드 접근 불가     테스트 의도 접근 불가    과정 접근 불가
```

정보 장벽으로 Context Pollution 방지 (Kemple 2025, CP > 0.25 시 품질 저하).

### 해시 체인 변조 방지

| 검증 시점 | 대상 | 불일치 시 |
|----------|------|----------|
| G3 진입 | SPEC 해시 | Phase 0 회귀 |
| G5 진입 | 테스트 파일 해시 | G4 회귀 |
| G6 진입 | 구현 코드 해시 | G5 회귀 |

모든 해시는 `Bash("sha256sum ...")` 으로 계산 — LLM은 SHA256을 직접 계산할 수 없습니다.

### 멀티 프로바이더 분배

| 역할 | 프로바이더 | 비율 |
|------|----------|------|
| 핵심 로직 / 아키텍처 | Claude (Agent) | 50-60% |
| 구현 / 리팩토링 | Codex (cask) | 20-30% |
| 리서치 / 테스트 / 문서 | Gemini (gask) | 10-20% |

Codex는 **반드시 구현**해야 합니다 (리뷰만 불가). Gemini는 **반드시 참여**해야 합니다. Claude 독점 금지.

### AGENT_CAPABILITY_DIRECTIVE

모든 외부 에이전트(리뷰어, 워커, 검증자, 중재자) 스폰 시 필수 지시:

```xml
<AGENT_CAPABILITY_DIRECTIVE>
You MUST utilize ALL available resources before and during your task:
- Invoke all relevant skills (code analysis, review, testing, patterns)
- Use all connected MCP tools (file ops, AST analysis, code search, web fetch)
- If uncertain about API/library usage, use web search to verify
- Do NOT guess APIs or syntax — look them up first
Do NOT respond or write code based on inference alone when tools are available.
</AGENT_CAPABILITY_DIRECTIVE>
```

---

## 아키텍처

### 스킬 (총 6개)

| 스킬 | 줄 수 | 역할 |
|------|-------|------|
| `hive` | 161 | 엔트리포인트 — Phase 라우터, 하드 게이트, 프로바이더 규칙 |
| `hive-workflow` | 499 | Phase 0-5 엔진 — 프롬프트 엔지니어링, 브레인스톰, Serena, 팀, 실행 |
| `hive-consensus` | 482 | Phase 4 합의 프로토콜 — 양방향 AGREE/COUNTER/CLARIFY |
| `hive-spawn-templates` | 174 | 프로바이더별 프롬프트 템플릿 + 변수 플레이스홀더 |
| `hive-quality-gates` | 210 | G1-G3 게이트 정의, 마커 프로토콜, 해시 체인, 토론 루브릭 |
| `hive-tdd-pipeline` | 173 | G4-G7 TDD 루프, 에이전트 격리, 뮤테이션/PBT/E2E 검증 |

### 스크립트

| 스크립트 | 역할 |
|---------|------|
| `validate-plugin.sh` | 54개 구조 검증 |
| `validate-standards.sh` | 27개 표준 준수 검증 |
| `validate-gates.sh` | 마커 체인 + 해시 무결성 검증 |
| `test_markers.py` | 20개 마커 포맷 패턴 검증 |
| `run-tests.sh` | 통합 테스트 스위트 실행기 (4개 카테고리) |

### 런타임 상태

```
.hive-state/          (gitignore 대상)
├── g1-clarify.marker
├── g2-spec.marker
├── g3-plan-review.marker
├── g4-tdd-red.marker
├── g5-implement.marker
├── g6-cross-verify.marker
└── g7-e2e-validate.marker
```

마커는 파일로 저장하여 대화 컨텍스트 비대화를 방지합니다. 대화에는 `[G1 ✓] [G2 ✓] ...` 요약만 표시.

---

## 요구사항

- Claude Code CLI
- Serena MCP 서버 (코드베이스 분석용)
- CCB 브릿지 (Codex/Gemini 통합, 선택사항이나 권장)

## 설치

### 플러그인으로 설치

```bash
# 마켓플레이스 추가
/plugin marketplace add YOUR_GITHUB_USERNAME/hive-plugin

# 설치
/plugin install hive@YOUR_MARKETPLACE_NAME
```

### 수동 설치

```bash
cp -r skills/hive ~/.claude/skills/
cp -r skills/hive-consensus ~/.claude/skills/
cp -r skills/hive-workflow ~/.claude/skills/
cp -r skills/hive-spawn-templates ~/.claude/skills/
cp -r skills/hive-quality-gates ~/.claude/skills/
cp -r skills/hive-tdd-pipeline ~/.claude/skills/
```

## 사용법

```
/hive "앱에 채팅 기능 추가"
/hive "인증 모듈 리팩토링"
/hive "실시간 알림 구현"
```

품질 파이프라인은 자동으로 활성화됩니다. 명확화 질문(G1), SPEC 승인 요청(G2), 계획 토론(G3)을 거치고, 구현 전에 테스트가 먼저 작성됩니다(G4-G7).

## 파이프라인 흐름

```
/hive "사용자 요청"
  │
  ├─ G1: CLARIFY (범위/기준/제약 명확화)
  ├─ G2: SPEC (6섹션 명세 + SHA256 해시)
  │
  ├─ Phase 0: 프롬프트 엔지니어링 & 리소스 탐색
  ├─ Phase 1: 브레인스톰 (요구사항 명확화)
  ├─ Phase 2: Serena 컨텍스트 (코드베이스 분석)
  ├─ Phase 3: 팀 분해 (모듈 기반 분할)
  │
  ├─ G3: PLAN REVIEW (Designer↔Reviewer 상호 토론, 점수 >= 7.0)
  ├─ Phase 4: 합의 루프 (팀별 양방향 합의)
  │
  ├─ G4: TDD RED (SPEC 기반 테스트, 모든 테스트 FAIL)
  ├─ G5: IMPLEMENT GREEN (격리된 구현자, 모든 테스트 PASS)
  ├─ G6: CROSS-VERIFY (뮤테이션 >= 60%, PBT, 교차 모델 리뷰)
  ├─ G7: E2E VALIDATE (실제 실행, mock 금지)
  │
  └─ 완료 (7개 게이트 전부 통과)
```

## 합의 프로토콜

모든 에이전트는 담당 모듈에 대해 구현 전 CONSENSUS에 도달해야 합니다:

- **AGREE**: 제안된 접근 방식 수락
- **COUNTER**: 대안과 함께 기술적 문제 제기 (기술적 문제 발견 시 의무)
- **CLARIFY**: 추가 정보 요청

에이전트당 최대 5라운드. 교착 시 Gemini가 중재 (2/3 다수결). 3라운드 후 합의 실패 시 리드가 최종 결정.

## 검증

```bash
# 전체 테스트 (구조 + 마커 + CCB + 게이트)
bash scripts/run-tests.sh

# 개별 검증기
bash scripts/validate-plugin.sh      # 54개 구조 검증
bash scripts/validate-standards.sh   # 27개 표준 검증
bash scripts/validate-gates.sh       # 마커 체인 + 해시 무결성
python3 scripts/test_markers.py      # 20개 마커 포맷 검증
```

## 라이선스

MIT
