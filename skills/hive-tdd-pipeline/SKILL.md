---
name: hive-tdd-pipeline
description: TDD Red-Green-Verify pipeline for /hive Phase 5 execution. Enforces agent isolation, mutation testing, property-based testing, and E2E validation with hard gates G4-G7. Loaded when /hive enters Phase 5.
user-invocable: false
---

# Hive TDD Pipeline

> Phase 5 실행 시 G4~G7 TDD 루프 + 에이전트 격리 규칙.
> G1-G3 게이트는 `hive-quality-gates` 참조.
> 근거: TGen (2024), Meta ACH (FSE 2025), CodeDelegator (2025), PGS (FSE 2025).

---

## 1. 에이전트 격리 원칙 (CodeDelegator 기반)

```
Agent A (Claude)         Agent B (Codex)         Agent C (Gemini)
- 명세 기반 테스트 작성  - 최소 구현             - 검증 (mutation/PBT)
- SPEC만 참조           - 테스트+코드베이스 참조  - 양쪽 결과만 참조
🔒 구현 코드 접근 불가   🔒 테스트 의도 접근 불가  🔒 과정 접근 불가
```

정보 장벽으로 Context Pollution 방지 (Kemple 2025, CP > 0.25 시 품질 저하).

---

## 2. G4: TDD RED

<hard_gate rule="G4_RED_BEFORE_GREEN">
Do NOT proceed to G5 (IMPLEMENT) unless the conversation contains
[TDD RED PASSED — test_count:{N} fail_count:{N}] where fail_count == test_count.
Non-negotiable.
</hard_gate>

입력: G2 SPEC 문서 (코드 아닌 명세만)
작성자: Agent A (Claude) — 구현 코드 접근 불가

### 테스트 3계층

**Layer 1: Example-Based Tests**
- SPEC 입력/출력 쌍에서 도출
- 경계조건 최소 3개 (SPEC에서 가져옴)
- Happy path + Error path 분리
- 최소 5개

**Layer 2: Property-Based Tests (PBT)**
- SPEC 불변식을 직접 변환
- Wlaschin 7패턴 체크리스트:
  □ 역변환(round-trip)? □ 멱등성? □ 크기/구조 보존? □ 검증 용이성?
- 최소 2개 property

**Layer 3: Smoke Test Skeleton**
- 실제 실행 시나리오 골격 (G7에서 완성)

### 통과 조건
- ✅ 테스트 파일 존재
- ✅ 테스트 실행 시 전부 FAIL (구현 없으므로)
- ✅ Layer 1 ≥ 5개 + Layer 2 ≥ 2개

### 실패 조건
- ❌ 테스트가 이미 PASS → 구현에 의존 (오염 의심)
- ❌ Layer 2 부재 → PBT 추가 요구

테스트 파일 해시 기록: `Bash("sha256sum tests/* | cut -d' ' -f1")`
→ `.hive-state/g4-tdd-red.marker`에 저장

---

## 3. G5: IMPLEMENT GREEN

<hard_gate rule="G5_GREEN_BEFORE_VERIFY">
Do NOT proceed to G6 (CROSS-VERIFY) unless the conversation contains
[IMPLEMENT GREEN PASSED — pass:{N}/{N} iterations:{M}]. Non-negotiable.
</hard_gate>

구현자: Agent B (Codex 또는 별도 Claude 세션)

### 정보 장벽
- ✅ 볼 수 있음: 테스트 파일, 기존 코드베이스, SPEC 문서
- ❌ 볼 수 없음: 테스트 작성자 의도/코멘트, G3 토론 내역

### 구현 루프 (TGen Remediation)
1. 최소 구현 작성
2. 테스트 실행
   - ALL PASS → G5 통과
   - FAIL → 에러 분석 → 수정 → 재실행 (max 5회)
3. 3회 연속 동일 테스트 실패 → `[IMPLEMENTATION STUCK]` → 유저 개입

### 안전장치: 테스트 변조 탐지
```
hash(현재테스트) ≠ hash(G4승인테스트) → [TEST TAMPERING DETECTED] → G4 회귀
```
워커가 테스트 파일 수정 시 즉시 차단.

구현 코드 해시 기록: `Bash("sha256sum <impl_files> | cut -d' ' -f1")`
→ `.hive-state/g5-implement.marker`에 저장 (G6 진입 시 검증 대상)

---

## 4. G6: CROSS-VERIFY

<hard_gate rule="G6_VERIFY_BEFORE_E2E">
Do NOT proceed to G7 (E2E) unless the conversation contains
[CROSS-VERIFY PASSED — mutation:{%} pbt:{pass/fail} review:{verdict}]
with mutation >= 60 and pbt == pass and review != REJECT. Non-negotiable.
</hard_gate>

### 진입 검증: 구현 코드 해시
```
hash(현재구현) ≠ hash(G5승인구현) → [IMPLEMENTATION TAMPERED] → G5 회귀
```

### 3중 검증 파이프라인

**Verify 1: Mutation Testing**
- 도구: JS/TS→Stryker, Python→mutmut, Java→PIT, Shell→수동 mutation
- 구현 코드에 mutant 주입 → 테스트 실행 → mutation score 산출
- 통과: mutation score ≥ 60%
- 실패: 살아남은 mutant 목록 → 테스트 보강

**Verify 2: Property-Based Test 실행**
- G4 Layer 2 PBT를 최소 100회 랜덤 입력으로 실행
- 반례 발견 시 자동 shrinking → 최소 반례
- 통과: 반례 0건
- 실패: 최소 반례 반환 → 구현 수정 후 G5 회귀

**Verify 3: Cross-Model Review**
- 구현을 만들지 않은 Agent C (Gemini)가 검토
- AGENT_CAPABILITY_DIRECTIVE 포함 (hive-quality-gates §6)
- 검토: SPEC 누락, 불변식 검증 여부, 놓친 엣지케이스
- verdict: PASS | CONCERN | REJECT
- REJECT → 상호 토론 (G3과 동일한 debate 프로토콜)
- CONCERN → 유저 판단 위임

---

## 5. G7: E2E VALIDATE

<hard_gate rule="G7_E2E_BEFORE_COMPLETE">
Do NOT declare work complete unless the conversation contains
[E2E VALIDATE PASSED — type:{T} result:{...}]. Non-negotiable.
</hard_gate>

### Type A: 스크립트 실행 검증
대상: CLI, 스크립트, 플러그인
- 클린 환경에서 설치/실행
- SPEC 입력 → 기대 출력 비교

### Type B: 통합 시나리오 검증
대상: 멀티 모듈, API, 서비스
- 실제 의존성 연결 (mock 금지)
- 유저 시나리오 재현

### Type C: Hive 플러그인 특화 검증
대상: SKILL.md, plugin.json, 마커 포맷
- validate-plugin.sh → 38 checks PASS
- validate-standards.sh → 10범주 PASS
- test_markers.py → 15 checks PASS (마커 포맷 갱신 필요)
- 라인 수 500줄 미만

### 실패 시
에러 로그 + SPEC 대비 괴리 분석 → G5 회귀 (max 3회 → 유저 에스컬레이션)

---

## 6. 전체 흐름 요약

```
[G1 CLARIFY] → [G2 SPEC] → Phase 1-3 → [G3 PLAN REVIEW]
→ [G4 TDD RED] → [G5 IMPLEMENT GREEN] → [G6 CROSS-VERIFY]
→ [G7 E2E VALIDATE] → ✅ [QUALITY PIPELINE COMPLETE — 7/7]
```
