# G2: SPEC Gate — Procedural Details

자연어 명세 6개 섹션:

```
## 기능 명세
- 목적: {왜 이 변경이 필요한가}
- 입력: {어떤 데이터/이벤트가 트리거하는가}
- 출력: {기대되는 결과물/상태 변화}
- 불변식: {항상 참이어야 하는 조건들} — 최소 2개 (Wlaschin 7패턴 참조)
- 경계조건: {엣지케이스 목록} — 최소 3개
- 비기능: {성능/보안/호환성 요구사항}
```

통과: 6섹션 비어있지 않음 + 불변식 2+ + 경계조건 3+
마커: `[SPEC APPROVED — hash:{sha256}]`

해시 계산 (LLM은 SHA256 계산 불가 — 반드시 Bash 도구 사용):

```bash
mkdir -p .hive-state
cat > .hive-state/spec-content.txt <<'EOF'
{SPEC내용}
EOF
sha256sum .hive-state/spec-content.txt | cut -d' ' -f1
printf '%s\n' '[SPEC APPROVED — hash:{sha256}]' > .hive-state/g2-spec.marker
```

불변식 → G4에서 Property-Based Test로 직접 변환.
근거: PGS (FSE 2025) — 명세 기반이면 자기기만 사이클 차단.
