import type { PollResult } from './types.js';
export declare function poll(paneId: string, marker: string, timeout?: number, interval?: number): Promise<PollResult>;
