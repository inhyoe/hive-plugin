import { existsSync, readFileSync } from 'node:fs';
import { parseTokenRemaining } from './parser.js';
import { capturePaneOutput } from './tmux.js';
import { DEFAULT_POLL_INTERVAL, DEFAULT_POLL_TIMEOUT, responseFilePath } from './types.js';
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function poll(paneId, _marker, timeout = DEFAULT_POLL_TIMEOUT, interval = DEFAULT_POLL_INTERVAL, name = 'codex') {
    const deadline = Date.now() + timeout * 1000;
    const respFile = responseFilePath(name);
    while (Date.now() < deadline) {
        // Check if response file exists (codex wrote it when done)
        if (existsSync(respFile)) {
            const response = readFileSync(respFile, 'utf-8').trim();
            if (response.length > 0) {
                const raw = capturePaneOutput(paneId, 100);
                const tokenRemaining = parseTokenRemaining(raw) ?? undefined;
                return { status: 'done', response, tokenRemaining };
            }
        }
        if (Date.now() + interval > deadline)
            break;
        await sleep(interval);
    }
    return { status: 'timeout' };
}
//# sourceMappingURL=poller.js.map