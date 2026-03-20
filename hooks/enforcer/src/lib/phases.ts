export type Phase = 'G1' | 'G2' | 'P0' | 'P1' | 'P2' | 'P3' | 'G3' | 'P4' | 'P5';

export const PHASE_ORDER: readonly Phase[] = [
  'G1', 'G2', 'P0', 'P1', 'P2', 'P3', 'G3', 'P4', 'P5',
] as const;

export function phaseIndex(phase: Phase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function getNextPhase(current: Phase): Phase | null {
  const idx = phaseIndex(current);
  if (idx === -1 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
}

export function isValidTransition(from: Phase, to: Phase): boolean {
  const fromIdx = phaseIndex(from);
  const toIdx = phaseIndex(to);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx === fromIdx + 1;
}
