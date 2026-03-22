import type { Purpose } from './types.js';
export declare function sendInitial(paneId: string, prompt: string, marker: string, provider: string, name: string, purpose?: Purpose, meta?: Record<string, string>): void;
export declare function sendFollowup(paneId: string, prompt: string, marker: string, name: string, purpose?: Purpose, meta?: Record<string, string>): void;
