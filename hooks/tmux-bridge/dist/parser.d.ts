import type { MarkerSearchResult } from './types.js';
export declare function isNoiseLine(line: string): boolean;
/**
 * Detect if codex TUI is idle (finished responding, waiting for next input).
 * Idle state = last non-empty lines contain an idle prompt (› Implement...)
 * followed by a status bar (gpt-X.Y ... N% left).
 */
export declare function isIdle(raw: string): boolean;
/**
 * Extract the response from the LAST completed exchange in the pane.
 * Works by finding the last idle prompt (› Implement...) and extracting
 * everything between the user's prompt and that idle prompt.
 */
export declare function extractLatestResponse(raw: string): string | null;
export declare function parseTokenRemaining(raw: string): string | null;
export declare function findMarker(raw: string, marker: string): MarkerSearchResult;
export declare function extractCurrentRound(raw: string, markerLineNumber: number): string;
export declare function extractResponse(raw: string, _marker: string): {
    response: string;
    tokenRemaining: string | null;
} | null;
