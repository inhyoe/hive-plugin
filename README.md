# Hive — Multi-Provider AI Team Orchestration Plugin

**[English]** | [한국어](README.ko.md) | [日本語](README.ja.md)

> **v3.1.0** — 7-Stage Quality Pipeline with Hard Gate Enforcement

Orchestrate multi-provider AI teams (Claude, Codex, Gemini) through a research-backed quality pipeline. Hive decomposes complex tasks into team-based modules, enforces consensus-driven planning, and executes through a strict TDD pipeline — all with real-time visualization.

```
/hive "Add real-time chat feature"

  G1 CLARIFY ─→ G2 SPEC ─→ Prompt Eng ─→ Brainstorm ─→ Serena Context
       ─→ Team Decomposition ─→ G3 PLAN REVIEW ─→ Consensus
       ─→ G4 TDD RED ─→ G5 IMPLEMENT GREEN ─→ G6 CROSS-VERIFY
       ─→ G7 E2E VALIDATE ─→ Done
```

---

## The Problem

Traditional AI coding workflows suffer from:

1. **Ambiguous requests** produce ambiguous code — no upfront clarification
2. **Self-validating tests** — agents write tests that confirm their own assumptions
3. **No accountability** — single-agent self-review catches nothing

## How Hive Solves It

- **Mandatory clarification** (G1 + G2) before any work begins
- **Agent isolation** — test writer cannot see implementation; implementer cannot see test intent (CodeDelegator pattern)
- **Multi-agent cross-verification** — mutation testing, property-based testing, and cross-model review
- **Hard gates** — each stage is blocked until the previous marker exists; no shortcuts

Research: AgentSpec (ICSE 2026), TGen TDD (2024), Meta ACH (FSE 2025), CodeDelegator (2025), Du et al. Multi-Agent Debate (2023), PGS PBT (FSE 2025).

---

## Features

### 7 Hard Quality Gates

| Gate | Name | What It Does | Blocked Until |
|------|------|-------------|---------------|
| G1 | CLARIFY | Scope/criteria/constraints via multiple-choice (max 3 rounds) | — |
| G2 | SPEC | 6-section natural language spec with invariants (2+) and edge cases (3+), SHA256-hashed | G1 passed |
| G3 | PLAN REVIEW | Designer↔Reviewer mutual debate, 5-dimension rubric, score >= 7.0 | G2 passed |
| G4 | TDD RED | SPEC-only test writing (example + property + smoke), all tests must FAIL | G3 passed |
| G5 | IMPLEMENT GREEN | Isolated implementer makes all tests pass (max 5 iterations) | G4 passed |
| G6 | CROSS-VERIFY | Mutation testing (>= 60%), PBT (100+ runs), cross-model review | G5 passed |
| G7 | E2E VALIDATE | Real execution validation, no mocks allowed | G6 passed |

Every gate emits a marker file. **No marker = no progress.**

### Agent Isolation (CodeDelegator Pattern)

```
Agent A (Claude)           Agent B (Codex)          Agent C (Gemini)
├─ Writes tests from SPEC  ├─ Implements code        ├─ Mutation/PBT verification
├─ Cannot see impl code    ├─ Cannot see test intent ├─ Cannot see process
└─ SPEC only               └─ Tests + codebase only  └─ Both outputs only
```

Information barriers prevent Context Pollution — quality degrades when agents cross-contaminate context (Kemple 2025, CP > 0.25 threshold).

### Hash Chain Tamper Prevention

| Checkpoint | Verified | On Mismatch |
|-----------|----------|-------------|
| G3 entry | SPEC hash | Rollback to Phase 0 |
| G5 entry | Test file hash | Rollback to G4 |
| G6 entry | Implementation hash | Rollback to G5 |

### Multi-Provider Team Roles

| Role | Provider | Allocation |
|------|----------|-----------|
| Core logic / Architecture | Claude (Agent) | 50-60% |
| Implementation / Refactoring | Codex | 20-30% |
| Research / Tests / Docs | Gemini | 10-20% |

Codex **must** implement, not just review. Gemini **must** be consulted. Claude cannot monopolize.

### Consensus Protocol

Every team must reach consensus before implementation:

- **AGREE** — Accept the proposed approach
- **COUNTER** — Raise concerns with an alternative (mandatory for technical issues)
- **CLARIFY** — Request additional information

Max 5 rounds per team. Gemini mediates ties (2/3 majority). Lead makes final decision if consensus fails.

### Real-Time Dashboard

A Next.js dashboard with WebSocket event server provides live visualization of the orchestration pipeline:

- **Topology graph** — agent relationships and data flow (powered by @xyflow/react)
- **Pipeline panel** — gate progress and phase tracking
- **Agent detail panel** — individual agent status and output
- **Event log** — real-time event stream
- **Results summary** — final execution outcomes

```bash
# Start dashboard
cd dashboard && npm run dev          # Next.js on localhost:3000
cd dashboard/server && npm run dev   # WebSocket event server
```

---

## Architecture

### Project Structure

```
hive-plugin/
├── skills/                     # 6 skill modules (1,778 lines total)
│   ├── hive/                   # Entrypoint — phase router, hard gates, provider rules
│   ├── hive-workflow/          # Phase 0-5 engine — prompt eng, brainstorm, Serena, team, execute
│   ├── hive-consensus/         # Phase 4 consensus — bidirectional AGREE/COUNTER/CLARIFY
│   ├── hive-spawn-templates/   # Provider-specific prompt templates with variable placeholders
│   ├── hive-quality-gates/     # G1-G3 gate definitions, marker protocol, hash chain, debate rubric
│   └── hive-tdd-pipeline/      # G4-G7 TDD loop, agent isolation, mutation/PBT/E2E
├── dashboard/                  # Real-time visualization (Next.js + WebSocket)
│   ├── src/                    # React components, Zustand store, hooks
│   └── server/                 # WebSocket event server (chokidar + ws)
├── hooks/                      # Claude Code hook integration
│   ├── hooks.json              # SessionStart + PostToolUse hook definitions
│   └── scripts/                # setup-dashboard.sh, validate-skills.sh
├── scripts/                    # Validation & testing
│   ├── validate-plugin.sh      # 54-check structural validation
│   ├── validate-standards.sh   # 27-check standards compliance
│   ├── validate-gates.sh       # Marker chain + hash integrity verification
│   ├── validate-phase5-entry.sh# Team consensus marker verification
│   ├── validate-all.sh         # Unified runner (all validators)
│   ├── test_markers.py         # 20 marker format pattern tests
│   └── run-tests.sh            # Full test suite runner
├── systemd/                    # Auto-debug timer (periodic validation)
├── .claude-plugin/plugin.json  # Plugin manifest
├── marketplace.json            # Plugin marketplace registration
├── install-systemd.sh          # Systemd auto-debug installer
└── uninstall-systemd.sh        # Systemd auto-debug remover
```

### Skills

| Skill | Lines | Purpose |
|-------|-------|---------|
| `hive` | 238 | Entrypoint — phase router, hard gates, provider rules |
| `hive-workflow` | 500 | Phase 0-5 engine — prompt engineering, brainstorm, Serena, team, execute |
| `hive-consensus` | 456 | Phase 4 consensus protocol — bidirectional AGREE/COUNTER/CLARIFY |
| `hive-quality-gates` | 228 | G1-G3 gate definitions, marker protocol, hash chain, debate rubric |
| `hive-spawn-templates` | 181 | Provider-specific prompt templates with variable placeholders |
| `hive-tdd-pipeline` | 175 | G4-G7 TDD loop, agent isolation, mutation/PBT/E2E validation |

### Hooks

Hive registers Claude Code hooks via `hooks/hooks.json`:

| Event | Handler | Purpose |
|-------|---------|---------|
| `SessionStart` | `setup-dashboard.sh` | Auto-installs dashboard dependencies on first use |
| `PostToolUse` (Edit/Write) | `validate-skills.sh` | Validates skill files after any modification |

### Runtime State

```
.hive-state/          (gitignored)
├── g1-clarify.marker
├── g2-spec.marker
├── g3-plan-review.marker
├── g4-tdd-red.marker
├── g5-implement.marker
├── g6-cross-verify.marker
└── g7-e2e-validate.marker
```

Markers are stored as files to prevent conversation context bloat. Only `[G1 ✓] [G2 ✓] ...` summaries appear in the conversation.

---

## Requirements

- **Claude Code CLI** (latest)
- **Serena MCP server** — for codebase analysis in Phase 2
- **CCB bridge** — for Codex/Gemini integration (optional but recommended for full multi-provider orchestration)
- **Node.js** — for the real-time dashboard

## Installation

### Via Plugin Marketplace

```bash
# Add the marketplace
/plugin marketplace add inhyoe/hive-plugin

# Install the plugin
/plugin install hive@hive-marketplace
```

### Manual Installation

The install script creates symlinks, so `git pull` automatically updates all projects that use Hive.

```bash
# Install (creates symlinks — git pull updates all projects automatically)
bash install.sh

# Preview without changes
bash install.sh --dry-run

# Uninstall
bash install.sh --uninstall
```

### Auto-Debug Timer (Optional)

Sets up a systemd timer for periodic validation:

```bash
# Install
bash install-systemd.sh

# Configure
vim ~/.config/claude-auto-debug/config.env  # Set PROJECT_DIR

# Uninstall
bash uninstall-systemd.sh
```

## Usage

```bash
/hive "Add a chat feature to the app"
/hive "Refactor the authentication module"
/hive "Implement real-time notifications"
```

The quality pipeline activates automatically:

1. **G1 CLARIFY** — You answer scoping questions (multiple-choice, max 3 rounds)
2. **G2 SPEC** — A 6-section spec is generated for your approval
3. **Phase 0-3** — Prompt engineering, brainstorming, codebase analysis, team decomposition
4. **G3 PLAN REVIEW** — Designer and reviewer debate the plan (score >= 7.0 to pass)
5. **Phase 4** — Each team reaches consensus via AGREE/COUNTER/CLARIFY
6. **G4-G7** — TDD pipeline: tests first (RED), implementation (GREEN), cross-verification, E2E validation

## Validation

```bash
# Run all validators at once (146 total checks)
bash scripts/validate-all.sh

# Individual validators
bash scripts/validate-plugin.sh       # 54 structural checks
bash scripts/validate-standards.sh    # 27 standard checks
bash scripts/validate-gates.sh        # Marker chain + hash integrity
bash scripts/validate-phase5-entry.sh # Team consensus markers
python3 scripts/test_markers.py       # 20 marker format checks

# Full test suite
bash scripts/run-tests.sh
```

## Standards Compliance

- [Agent Skills Open Standard](https://agentskills.io) — Full compliance
- Claude Code Plugin Reference — Full compliance
- All 146 validation checks passing

## License

MIT
