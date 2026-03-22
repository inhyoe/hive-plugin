import type { PollResult } from './types.js';
export declare function poll(paneId: string, _marker: string, timeout?: number, interval?: number, name?: string): Promise<PollResult>;
