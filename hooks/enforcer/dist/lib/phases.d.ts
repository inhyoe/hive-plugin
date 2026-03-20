export type Phase = 'G1' | 'G2' | 'P0' | 'P1' | 'P2' | 'P3' | 'G3' | 'P4' | 'P5';
export declare const PHASE_ORDER: readonly Phase[];
export declare function phaseIndex(phase: Phase): number;
export declare function getNextPhase(current: Phase): Phase | null;
export declare function isValidTransition(from: Phase, to: Phase): boolean;
