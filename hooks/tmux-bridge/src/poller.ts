import { existsSync, readFileSync } from 'node:fs';
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
  const deadline = Date.now() + timeout * 1000;
  const respFile = responseFilePath(name);

  while (Date.now() < deadline) {
    if (existsSync(respFile)) {
      const response = readFileSync(respFile, 'utf-8').trim();
      if (response.length > 0) {
        // If a marker was provided, verify the response file was written after
        // the ask that generated it (sender deletes the file before each ask,
        // so a non-empty file means it's from the current round). The marker
        // timestamp embedded in [HIVE_DONE:<ts>] can optionally be checked
        // against the file mtime for extra safety.
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
