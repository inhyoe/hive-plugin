import { capturePaneOutput } from './tmux.js';
import { extractResponse } from './parser.js';
import type { PollResult } from './types.js';
import { DEFAULT_POLL_INTERVAL, DEFAULT_POLL_TIMEOUT } from './types.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function poll(
  paneId: string,
  marker: string,
  timeout = DEFAULT_POLL_TIMEOUT,
  interval = DEFAULT_POLL_INTERVAL,
): Promise<PollResult> {
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

    if (Date.now() + interval > deadline) break;
    await sleep(interval);
  }

  return { status: 'timeout' };
}
