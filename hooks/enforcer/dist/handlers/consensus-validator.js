import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readSession } from '../lib/state.js';
import { TASK_PROPOSAL_RE, FOLLOW_UP_RE, G2_SPEC_RE, } from '../lib/marker-formats.js';
export function extractConsensusInputFromStdin(stdin) {
    try {
        const parsed = JSON.parse(stdin);
        const output = parsed?.tool_result?.stdout
            ?? parsed?.tool_result?.output
            ?? parsed?.response
            ?? '';
        if (typeof output !== 'string')
            return null;
        return { output };
    }
    catch {
        return null;
    }
}
function loadRoundTracker(stateDir) {
    const filePath = join(stateDir, 'consensus-rounds.json');
    if (!existsSync(filePath))
        return {};
    try {
        return JSON.parse(readFileSync(filePath, 'utf-8'));
    }
    catch {
        return {};
    }
}
function saveRoundTracker(stateDir, tracker) {
    if (!existsSync(stateDir))
        mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, 'consensus-rounds.json'), JSON.stringify(tracker, null, 2), 'utf-8');
}
export function handleConsensusValidator(input, stateDir) {
    const { output } = input;
    // Only validate when in HIVE mode
    const sessionResult = readSession(stateDir);
    if (sessionResult.status !== 'ok' || sessionResult.session.mode !== 'HIVE') {
        return { exitCode: 0 };
    }
    // Check 1: Round number sequencing
    const proposalMatch = output.match(TASK_PROPOSAL_RE);
    const followUpMatch = output.match(FOLLOW_UP_RE);
    const match = proposalMatch ?? followUpMatch;
    if (match) {
        const teamId = match[1];
        const round = parseInt(match[2], 10);
        if (isNaN(round) || round < 1) {
            return {
                exitCode: 0,
                message: `WARNING: Invalid round number ${match[2]} for team ${teamId}. Rounds must be 1-5.`,
            };
        }
        if (round > 5) {
            return {
                exitCode: 0,
                message: `WARNING: Round ${round} exceeds maximum (5) for team ${teamId}. Escalate via AskUserQuestion or issue LEAD DECISION.`,
            };
        }
        // Track and validate sequence
        const tracker = loadRoundTracker(stateDir);
        const teamRounds = tracker[teamId] ?? [];
        if (teamRounds.length > 0) {
            const lastRound = teamRounds[teamRounds.length - 1];
            // Gap detection: R1 → R3 (skipped R2)
            if (round > lastRound + 1) {
                return {
                    exitCode: 0,
                    message: `WARNING: Round gap detected for ${teamId}. Expected R${lastRound + 1} but got R${round}.`,
                };
            }
            // Duplicate detection: same round again
            if (round <= lastRound && !followUpMatch) {
                return {
                    exitCode: 0,
                    message: `WARNING: Duplicate round R${round} for ${teamId}. Last round was R${lastRound}.`,
                };
            }
        }
        // Record round (only for new rounds, not follow-ups to same round)
        if (!teamRounds.includes(round)) {
            teamRounds.push(round);
            tracker[teamId] = teamRounds;
            saveRoundTracker(stateDir, tracker);
        }
    }
    // Check 2: SPEC hash chain verification (G3 entry)
    // When output contains G3 plan debate marker, verify SPEC hash matches G2
    if (/\[PLAN DEBATE/.test(output)) {
        const g2MarkerPath = join(stateDir, 'g2-spec.marker');
        const specContentPath = join(stateDir, 'spec-content.txt');
        if (existsSync(g2MarkerPath) && existsSync(specContentPath)) {
            try {
                const g2Marker = readFileSync(g2MarkerPath, 'utf-8');
                const hashMatch = g2Marker.match(G2_SPEC_RE);
                if (hashMatch) {
                    const g2Hash = hashMatch[1];
                    // Verify spec-content.txt hasn't been tampered with
                    // The actual sha256 comparison should be done by the AI via Bash
                    // Here we just check that the hash is present and valid format
                    if (!/^[a-f0-9]{64}$/.test(g2Hash)) {
                        return {
                            exitCode: 0,
                            message: `WARNING: G2 SPEC hash has invalid format: "${g2Hash}". Expected 64-char hex SHA-256.`,
                        };
                    }
                }
            }
            catch {
                // File read error — don't block
            }
        }
    }
    return { exitCode: 0 };
}
//# sourceMappingURL=consensus-validator.js.map