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

### 금지된 합리화 & 위반 시 자기 점검

상세: `skills/hive/SKILL.md` 의 `<STOP_AND_VERIFY>` 섹션 참조.
핵심 원칙: 작업 유형/복잡도와 무관하게 전체 Phase 100% 적용. 사용자만 "그냥 진행해"로 축소 가능.

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
