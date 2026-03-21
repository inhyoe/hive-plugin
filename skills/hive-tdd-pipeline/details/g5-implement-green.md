# G5: IMPLEMENT GREEN — Procedural Details

구현자: Agent B (Codex 또는 별도 Claude 세션)

## 정보 장벽
- 볼 수 있음: 테스트 파일, 기존 코드베이스, SPEC 문서
- 볼 수 없음: 테스트 작성자 의도/코멘트, G3 토론 내역

## 구현 루프 (TGen Remediation)
1. 최소 구현 작성
2. 테스트 실행
   - ALL PASS -> G5 통과
   - FAIL -> 에러 분석 -> 수정 -> 재실행 (max 5회)
3. 3회 연속 동일 테스트 실패 -> `[IMPLEMENTATION STUCK]` -> 유저 개입

## 안전장치: 테스트 변조 탐지
```
hash(현재테스트) != hash(G4승인테스트) -> [TEST TAMPERING DETECTED] -> G4 회귀
```
워커가 테스트 파일 수정 시 즉시 차단.

## 해시 기록

구현 코드 해시 기록: `Bash("sha256sum <impl_files> | cut -d' ' -f1")`
원본 보존: `Bash("cat <impl_files> > .hive-state/impl-content.txt")`
-> `.hive-state/g5-implement.marker`에 저장 (G6 진입 시 검증 대상)
