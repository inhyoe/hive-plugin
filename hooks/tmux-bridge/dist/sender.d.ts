import type { Purpose } from './types.js';
export declare function sendInitial(paneId: string, prompt: string, _marker: string, provider: string, name: string, purpose?: Purpose, meta?: Record<string, string>): void;
export declare function sendFollowup(paneId: string, prompt: string, _marker: string, name: string, purpose?: Purpose, meta?: Record<string, string>): void;
