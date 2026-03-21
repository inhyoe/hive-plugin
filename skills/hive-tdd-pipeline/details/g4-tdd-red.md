# G4: TDD RED — Procedural Details

입력: G2 SPEC 문서 (코드 아닌 명세만)
작성자: Agent A (Claude) — 구현 코드 접근 불가

## 테스트 3계층

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

## 통과 조건
- 테스트 파일 존재
- 테스트 실행 시 전부 FAIL (구현 없으므로)
- Layer 1 >= 5개 + Layer 2 >= 2개

## 실패 조건
- 테스트가 이미 PASS -> 구현에 의존 (오염 의심)
- Layer 2 부재 -> PBT 추가 요구

## 해시 기록

테스트 파일 해시 기록: `Bash("sha256sum tests/* | cut -d' ' -f1")`
원본 보존: `Bash("cat tests/* > .hive-state/test-content.txt")`
-> `.hive-state/g4-tdd-red.marker`에 저장
