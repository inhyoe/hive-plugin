import { existsSync, readFileSync, statSync } from 'node:fs';
import { parseTokenRemaining } from './parser.js';
import { capturePaneOutput } from './tmux.js';
import type { PollResult } from './types.js';
import { DEFAULT_POLL_INTERVAL, DEFAULT_POLL_TIMEOUT, responseFilePath } from './types.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function poll(
  paneId: string,
  marker: string,
  timeout = DEFAULT_POLL_TIMEOUT,
  interval = DEFAULT_POLL_INTERVAL,
  name = 'codex',
): Promise<PollResult> {
  const pollStartMs = Date.now();
  const deadline = pollStartMs + timeout * 1000;
  const respFile = responseFilePath(name);

  while (Date.now() < deadline) {
    if (existsSync(respFile)) {
      // Reject stale files: mtime must be after poll started
      const mtime = statSync(respFile).mtimeMs;
      if (mtime < pollStartMs) {
        // Stale file from previous round — wait for a fresh one
        if (Date.now() + interval > deadline) break;
        await sleep(interval);
        continue;
      }

      const response = readFileSync(respFile, 'utf-8').trim();
      if (response.length > 0) {
        const raw = capturePaneOutput(paneId, 100);
        const tokenRemaining = parseTokenRemaining(raw) ?? undefined;
        return { status: 'done', response, tokenRemaining };
      }
    }

    if (Date.now() + interval > deadline) break;
    await sleep(interval);
  }

  return { status: 'timeout' };
}
