---
name: hive-spawn-templates
description: "Provider prompt templates for agent spawning. Loaded when /hive spawns agents."
user-invocable: false
---

# Hive Spawn Prompt Templates

Templates: [claude](templates/claude-agent.md) | [codex](templates/codex-agent.md) | [gemini](templates/gemini-agent.md)

## Variables

> `{{VAR}}` 변수는 Claude Code 공식 변수가 아닌 리드가 런타임에 직접 치환하는 커스텀 플레이스홀더입니다.

Static: `{{TEAM_NAME}}` `{{TEAM_ID}}` `{{AGENT_NAME}}` `{{MODEL}}` `{{MODULE_NAME}}` `{{MODULE_FILES}}` `{{MODULE_SYMBOLS}}` `{{DEPENDENCIES}}` `{{TASK_PROPOSAL}}` `{{CONSENSUS}}` `{{REQUIREMENTS}}` `{{PRIOR_CONSENSUS}}`
Dynamic: `{{ROUND_NUM}}` `{{WAVE_NUM}}` `{{FILE_PATH_N}}` `{{FILE_N_CONTENT}}` (max 5)

## Context Budget

리드=비즈니스+아키 | Claude=심볼+설계 | Codex=수정코드 | Gemini=요약+패턴
