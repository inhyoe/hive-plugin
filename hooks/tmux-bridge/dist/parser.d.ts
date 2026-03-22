import type { MarkerSearchResult } from './types.js';
export declare function isNoiseLine(line: string): boolean;
export declare function parseTokenRemaining(raw: string): string | null;
export declare function findMarker(raw: string, marker: string): MarkerSearchResult;
