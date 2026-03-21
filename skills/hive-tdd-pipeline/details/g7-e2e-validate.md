# G7: E2E VALIDATE — Procedural Details

## Type A: 스크립트 실행 검증
대상: CLI, 스크립트, 플러그인
- 클린 환경에서 설치/실행
- SPEC 입력 -> 기대 출력 비교

## Type B: 통합 시나리오 검증
대상: 멀티 모듈, API, 서비스
- 실제 의존성 연결 (mock 금지)
- 유저 시나리오 재현

## Type C: Hive 플러그인 특화 검증
대상: SKILL.md, plugin.json, 마커 포맷
- validate-plugin.sh -> ALL checks PASS
- validate-standards.sh -> ALL categories PASS
- test_markers.py -> ALL checks PASS
- 라인 수 500줄 미만

## 실패 시
에러 로그 + SPEC 대비 괴리 분석 -> G5 회귀 (max 3회 -> 유저 에스컬레이션)
