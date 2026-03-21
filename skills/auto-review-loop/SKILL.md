---
name: auto-review-loop
description: "Automated Codex review loop for PR code. Use on /auto-review-loop or '자동 리뷰'."
argument-hint: "[--max N] [--base branch]"
user-invocable: true
---

# Auto Review Loop

$ARGUMENTS

Codex 리뷰 → Claude 수정 → Codex 재검증 자동 반복 루프.
`/auto-review-loop [--max N] [--base branch]`

## Flow
P1 사전검증 → P2 리뷰요청 → P3 수정+검증 → P4 완료

## 종료
`NO ISSUES FOUND`→완료 | 동일이슈 2회→중단 | max도달→중단 | ping실패→중단/fallback | diff없음/5000줄+→중단

## Rules
ask codex 후 턴종료 | autonew 필수 | 커밋 `fix(auto-review):` | push 사용자확인
