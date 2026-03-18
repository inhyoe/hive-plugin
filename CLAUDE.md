# Hive Plugin — Project Rules

## Obsidian 연동

```yaml
obsidian_project:
  folder: "01 Projects/50 Hive Plugin"
  vault_path: "/home/ryu-ubuntu/Document/ObsidianVault/저장용"
  current_sprint: 0
  sprint_heading: "⬜ Sprint 0 — 초기 설정"
```

## /hive 워크플로우 강제 (MANDATORY)

/hive가 호출되면 SKILL.md에 정의된 전체 워크플로우를 **무조건** 따라야 한다.

```
필수 실행 순서 (생략 불가):
  G1 CLARIFY → G2 SPEC → Phase 0 (Prompt Eng + AskUserQuestion)
  → Phase 1 (Brainstorm + 접근방식 선택 AskUserQuestion)
  → Phase 2 (Serena MCP)
  → Phase 3 (Team Decomposition + AskUserQuestion)
  → Phase 4 (Consensus — 양방향 대화 필수)
  → Phase 5 (TDD Pipeline G4-G7)
```

### 금지된 합리화

| 합리화 시도 | 왜 틀린가 |
|------------|----------|
| "검증/감사 작업이라 프로토콜 불필요" | 작업 유형과 무관하게 100% 적용 |
| "효율을 위해 직접 처리하겠다" | 사용자가 /hive를 호출한 것은 프로토콜 사용 의사 |
| "간단한 작업이라 축소" | 프로토콜은 복잡도와 무관 |
| "Phase N은 이 작업에 불필요" | 모든 Phase는 필수. 사용자만 "그냥 진행해"로 축소 가능 |
| "Read/Glob으로 Serena 대체" | Serena 미사용 시 사용자에게 알리고 대안 확인 |

> 추가 합리화 패턴은 `skills/hive/SKILL.md`의 `<STOP_AND_VERIFY>` 섹션 참조.

### 위반 시 자기 점검

/hive 실행 중 아래 질문에 "아니오"가 하나라도 있으면 중단하고 누락 단계를 실행할 것:
- [ ] G1 CLARIFY 마커를 발행했는가?
- [ ] G2 SPEC + sha256 해시를 생성했는가?
- [ ] Phase 0에서 AskUserQuestion으로 사용자 확인을 받았는가?
- [ ] Phase 1에서 접근방식 선택 AskUserQuestion을 실행했는가?
- [ ] Phase 3에서 팀 구성안 AskUserQuestion을 실행했는가?
- [ ] Phase 4에서 모든 팀의 합의/LEAD DECISION을 확인했는가?
- [ ] validate-phase5-entry.sh를 실행했는가?

> 글로벌 CLAUDE.md의 Peer Review Framework는 /hive 외부 작업 기준.
> /hive 내에서는 hive-consensus 프로토콜이 우선한다.

## 세션 학습 기록 (MANDATORY)

작업 완료 후, 사용자에게 최종 응답을 보내기 **전에** 아래를 수행:
1. 이 세션에서 교정/발견/의사결정이 있었는지 자체 점검
2. 있었다면 `obsidian-project-sync` 스킬을 invoke하여 learnings/ 또는 decisions/에 기록
3. 없었다면 "기록할 학습 없음" 1줄 명시

이 단계는 Stop hook의 safety net보다 **선행**해야 한다.
Stop hook에서 차단당한다는 것은 이 단계를 이미 빠뜨렸다는 의미.

적용 범위: /hive Phase 5 종료 후, 일반 작업 완료 후, 코드 수정 완료 후 — 모든 세션.
