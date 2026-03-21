# G6: CROSS-VERIFY — Procedural Details

## 진입 검증: 구현 코드 해시
```
hash(현재구현) != hash(G5승인구현) -> [IMPLEMENTATION TAMPERED] -> G5 회귀
```

## 3중 검증 파이프라인

**Verify 1: Mutation Testing**
- 도구: JS/TS->Stryker, Python->mutmut, Java->PIT, Shell->수동 mutation
- 구현 코드에 mutant 주입 -> 테스트 실행 -> mutation score 산출
- 통과: mutation score >= 60%
- 실패: 살아남은 mutant 목록 -> 테스트 보강

**Verify 2: Property-Based Test 실행**
- G4 Layer 2 PBT를 최소 100회 랜덤 입력으로 실행
- 반례 발견 시 자동 shrinking -> 최소 반례
- 통과: 반례 0건
- 실패: 최소 반례 반환 -> 구현 수정 후 G5 회귀

**Verify 3: Cross-Model Review**
- 구현을 만들지 않은 Agent C (Gemini)가 검토
- AGENT_CAPABILITY_DIRECTIVE 포함 (hive-quality-gates S6)
- 검토: SPEC 누락, 불변식 검증 여부, 놓친 엣지케이스
- verdict: PASS | CONCERN | REJECT
- REJECT -> 상호 토론 (G3과 동일한 debate 프로토콜)
- CONCERN -> 유저 판단 위임
