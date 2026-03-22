import { capturePaneOutput } from './tmux.js';
import { extractResponse } from './parser.js';
import { DEFAULT_POLL_INTERVAL, DEFAULT_POLL_TIMEOUT } from './types.js';
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function poll(paneId, marker, timeout = DEFAULT_POLL_TIMEOUT, interval = DEFAULT_POLL_INTERVAL) {
    const deadline = Date.now() + timeout * 1000;
    while (Date.now() < deadline) {
        const raw = capturePaneOutput(paneId, 5000);
        const result = extractResponse(raw, marker);
        if (result) {
            return {
                status: 'done',
                response: result.response,
                tokenRemaining: result.tokenRemaining ?? undefined,
            };
        }
        if (Date.now() + interval > deadline)
            break;
        await sleep(interval);
    }
    return { status: 'timeout' };
}
//# sourceMappingURL=poller.js.map