import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readSession } from '../lib/state.js';
import { TASK_PROPOSAL_RE, AGREE_RE, COUNTER_RE, CLARIFY_RE, validateTaskProposalSections, } from '../lib/marker-formats.js';
export function extractMarkerInputFromStdin(stdin) {
    try {
        const parsed = JSON.parse(stdin);
        const output = parsed?.tool_result?.stdout
            ?? parsed?.tool_result?.output
            ?? parsed?.response
            ?? '';
        const toolName = parsed?.tool_name ?? '';
        if (typeof output !== 'string')
            return null;
        return { output, toolName };
    }
    catch {
        return null;
    }
}
export function handleMarkerValidator(input, stateDir) {
    const { output } = input;
    // Only validate when in HIVE mode
    const sessionResult = readSession(stateDir);
    if (sessionResult.status !== 'ok' || sessionResult.session.mode !== 'HIVE') {
        return { exitCode: 0 };
    }
    const session = sessionResult.session;
    // Check 1: Validate TASK PROPOSAL structure
    const proposalMatch = output.match(TASK_PROPOSAL_RE);
    if (proposalMatch) {
        // Extract the body after the marker line
        const markerIdx = output.indexOf(proposalMatch[0]);
        const body = output.slice(markerIdx + proposalMatch[0].length);
        const missing = validateTaskProposalSections(body);
        if (missing.length > 0) {
            return {
                exitCode: 0, // Advisory, not blocking
                message: `WARNING: TASK PROPOSAL for ${proposalMatch[1]} is missing required sections: ${missing.join(', ')}. Expected 7 sections: 목표, 담당 모듈, 제안 접근방식, 컨텍스트, 제약사항, 예상 산출물, 질문.`,
            };
        }
    }
    // Check 2: Validate consensus marker format (team ID required)
    for (const re of [AGREE_RE, COUNTER_RE, CLARIFY_RE]) {
        const match = output.match(re);
        if (match) {
            const teamId = match[1];
            if (!teamId || teamId === '{팀' || teamId.startsWith('{')) {
                return {
                    exitCode: 0,
                    message: `WARNING: Consensus marker has unresolved template variable for team ID: "${teamId}". Replace with actual team ID (e.g., T1, T2).`,
                };
            }
        }
    }
    // Check 3: Phase 5 entry — verify all teams have consensus markers
    if (session.phase === 'P4') {
        const consensusDir = join(stateDir, 'consensus');
        const teamsFile = join(stateDir, 'teams.json');
        if (existsSync(teamsFile) && existsSync(consensusDir)) {
            try {
                const teamsRaw = readFileSync(teamsFile, 'utf-8');
                const { teams } = JSON.parse(teamsRaw);
                const markers = readdirSync(consensusDir)
                    .filter((f) => f.endsWith('.marker'))
                    .map((f) => f.replace('.marker', ''));
                const missing = teams.filter((t) => !markers.includes(t));
                if (missing.length > 0) {
                    return {
                        exitCode: 0,
                        message: `INFO: ${missing.length} team(s) still need consensus before Phase 5: ${missing.join(', ')}.`,
                    };
                }
            }
            catch {
                // teams.json parse error — don't block
            }
        }
    }
    return { exitCode: 0 };
}
//# sourceMappingURL=marker-validator.js.map