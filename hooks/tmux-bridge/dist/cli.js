import { spawnProvider, killProvider } from './spawner.js';
import { sendInitial, sendFollowup } from './sender.js';
import { poll } from './poller.js';
import * as registry from './registry.js';
import { paneExists } from './tmux.js';
import { DEFAULT_POLL_TIMEOUT, DEFAULT_POLL_INTERVAL } from './types.js';
function parseArgs(args) {
    const result = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = args[i + 1];
            if (next && !next.startsWith('--')) {
                result[key] = next;
                i++;
            }
            else {
                result[key] = 'true';
            }
        }
    }
    return result;
}
function generateMarker() {
    return `[HIVE_DONE:${Date.now()}]`;
}
/** Ensure provider pane exists and is alive, spawn if needed */
function ensureProvider(provider, session) {
    const entry = registry.get(provider);
    if (entry) {
        if (paneExists(entry.paneId))
            return;
        // Stale entry — clean up and respawn
        registry.unregister(provider);
    }
    spawnProvider({
        provider: provider,
        name: provider,
        session,
    });
}
async function main() {
    const subcommand = process.argv[2];
    const args = parseArgs(process.argv.slice(3));
    switch (subcommand) {
        // ========================================
        // High-level commands (replace bash wrappers)
        // ========================================
        case 'ask': {
            // Usage: hive-tmux ask <provider> "<prompt>" [--wait] [--followup] [--marker M] [--purpose P] [--base B]
            const provider = process.argv[3];
            const prompt = process.argv[4];
            if (!provider || !prompt) {
                console.error('Usage: hive-tmux ask <codex|gemini> "<prompt>" [--wait] [--followup] [--marker M] [--purpose P]');
                process.exit(1);
            }
            const askArgs = parseArgs(process.argv.slice(5));
            const marker = askArgs['marker'] ?? generateMarker();
            const purpose = (askArgs['purpose'] ?? 'general');
            const meta = {};
            if (askArgs['base'])
                meta['base'] = askArgs['base'];
            ensureProvider(provider, askArgs['session']);
            const entry = registry.get(provider);
            if (askArgs['followup']) {
                sendFollowup(entry.paneId, prompt, marker, provider, purpose, meta);
            }
            else {
                sendInitial(entry.paneId, prompt, marker, entry.provider, provider, purpose, meta);
            }
            registry.register(provider, { ...entry, marker });
            if (askArgs['wait']) {
                const timeout = askArgs['timeout'] ? parseInt(askArgs['timeout']) : DEFAULT_POLL_TIMEOUT;
                const result = await poll(entry.paneId, '', timeout, DEFAULT_POLL_INTERVAL, provider);
                if (result.status === 'done') {
                    console.log(result.response ?? '');
                }
                else {
                    console.error(`[tmux-bridge] ${result.status}`);
                }
                // Auto-kill after --wait completes (unless --keep)
                if (!askArgs['keep']) {
                    killProvider(provider);
                }
                if (result.status !== 'done')
                    process.exit(1);
            }
            else {
                console.log(`[CCB_ASYNC_SUBMITTED:${marker}]`);
            }
            break;
        }
        case 'pend': {
            // Usage: hive-tmux pend <provider> [--timeout N] [--keep]
            const provider = process.argv[3];
            if (!provider) {
                console.error('Usage: hive-tmux pend <codex|gemini> [--timeout N] [--keep]');
                process.exit(1);
            }
            const pendArgs = parseArgs(process.argv.slice(4));
            const entry = registry.get(provider);
            if (!entry) {
                console.error(`[tmux-bridge] No pane for "${provider}"`);
                process.exit(1);
            }
            const timeout = pendArgs['timeout'] ? parseInt(pendArgs['timeout']) : DEFAULT_POLL_TIMEOUT;
            const result = await poll(entry.paneId, '', timeout, DEFAULT_POLL_INTERVAL, provider);
            if (result.status === 'done') {
                console.log(result.response ?? '');
                // Auto-kill pane after receiving response (unless --keep)
                if (!pendArgs['keep']) {
                    killProvider(provider);
                }
            }
            else {
                console.error(`[tmux-bridge] ${result.status}`);
                // Kill on timeout too — pane is likely stuck
                if (!pendArgs['keep']) {
                    killProvider(provider);
                }
                process.exit(1);
            }
            break;
        }
        // ========================================
        // Low-level commands (direct control)
        // ========================================
        case 'spawn': {
            if (!args['provider'] || !args['name']) {
                console.error('Usage: hive-tmux spawn --provider <codex|gemini> --name <name>');
                process.exit(1);
            }
            const entry = spawnProvider({
                provider: args['provider'],
                name: args['name'],
                session: args['session'],
                historyLimit: args['history-limit'] ? parseInt(args['history-limit']) : undefined,
            });
            console.log(JSON.stringify(entry));
            break;
        }
        case 'send': {
            if (!args['name'] || !args['prompt'] || !args['marker']) {
                console.error('Usage: hive-tmux send --name <name> --prompt <text> --marker <marker> [--followup]');
                process.exit(1);
            }
            const entry = registry.get(args['name']);
            if (!entry) {
                console.error(`No pane registered for "${args['name']}"`);
                process.exit(1);
            }
            if (args['followup']) {
                sendFollowup(entry.paneId, args['prompt'], args['marker'], args['name']);
            }
            else {
                sendInitial(entry.paneId, args['prompt'], args['marker'], entry.provider, args['name']);
            }
            registry.register(args['name'], { ...entry, marker: args['marker'] });
            console.log(JSON.stringify({ status: 'sent', name: args['name'], marker: args['marker'] }));
            break;
        }
        case 'poll': {
            if (!args['name'] || !args['marker']) {
                console.error('Usage: hive-tmux poll --name <name> --marker <marker> [--timeout <seconds>]');
                process.exit(1);
            }
            const entry = registry.get(args['name']);
            if (!entry) {
                console.error(`No pane registered for "${args['name']}"`);
                process.exit(1);
            }
            const pollTimeout = args['timeout'] ? parseInt(args['timeout']) : DEFAULT_POLL_TIMEOUT;
            const pollResult = await poll(entry.paneId, args['marker'], pollTimeout);
            console.log(JSON.stringify(pollResult));
            break;
        }
        case 'kill': {
            // Usage: hive-tmux kill <provider> OR hive-tmux kill --name <name>
            const target = process.argv[3];
            const name = target?.startsWith('--') ? args['name'] : target;
            if (!name) {
                console.error('Usage: hive-tmux kill <codex|gemini>');
                process.exit(1);
            }
            killProvider(name);
            console.log(JSON.stringify({ status: 'killed', name }));
            break;
        }
        case 'status': {
            const all = args['reconcile'] ? registry.reconcile() : registry.list();
            if (args['provider']) {
                const found = Object.values(all).some((entry) => entry.provider === args['provider']);
                if (!found)
                    process.exit(1);
                const entries = Object.fromEntries(Object.entries(all).filter(([, e]) => e.provider === args['provider']));
                console.log(JSON.stringify(entries, null, 2));
            }
            else {
                console.log(JSON.stringify(all, null, 2));
                if (Object.keys(all).length === 0)
                    process.exit(1);
            }
            break;
        }
        default:
            console.error('Usage: hive-tmux <ask|pend|kill|spawn|send|poll|status>');
            process.exit(1);
    }
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map