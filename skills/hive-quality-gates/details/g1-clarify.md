# G1: CLARIFY Gate — Procedural Details

유저 요청 수신 시 3가지 명확성 기준 검사:

1. **범위(Scope)**: 어떤 파일/모듈이 영향받는가?
2. **성공기준(Criteria)**: 완료 조건이 측정 가능한가?
3. **제약(Constraints)**: 성능/호환성/의존성 제한?

3개 모두 충족 → `[CLARIFY PASSED — scope:{...} criteria:{...} constraints:{...}]`
불명확 → 다지선다 질문 (1회 1질문, max 3라운드)
3라운드 후 불명확 → `[CLARIFY ESCALATED]` + 유저 직접 명세 요청

마커/원문 저장:

```bash
mkdir -p .hive-state
cat > .hive-state/clarify-content.txt <<'EOF'
scope:{...}
criteria:{...}
constraints:{...}
EOF
printf '%s\n' '[CLARIFY PASSED — scope:{...} criteria:{...} constraints:{...}]' \
  > .hive-state/g1-clarify.marker
```

질문 규칙 (ICLR 2025):
- 반드시 다지선다 (2~4개 선택지)
- 1회 1질문
- 불명확한 축 하나만 타겟팅
