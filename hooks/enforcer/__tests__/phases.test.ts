import { describe, it, expect } from 'vitest';
import {
  Phase,
  PHASE_ORDER,
  getNextPhase,
  isValidTransition,
  phaseIndex,
} from '../src/lib/phases.js';

describe('Phase definitions', () => {
  it('PHASE_ORDER has 9 phases in correct order', () => {
    expect(PHASE_ORDER).toEqual(['G1', 'G2', 'P0', 'P1', 'P2', 'P3', 'G3', 'P4', 'P5']);
    expect(PHASE_ORDER).toHaveLength(9);
  });

  it('phaseIndex returns correct index for each phase', () => {
    expect(phaseIndex('G1')).toBe(0);
    expect(phaseIndex('G2')).toBe(1);
    expect(phaseIndex('P0')).toBe(2);
    expect(phaseIndex('P1')).toBe(3);
    expect(phaseIndex('P2')).toBe(4);
    expect(phaseIndex('P3')).toBe(5);
    expect(phaseIndex('G3')).toBe(6);
    expect(phaseIndex('P4')).toBe(7);
    expect(phaseIndex('P5')).toBe(8);
  });

  it('phaseIndex returns -1 for unknown phase', () => {
    expect(phaseIndex('UNKNOWN' as Phase)).toBe(-1);
  });

  it('getNextPhase returns next phase in order', () => {
    expect(getNextPhase('G1')).toBe('G2');
    expect(getNextPhase('G2')).toBe('P0');
    expect(getNextPhase('P4')).toBe('P5');
  });

  it('getNextPhase returns null for last phase', () => {
    expect(getNextPhase('P5')).toBeNull();
  });

  it('isValidTransition allows +1 forward only', () => {
    expect(isValidTransition('G1', 'G2')).toBe(true);
    expect(isValidTransition('G2', 'P0')).toBe(true);
    expect(isValidTransition('P4', 'P5')).toBe(true);
  });

  it('isValidTransition rejects skip-ahead', () => {
    expect(isValidTransition('G1', 'P0')).toBe(false);
    expect(isValidTransition('G1', 'P5')).toBe(false);
  });

  it('isValidTransition rejects backward', () => {
    expect(isValidTransition('G2', 'G1')).toBe(false);
    expect(isValidTransition('P5', 'P4')).toBe(false);
  });

  it('isValidTransition rejects same phase', () => {
    expect(isValidTransition('G1', 'G1')).toBe(false);
  });
});
