import { readSession } from '../lib/state.js';
import { Phase, phaseIndex } from '../lib/phases.js';
import {
  isDirectMarkerCreation,
  isCreateMarkerCall,
  extractCreateMarkerGate,
  isGitCommit,
  isHiveStateWrite,
  hasShellChaining,
} from '../lib/patterns.js';
import type { HandlerResult } from '../lib/types.js';

// Maps gate argument (lowercase) to the Phase it completes
const GATE_TO_PHASE: Record<string, Phase> = {
  g1: 'G1',
  g2: 'G2',
  p0: 'P0',
  p1: 'P1',
  p2: 'P2',
  p3: 'P3',
  g3: 'G3',
  p4: 'P4',
  p5: 'P5',
};

export function handlePhaseGuard(command: string, stateDir: string): HandlerResult {
  const result = readSession(stateDir);

  // No session file → IDLE → pass through
  if (result.status === 'not_found') return { exitCode: 0 };

  // Corrupted session → fail closed (security-critical)
  if (result.status === 'parse_error') {
    return {
      exitCode: 2,
      message: `BLOCKED: session.json corrupted (${result.error}). Delete .hive-state/session.json to proceed.`,
    };
  }

  const session = result.session;
  if (session.mode !== 'HIVE') {
    return { exitCode: 0 };
  }

  // Step 1: Block direct marker creation (forgery)
  if (isDirectMarkerCreation(command)) {
    return {
      exitCode: 2,
      message: 'BLOCKED: Direct marker creation detected (forgery attempt). Use scripts/create-marker.sh instead.',
    };
  }

  // Step 2: Validate create-marker.sh gate order
  if (isCreateMarkerCall(command)) {
    // C2: Block chained commands (e.g., create-marker.sh g1 && git commit)
    if (hasShellChaining(command)) {
      return {
        exitCode: 2,
        message: 'BLOCKED: create-marker.sh must be a standalone command. Shell chaining (&&, ||, ;, |) is not allowed.',
      };
    }

    const gate = extractCreateMarkerGate(command);
    if (gate) {
      const gatePhase = GATE_TO_PHASE[gate.toLowerCase()];
      if (!gatePhase) {
        return { exitCode: 2, message: `BLOCKED: Unknown gate "${gate}".` };
      }

      const currentIdx = phaseIndex(session.phase);
      const gateIdx = phaseIndex(gatePhase);

      // Gate must match current phase (completing current phase to advance)
      if (gateIdx !== currentIdx) {
        return {
          exitCode: 2,
          message: `BLOCKED: Phase order violation. Current phase: ${session.phase}, attempted gate: ${gate.toUpperCase()}. Cannot skip or go backward.`,
        };
      }
    }
    return { exitCode: 0 };
  }

  // Step 3: Block direct writes to .hive-state/ (FSM tampering)
  if (isHiveStateWrite(command, stateDir)) {
    return {
      exitCode: 2,
      message: 'BLOCKED: Direct write to .hive-state/ detected. Use scripts/create-marker.sh for state transitions.',
    };
  }

  // Step 4: Block git commit before P5
  if (isGitCommit(command)) {
    if (session.phase !== 'P5') {
      return {
        exitCode: 2,
        message: `BLOCKED: git commit not allowed until P5. Current phase: ${session.phase}.`,
      };
    }
  }

  return { exitCode: 0 };
}
