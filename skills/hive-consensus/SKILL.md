---
name: hive-consensus
description: "Phase 4 AGREE/COUNTER/CLARIFY consensus protocol. Loaded when /hive enters Phase 4."
user-invocable: false
---
# Hive Consensus Protocol
Phase 4 양방향 합의 엔진. Enforcer가 detail Read를 강제합니다.

## 핵심 원칙
1. 모듈 범위 한정 — 각 에이전트는 자기 담당만 합의
2. 합의 필수 — CONSENSUS 전 구현 착수 금지
3. 건설적 반론 — 기술 문제 시 COUNTER 의무
4. 대등한 위치 — 리드/에이전트 동등 발언권
5. 효율적 토론 — 라운드 상한 5회
6. 양방향 대화 필수 — 일방적 결과 수집 금지
7. Phase 분리 — 합의(P4)와 구현(P5) 별도 프롬프트
8. G3 Plan Review 상호 토론 선행 필수

## 완료 조건
- 성공: 모든 팀 CONSENSUS 또는 LEAD DECISION → Phase 5 진입
- 실패(5라운드 초과): AskUserQuestion (리드 판단 / Phase 1 회귀 / 팀 제외)
