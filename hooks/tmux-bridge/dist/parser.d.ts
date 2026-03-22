import type { MarkerSearchResult } from './types.js';
export declare function isNoiseLine(line: string): boolean;
export declare function findMarker(raw: string, marker: string): MarkerSearchResult;
export declare function extractCurrentRound(raw: string, markerLineNumber: number): string;
export declare function parseTokenRemaining(raw: string): string | null;
export declare function extractResponse(raw: string, marker: string): {
    response: string;
    tokenRemaining: string | null;
} | null;
