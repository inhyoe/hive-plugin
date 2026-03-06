# Hive — Multi-Provider Orchestration Team Builder

Build and orchestrate multi-provider AI teams (Claude/Codex/Gemini) through a structured pipeline: **Brainstorm → Serena Context → Team Decomposition → Consensus → Execute**.

## Features

- **Brainstorm Phase**: 5-dimension requirement evaluation with guided Q&A
- **Serena Context**: Automatic codebase analysis via Serena MCP (symbols, dependencies, impact mapping)
- **Team Decomposition**: Service/module-based team splitting (max 2 modules per team) with optimal provider assignment
- **Consensus Protocol**: Bidirectional AGREE/COUNTER/CLARIFY agreement — no implementation before consensus
- **Multi-Provider Execution**: Claude (native Agent), Codex (CCB cask), Gemini (CCB gask) in parallel waves

## Requirements

- Claude Code CLI
- Serena MCP server (for codebase analysis)
- CCB bridge (for Codex/Gemini integration, optional)

## Installation

### As a Plugin

Add the marketplace and install:

```bash
# Add marketplace (replace with your GitHub username)
/plugin marketplace add YOUR_GITHUB_USERNAME/hive-plugin

# Install
/plugin install hive@YOUR_MARKETPLACE_NAME
```

### Manual Installation

Copy files to your Claude Code config:

```bash
# Skills (directory structure)
cp -r skills/hive-consensus ~/.claude/skills/
cp -r skills/hive-workflow ~/.claude/skills/
cp -r skills/hive-spawn-templates ~/.claude/skills/

# Command
cp commands/hive.md ~/.claude/commands/
```

## Usage

```
/hive "Add chat feature to the app"
/hive "Refactor authentication module"
/hive "Implement real-time notifications"
```

## Pipeline Flow

```
/hive "user request"
  │
  ├─ Phase 1: Brainstorm (requirement clarification)
  ├─ Phase 2: Serena Context (codebase analysis)
  ├─ Phase 3: Team Decomposition (module-based splitting)
  ├─ Phase 4: Consensus Loop (bidirectional agreement)
  └─ Phase 5: Execute & Monitor (wave-based execution)
```

## Provider Assignment

| Task Type | Provider | Reason |
|-----------|----------|--------|
| Core logic / Architecture | Claude (Agent) | Complex reasoning |
| Implementation / Refactoring | Codex (cask) | Code generation |
| Tests / Documentation | Gemini (gask) | Large token, repetitive |
| Simple config | Claude haiku | Fast, low cost |

## Consensus Protocol

Every agent must reach CONSENSUS on their assigned module before implementation begins:

- **AGREE**: Accept the proposed approach
- **COUNTER**: Raise concerns with alternative suggestion
- **CLARIFY**: Request additional information

Max 5 rounds per agent. Lead makes final decision if consensus fails.

## License

MIT
