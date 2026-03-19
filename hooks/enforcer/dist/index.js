import { handleIntentGate } from './handlers/intent-gate.js';
import { handlePhaseGuard } from './handlers/phase-guard.js';
import { handleAgentDispatcher } from './handlers/agent-dispatcher.js';
import { handleAgentTracker } from './handlers/agent-tracker.js';
import { extractCommandFromStdin, extractPromptFromStdin, extractAgentInfoFromStdin, } from './lib/patterns.js';
const STATE_DIR = process.env.HIVE_STATE_DIR ?? '.hive-state';
function readStdin() {
    return new Promise((resolve) => {
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
            if (command) {
                const result = handlePhaseGuard(command, STATE_DIR);
                if (result.message)
                    console.error(result.message);
                exitCode = result.exitCode;
            }
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
        default:
            console.error(`Unknown handler: ${handlerName}`);
            break;
    }
    process.exit(exitCode);
}
main().catch((err) => {
    console.error('Fatal error (non-blocking):', err);
    process.exit(0); // Never block Claude on fatal errors
});
//# sourceMappingURL=index.js.map