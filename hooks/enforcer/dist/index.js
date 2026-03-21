import { handleIntentGate } from './handlers/intent-gate.js';
import { handlePhaseGuard } from './handlers/phase-guard.js';
import { handleAgentDispatcher } from './handlers/agent-dispatcher.js';
import { handleAgentTracker } from './handlers/agent-tracker.js';
import { handleMarkerValidator, extractMarkerInputFromStdin } from './handlers/marker-validator.js';
import { handleConsensusValidator, extractConsensusInputFromStdin } from './handlers/consensus-validator.js';
import { handleReadGatePre, handleReadGatePost } from './handlers/read-gate.js';
import { recordPendingReadsAfterMarker } from './handlers/phase-guard.js';
import { extractCommandFromStdin, extractPromptFromStdin, extractAgentInfoFromStdin, isCreateMarkerExecution, isBashSuccess, } from './lib/patterns.js';
const STATE_DIR = process.env.HIVE_STATE_DIR ?? '.hive-state';
function readStdin() {
    return new Promise((resolve) => {
        if (process.stdin.isTTY) {
            resolve('');
            return;
        }
        let data = '';
        process.stdin.setEncoding('utf-8');
        process.stdin.on('data', (chunk) => { data += chunk; });
        process.stdin.on('end', () => resolve(data));
        // If stdin is already ended or not piped
        if (process.stdin.readableEnded)
            resolve(data);
    });
}
async function main() {
    const handlerName = process.argv[2];
    if (!handlerName) {
        console.error('Usage: node index.js <handler-name>');
        process.exit(0); // Don't block Claude
        return;
    }
    const stdin = await readStdin();
    let exitCode = 0;
    switch (handlerName) {
        case 'intent-gate': {
            const prompt = extractPromptFromStdin(stdin);
            if (prompt) {
                const result = handleIntentGate(prompt, STATE_DIR);
                if (result.message)
                    console.error(result.message);
                exitCode = result.exitCode;
            }
            break;
        }
        case 'phase-guard': {
            const command = extractCommandFromStdin(stdin);
            if (!command) {
                console.error('BLOCKED: failed to extract Bash command from hook payload.');
                exitCode = 2;
                break;
            }
            const result = handlePhaseGuard(command, STATE_DIR);
            if (result.message)
                console.error(result.message);
            exitCode = result.exitCode;
            break;
        }
        case 'agent-dispatcher': {
            const info = extractAgentInfoFromStdin(stdin);
            if (info) {
                const result = handleAgentDispatcher(info, STATE_DIR);
                if (result.message)
                    console.error(result.message);
                exitCode = result.exitCode;
            }
            break;
        }
        case 'agent-tracker': {
            const info = extractAgentInfoFromStdin(stdin);
            if (info) {
                const result = handleAgentTracker(info, STATE_DIR);
                if (result.message)
                    console.error(result.message);
                exitCode = result.exitCode;
            }
            break;
        }
        case 'marker-validator': {
            const input = extractMarkerInputFromStdin(stdin);
            if (input) {
                const result = handleMarkerValidator(input, STATE_DIR);
                if (result.message)
                    console.error(result.message);
                exitCode = result.exitCode;
            }
            break;
        }
        case 'consensus-validator': {
            const input = extractConsensusInputFromStdin(stdin);
            if (input) {
                const result = handleConsensusValidator(input, STATE_DIR);
                if (result.message)
                    console.error(result.message);
                exitCode = result.exitCode;
            }
            break;
        }
        case 'read-gate-pre': {
            const result = handleReadGatePre(STATE_DIR);
            if (result.message)
                console.error(result.message);
            exitCode = result.exitCode;
            break;
        }
        case 'read-gate-post': {
            const repoRoot = process.env.CLAUDE_PLUGIN_ROOT ?? process.cwd();
            const result = handleReadGatePost(stdin, STATE_DIR, repoRoot);
            if (result.message)
                console.error(result.message);
            exitCode = result.exitCode;
            break;
        }
        case 'phase-advance': {
            // Called from PostToolUse(Bash) — only act after successful create-marker.sh
            const cmd = extractCommandFromStdin(stdin);
            if (cmd && isCreateMarkerExecution(cmd) && isBashSuccess(stdin)) {
                recordPendingReadsAfterMarker(STATE_DIR);
            }
            break;
        }
        default:
            console.error(`Unknown handler: ${handlerName}`);
            break;
    }
    process.exit(exitCode);
}
main().catch((err) => {
    const handler = process.argv[2];
    console.error(`Fatal error in ${handler}:`, err);
    // Security-critical handlers fail closed; advisory handlers fail open
    if (handler === 'phase-guard' || handler === 'read-gate-pre' || handler === 'read-gate-post') {
        process.exit(2);
    }
    process.exit(0);
});
//# sourceMappingURL=index.js.map