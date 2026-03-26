# Hive — 멀티 프로바이더 AI 팀 오케스트레이션 플러그인

[English](README.md) | **[한국어]** | [日本語](README.ja.md)

> **v3.1.0** — 7단계 품질 파이프라인 + 하드 게이트 강제

멀티 프로바이더 AI 팀(Claude, Codex, Gemini)을 연구 기반 품질 파이프라인으로 오케스트레이션합니다. 복잡한 작업을 팀 기반 모듈로 분해하고, 합의 기반 설계를 강제하며, 엄격한 TDD 파이프라인을 통해 실행합니다 — 실시간 시각화 대시보드와 함께.

```text
/hive "실시간 채팅 기능 추가"

  G1 CLARIFY ─→ G2 SPEC ─→ 프롬프트 엔지니어링 ─→ 브레인스톰 ─→ Serena 컨텍스트
       ─→ 팀 분해 ─→ G3 PLAN REVIEW ─→ 합의
       ─→ G4 TDD RED ─→ G5 IMPLEMENT GREEN ─→ G6 CROSS-VERIFY
       ─→ G7 E2E VALIDATE ─→ 완료
```

---

## 문제

기존 AI 코딩 워크플로우의 근본 문제:

1. **모호한 요청은 모호한 코드를 낳는다** — 사전 명확화 없음
2. **자기 검증 테스트** — 에이전트가 자기 가정을 확인하는 테스트를 작성
3. **책임 소재 없음** — 단일 에이전트 셀프 리뷰는 아무것도 잡지 못함

## Hive의 해결 방식

- **필수 명확화** (G1 + G2) — 작업 시작 전 반드시 범위/기준/제약 확인
- **에이전트 격리** — 테스트 작성자는 구현을 볼 수 없고, 구현자는 테스트 의도를 볼 수 없음 (CodeDelegator 패턴)
- **멀티 에이전트 교차 검증** — 뮤테이션 테스팅 + 속성 기반 테스팅 + 교차 모델 리뷰
- **하드 게이트** — 각 단계는 이전 마커가 존재해야만 진입 가능; 우회 불가

연구 근거: AgentSpec (ICSE 2026), TGen TDD (2024), Meta ACH (FSE 2025), CodeDelegator (2025), Du et al. 멀티 에이전트 토론 (2023), PGS PBT (FSE 2025).

---

## 주요 기능

### 7 하드 품질 게이트

| 게이트 | 이름 | 역할 | 진입 조건 |
|--------|------|------|-----------|
| G1 | CLARIFY | 범위/성공기준/제약 명확화, 다지선다 질문 (최대 3라운드) | — |
| G2 | SPEC | 6섹션 자연어 명세, 불변식 2개+, 경계조건 3개+, SHA256 해시 | G1 통과 |
| G3 | PLAN REVIEW | Designer↔Reviewer 상호 토론, 5차원 루브릭, 점수 >= 7.0 | G2 통과 |
| G4 | TDD RED | SPEC 기반 테스트 작성 (예제 + 속성 + 스모크), 모든 테스트 FAIL 필수 | G3 통과 |
| G5 | IMPLEMENT GREEN | 격리된 구현자가 모든 테스트 PASS (최대 5회 반복) | G4 통과 |
| G6 | CROSS-VERIFY | 뮤테이션 테스팅 (>= 60%), PBT (100회+), 교차 모델 리뷰 | G5 통과 |
| G7 | E2E VALIDATE | 실제 실행 검증, mock 금지 | G6 통과 |

모든 게이트는 마커 파일을 발행합니다. **마커 없으면 진행 불가.**

### 에이전트 격리 (CodeDelegator 패턴)

```text
Agent A (Claude)           Agent B (Codex)          Agent C (Gemini)
├─ SPEC 기반 테스트 작성    ├─ 코드 구현              ├─ 뮤테이션/PBT 검증
├─ 구현 코드 접근 불가      ├─ 테스트 의도 접근 불가   ├─ 과정 접근 불가
└─ SPEC만 참조             └─ 테스트+코드베이스 참조   └─ 양쪽 결과만 참조
```

정보 장벽으로 Context Pollution 방지 — 에이전트 간 컨텍스트 오염 시 품질 저하 (Kemple 2025, CP > 0.25 임계값).

### 해시 체인 변조 방지

| 검증 시점 | 대상 | 불일치 시 |
|----------|------|----------|
| G3 진입 | SPEC 해시 | Phase 0 회귀 |
| G5 진입 | 테스트 파일 해시 | G4 회귀 |
| G6 진입 | 구현 코드 해시 | G5 회귀 |

### 멀티 프로바이더 팀 역할

| 역할 | 프로바이더 | 비율 |
|------|----------|------|
| 핵심 로직 / 아키텍처 | Claude (Agent) | 50-60% |
| 구현 / 리팩토링 | Codex | 20-30% |
| 리서치 / 테스트 / 문서 | Gemini | 10-20% |

Codex는 **반드시 구현**해야 합니다 (리뷰만 불가). Gemini는 **반드시 참여**해야 합니다. Claude 독점 금지.

### 합의 프로토콜

모든 팀은 구현 전 합의에 도달해야 합니다:

- **AGREE** — 제안된 접근 방식 수락
- **COUNTER** — 대안과 함께 기술적 문제 제기 (기술적 문제 발견 시 의무)
- **CLARIFY** — 추가 정보 요청

팀당 최대 5라운드. 교착 시 Gemini가 중재 (2/3 다수결). 5라운드 후 합의 실패 시 리드가 최종 결정.

### 실시간 대시보드

Next.js 대시보드와 WebSocket 이벤트 서버가 오케스트레이션 파이프라인을 실시간으로 시각화합니다:

- **토폴로지 그래프** — 에이전트 관계 및 데이터 흐름 (@xyflow/react 기반)
- **파이프라인 패널** — 게이트 진행 상황 및 Phase 추적
- **에이전트 상세 패널** — 개별 에이전트 상태 및 출력
- **이벤트 로그** — 실시간 이벤트 스트림
- **결과 요약** — 최종 실행 결과

```bash
# 대시보드 실행
cd dashboard && npm run dev          # Next.js (localhost:3000)
cd dashboard/server && npm run dev   # WebSocket 이벤트 서버
```

---

## 아키텍처

### 프로젝트 구조

```text
hive-plugin/
├── skills/                     # 6개 스킬 모듈 (총 1,778줄)
│   ├── hive/                   # 엔트리포인트 — Phase 라우터, 하드 게이트, 프로바이더 규칙
│   ├── hive-workflow/          # Phase 0-5 엔진 — 프롬프트 엔지니어링, 브레인스톰, Serena, 팀, 실행
│   ├── hive-consensus/         # Phase 4 합의 — 양방향 AGREE/COUNTER/CLARIFY
│   ├── hive-spawn-templates/   # 프로바이더별 프롬프트 템플릿 + 변수 플레이스홀더
│   ├── hive-quality-gates/     # G1-G3 게이트 정의, 마커 프로토콜, 해시 체인, 토론 루브릭
│   └── hive-tdd-pipeline/      # G4-G7 TDD 루프, 에이전트 격리, 뮤테이션/PBT/E2E
├── dashboard/                  # 실시간 시각화 (Next.js + WebSocket)
│   ├── src/                    # React 컴포넌트, Zustand 스토어, 훅
│   └── server/                 # WebSocket 이벤트 서버 (chokidar + ws)
├── hooks/                      # Claude Code 훅 통합
│   ├── hooks.json              # SessionStart + PostToolUse 훅 정의
│   └── scripts/                # setup-dashboard.sh, validate-skills.sh
├── scripts/                    # 검증 및 테스트
│   ├── validate-plugin.sh      # 54개 구조 검증
│   ├── validate-standards.sh   # 27개 표준 준수 검증
│   ├── validate-gates.sh       # 마커 체인 + 해시 무결성 검증
│   ├── validate-phase5-entry.sh# 팀 합의 마커 검증
│   ├── validate-all.sh         # 통합 실행기 (전체 검증기)
│   ├── test_markers.py         # 20개 마커 포맷 패턴 테스트
│   └── run-tests.sh            # 전체 테스트 스위트 실행기
├── systemd/                    # Auto-debug 타이머 (주기적 검증)
├── .claude-plugin/plugin.json  # 플러그인 매니페스트
├── marketplace.json            # 플러그인 마켓플레이스 등록
├── install-systemd.sh          # Systemd auto-debug 설치기
└── uninstall-systemd.sh        # Systemd auto-debug 제거기
```

### 스킬

| 스킬 | 줄 수 | 역할 |
|------|-------|------|
| `hive` | 238 | 엔트리포인트 — Phase 라우터, 하드 게이트, 프로바이더 규칙 |
| `hive-workflow` | 500 | Phase 0-5 엔진 — 프롬프트 엔지니어링, 브레인스톰, Serena, 팀, 실행 |
| `hive-consensus` | 456 | Phase 4 합의 프로토콜 — 양방향 AGREE/COUNTER/CLARIFY |
| `hive-quality-gates` | 228 | G1-G3 게이트 정의, 마커 프로토콜, 해시 체인, 토론 루브릭 |
| `hive-spawn-templates` | 181 | 프로바이더별 프롬프트 템플릿 + 변수 플레이스홀더 |
| `hive-tdd-pipeline` | 175 | G4-G7 TDD 루프, 에이전트 격리, 뮤테이션/PBT/E2E 검증 |

### 훅

Hive는 `hooks/hooks.json`을 통해 Claude Code 훅을 등록합니다:

| 이벤트 | 핸들러 | 역할 |
|--------|--------|------|
| `SessionStart` | `setup-dashboard.sh` | 첫 사용 시 대시보드 의존성 자동 설치 |
| `PostToolUse` (Edit/Write) | `validate-skills.sh` | 스킬 파일 수정 시 자동 검증 |

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

- **Claude Code CLI** (최신 버전)
- **Serena MCP 서버** — Phase 2 코드베이스 분석용
- **tmux-bridge** — Codex/Gemini 통합 (선택사항이나 완전한 멀티 프로바이더 오케스트레이션에 권장)
- **Node.js** — 실시간 대시보드용

## 설치

### 플러그인 마켓플레이스

```bash
# 마켓플레이스 추가
/plugin marketplace add inhyoe/hive-plugin

# 설치
/plugin install hive@hive-marketplace
```

### 수동 설치

설치 스크립트는 심볼릭 링크를 생성하므로, `git pull`만으로 Hive를 사용하는 모든 프로젝트가 자동 업데이트됩니다.

```bash
# 설치 (심볼릭 링크 생성 — git pull로 모든 프로젝트 자동 업데이트)
bash install.sh

# 변경 없이 미리보기
bash install.sh --dry-run

# 사용자 지정 경로에 설치
bash install.sh --claude-home /path/to/.claude

# 제거
bash install.sh --uninstall
```

### Auto-Debug 타이머 (선택)

주기적 검증을 위한 systemd 타이머를 설정합니다:

```bash
# 설치
bash install-systemd.sh

# 설정
vim ~/.config/claude-auto-debug/config.env  # PROJECT_DIR 지정

# 제거
bash uninstall-systemd.sh
```

## 사용법

```bash
/hive "앱에 채팅 기능 추가"
/hive "인증 모듈 리팩토링"
/hive "실시간 알림 구현"
```

품질 파이프라인은 자동으로 활성화됩니다:

1. **G1 CLARIFY** — 범위 질문에 답변 (다지선다, 최대 3라운드)
2. **G2 SPEC** — 6섹션 명세가 생성되어 승인 요청
3. **Phase 0-3** — 프롬프트 엔지니어링, 브레인스톰, 코드베이스 분석, 팀 분해
4. **G3 PLAN REVIEW** — Designer와 Reviewer가 계획을 토론 (점수 >= 7.0 통과)
5. **Phase 4** — 각 팀이 AGREE/COUNTER/CLARIFY를 통해 합의 (`validate-phase5-entry.sh`로 검증)
6. **G4-G7** — TDD 파이프라인: 테스트 우선 (RED), 구현 (GREEN), 교차 검증, E2E 검증

## 검증

```bash
# 전체 검증기 한 번에 실행 (총 146개 체크)
bash scripts/validate-all.sh

# 개별 검증기
bash scripts/validate-plugin.sh       # 54개 구조 검증
bash scripts/validate-standards.sh    # 27개 표준 검증
bash scripts/validate-gates.sh        # 마커 체인 + 해시 무결성
bash scripts/validate-phase5-entry.sh # 팀 합의 마커
python3 scripts/test_markers.py       # 20개 마커 포맷 검증

# 전체 테스트 스위트
bash scripts/run-tests.sh
```

## 표준 준수

- [Agent Skills Open Standard](https://agentskills.io) — 완전 준수
- Claude Code Plugin Reference — 완전 준수
- 전체 146개 검증 통과

## 라이선스

MIT
