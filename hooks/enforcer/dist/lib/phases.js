export const PHASE_ORDER = [
    'G1', 'G2', 'P0', 'P1', 'P2', 'P3', 'G3', 'P4', 'P5',
];
export function phaseIndex(phase) {
    return PHASE_ORDER.indexOf(phase);
}
export function getNextPhase(current) {
    const idx = phaseIndex(current);
    if (idx === -1 || idx >= PHASE_ORDER.length - 1)
        return null;
    return PHASE_ORDER[idx + 1];
}
export function isValidTransition(from, to) {
    const fromIdx = phaseIndex(from);
    const toIdx = phaseIndex(to);
    if (fromIdx === -1 || toIdx === -1)
        return false;
    return toIdx === fromIdx + 1;
}
//# sourceMappingURL=phases.js.map