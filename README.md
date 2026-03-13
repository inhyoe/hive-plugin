# Hive — Multi-Provider Orchestration Team Builder

**[English]** | [한국어](README.ko.md) | [日本語](README.ja.md)

> **v2.0.0** — 7-Stage Quality Pipeline with Hard Gate Enforcement

Build and orchestrate multi-provider AI teams (Claude/Codex/Gemini) through a research-backed quality pipeline that **enforces identical quality gates for every user**.

```
[G1 CLARIFY] → [G2 SPEC] → Prompt Eng → Brainstorm → Serena → Team
→ [G3 PLAN REVIEW] → Consensus → [G4 TDD RED] → [G5 IMPLEMENT GREEN]
→ [G6 CROSS-VERIFY] → [G7 E2E VALIDATE] → Done
```

---

## Why v2.0.0?

Traditional AI coding workflows suffer from three problems:

1. **Ambiguous requests** produce ambiguous code
2. **Tests pass but code doesn't work** — agents write tests that validate their own assumptions
3. **No accountability** — single-agent self-review catches nothing

Hive v2.0.0 solves this with:

- **Mandatory clarification** (G1+G2) before any work begins
- **Agent isolation** — test writer cannot see implementation, implementer cannot see test intent (CodeDelegator pattern)
- **Multi-agent cross-verification** — mutation testing + property-based testing + cross-model review
- **Hard gates** — each stage is blocked until the previous marker exists; no shortcuts

Research foundation: AgentSpec (ICSE 2026), TGen TDD (2024), Meta ACH (FSE 2025), CodeDelegator (2025), Du et al. Multi-Agent Debate (2023), PGS PBT (FSE 2025).

---

## Features

### Quality Pipeline (7 Hard Gates)

| Gate | Name | What It Does | Enforcement |
|------|------|-------------|-------------|
| G1 | **CLARIFY** | Forces scope/criteria/constraints clarification via multiple-choice questions (max 3 rounds) | Must pass before G2 |
| G2 | **SPEC** | Requires 6-section natural language spec with invariants (2+) and edge cases (3+), SHA256-hashed | Must pass before Phase 0 |
| G3 | **PLAN REVIEW** | Designer↔Reviewer mutual debate (not one-way review), 5-dimension rubric, score >= 7.0 required | Must pass before Phase 4/5 |
| G4 | **TDD RED** | SPEC-only test writing (3 layers: example-based, property-based, smoke), all tests must FAIL | Must pass before G5 |
| G5 | **IMPLEMENT GREEN** | Isolated implementer makes all tests pass (max 5 iterations), test tampering detection | Must pass before G6 |
| G6 | **CROSS-VERIFY** | Mutation testing (>= 60%), PBT (100+ runs), cross-model review by uninvolved agent | Must pass before G7 |
| G7 | **E2E VALIDATE** | Real execution validation (script/integration/hive-specific), no mocks allowed | Must pass before completion |

Every gate emits a marker (e.g., `[CLARIFY PASSED — scope:{...}]`). The next gate checks for the previous marker's existence. **No marker = no progress.**

### Agent Isolation (CodeDelegator Pattern)

```
Agent A (Claude)         Agent B (Codex)         Agent C (Gemini)
- Writes tests from SPEC - Minimal implementation  - Verification (mutation/PBT)
- SPEC only              - Tests + codebase only   - Both outputs only
  Cannot see impl code     Cannot see test intent    Cannot see process
```

Information barriers prevent Context Pollution (Kemple 2025, quality degrades when CP > 0.25).

### Hash Chain Tamper Prevention

| Checkpoint | Verified | On Mismatch |
|-----------|----------|-------------|
| G3 entry | SPEC hash | Rollback to Phase 0 |
| G5 entry | Test file hash | Rollback to G4 |
| G6 entry | Implementation hash | Rollback to G5 |

All hashes computed via `Bash("sha256sum ...")` — LLMs cannot compute SHA256 directly.

### Multi-Provider Orchestration

| Role | Provider | Allocation |
|------|----------|-----------|
| Core logic / Architecture | Claude (Agent) | 50-60% |
| Implementation / Refactoring | Codex (cask) | 20-30% |
| Research / Tests / Docs | Gemini (gask) | 10-20% |

Codex **must** implement (not just review). Gemini **must** be consulted. Claude cannot monopolize.

### AGENT_CAPABILITY_DIRECTIVE

Every spawned agent (reviewers, workers, verifiers, mediators) receives a mandatory directive:

```xml
<AGENT_CAPABILITY_DIRECTIVE>
You MUST utilize ALL available resources before and during your task:
- Invoke all relevant skills (code analysis, review, testing, patterns)
- Use all connected MCP tools (file ops, AST analysis, code search, web fetch)
- If uncertain about API/library usage, use web search to verify
- Do NOT guess APIs or syntax — look them up first
Do NOT respond or write code based on inference alone when tools are available.
</AGENT_CAPABILITY_DIRECTIVE>
```

---

## Architecture

### Skills (6 total)

| Skill | Lines | Purpose |
|-------|-------|---------|
| `hive` | 161 | Entrypoint — Phase Router, hard gates, provider rules |
| `hive-workflow` | 499 | Phase 0-5 engine — prompt engineering, brainstorm, Serena, team, execute |
| `hive-consensus` | 482 | Phase 4 consensus protocol — bidirectional AGREE/COUNTER/CLARIFY |
| `hive-spawn-templates` | 174 | Provider-specific prompt templates with variable placeholders |
| `hive-quality-gates` | 210 | G1-G3 gate definitions, marker protocol, hash chain, debate rubric |
| `hive-tdd-pipeline` | 173 | G4-G7 TDD loop, agent isolation, mutation/PBT/E2E validation |

### Scripts

| Script | Purpose |
|--------|---------|
| `validate-plugin.sh` | 54-check structural validation |
| `validate-standards.sh` | 27-check standards compliance |
| `validate-gates.sh` | Marker chain + hash integrity verification |
| `test_markers.py` | 20 marker format pattern validation |
| `run-tests.sh` | Unified test suite runner (4 test categories) |

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

Markers are stored as files to prevent conversation context bloat. Only `[G1 ✓] [G2 ✓] ...` summaries appear in conversation.

---

## Requirements

- Claude Code CLI
- Serena MCP server (for codebase analysis)
- CCB bridge (for Codex/Gemini integration, optional but recommended)

## Installation

### As a Plugin

```bash
# Add marketplace
/plugin marketplace add YOUR_GITHUB_USERNAME/hive-plugin

# Install
/plugin install hive@YOUR_MARKETPLACE_NAME
```

### Manual Installation

```bash
cp -r skills/hive ~/.claude/skills/
cp -r skills/hive-consensus ~/.claude/skills/
cp -r skills/hive-workflow ~/.claude/skills/
cp -r skills/hive-spawn-templates ~/.claude/skills/
cp -r skills/hive-quality-gates ~/.claude/skills/
cp -r skills/hive-tdd-pipeline ~/.claude/skills/
```

## Usage

```
/hive "Add chat feature to the app"
/hive "Refactor authentication module"
/hive "Implement real-time notifications"
```

The quality pipeline activates automatically. You will be asked clarification questions (G1), see a SPEC for approval (G2), witness a plan debate (G3), and tests will be written before implementation (G4-G7).

## Pipeline Flow

```
/hive "user request"
  │
  ├─ G1: CLARIFY (scope/criteria/constraints)
  ├─ G2: SPEC (6-section spec + SHA256 hash)
  │
  ├─ Phase 0: Prompt Engineering & Resource Discovery
  ├─ Phase 1: Brainstorm (requirement clarification)
  ├─ Phase 2: Serena Context (codebase analysis)
  ├─ Phase 3: Team Decomposition (module-based splitting)
  │
  ├─ G3: PLAN REVIEW (Designer↔Reviewer mutual debate, score >= 7.0)
  ├─ Phase 4: Consensus Loop (bidirectional agreement per team)
  │
  ├─ G4: TDD RED (tests from SPEC, all must FAIL)
  ├─ G5: IMPLEMENT GREEN (isolated implementer, all tests PASS)
  ├─ G6: CROSS-VERIFY (mutation >= 60%, PBT, cross-model review)
  ├─ G7: E2E VALIDATE (real execution, no mocks)
  │
  └─ Done (all 7 gates passed)
```

## Consensus Protocol

Every agent must reach CONSENSUS on their assigned module before implementation begins:

- **AGREE**: Accept the proposed approach
- **COUNTER**: Raise concerns with alternative suggestion (mandatory for technical issues)
- **CLARIFY**: Request additional information

Max 5 rounds per agent. Gemini mediates ties (2/3 majority). Lead makes final decision if consensus fails after 3 rounds.

## Validation

```bash
# Run all tests (structure + markers + CCB + gates)
bash scripts/run-tests.sh

# Individual validators
bash scripts/validate-plugin.sh      # 54 structural checks
bash scripts/validate-standards.sh   # 27 standard checks
bash scripts/validate-gates.sh       # Marker chain + hash integrity
python3 scripts/test_markers.py      # 20 marker format checks
```

## License

MIT
