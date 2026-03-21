---
name: hive
description: "Entry point for /hive. Defines hard gates, phase router, dashboard. Use when user types /hive."
argument-hint: "[task-description]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, Agent, TaskCreate, TaskUpdate, TaskList, TaskGet, SendMessage, mcp__serena-shared__list_dir, mcp__serena-shared__search_for_pattern, mcp__serena-shared__get_symbols_overview, mcp__serena-shared__find_symbol, mcp__serena-shared__find_referencing_symbols, mcp__plugin_prompts_chat_prompts_chat__improve_prompt, mcp__plugin_prompts_chat_prompts_chat__search_skills, mcp__plugin_prompts_chat_prompts_chat__search_prompts
---

# /hive v3.1.0

$ARGUMENTS

## Hard Gates
- CONSENSUS_BEFORE_IMPLEMENTATION: 합의 전 구현 금지
- BIDIRECTIONAL_COMMUNICATION: 양방향 대화 필수
- CODEX_MUST_IMPLEMENT: Codex는 구현자 (대규모 2+, 중소 1+)
- MULTI_PROVIDER_DISTRIBUTION: Claude 50-60%, Codex 20-30%, Gemini 10-20%

## Phase Router
G1→G2→P0→P1→P2→P3→G3→P4→P5→P6
Enforcer가 Phase 전환 시 필수 detail 파일 Read를 강제합니다.
