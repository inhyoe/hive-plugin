'use client';

import { useHiveStore } from '@/store/hive-store';
import type { GateId, GateStatus } from '@/types/events';

const GATE_LABELS: Record<GateId, string> = {
  G1: 'CLARIFY', G2: 'SPEC', G3: 'PLAN REVIEW', G4: 'TDD RED',
  G5: 'IMPLEMENT', G6: 'CROSS-VERIFY', G7: 'E2E VALIDATE',
};

const STATUS_ICON: Record<GateStatus, string> = {
  passed: '\u2705', active: '\uD83D\uDD04', failed: '\u274C', pending: '\u2B1C',
};

const STATUS_STYLE: Record<GateStatus, string> = {
  passed: 'text-emerald-400 border-emerald-500/30',
  active: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/5',
  failed: 'text-red-400 border-red-500/30',
  pending: 'text-gray-500 border-gray-700',
};

const GATES: GateId[] = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'];

export function PipelinePanel() {
  const { gates, currentPhase } = useHiveStore();

  return (
    <div className="flex flex-col gap-2 p-4 bg-gray-900 rounded-xl border border-gray-800 h-full">
      <h2 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-2">Pipeline</h2>
      <div className="flex flex-col gap-1.5">
        {GATES.map((gate) => {
          const status = gates[gate];
          return (
            <div key={gate} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${STATUS_STYLE[status]} transition-all`}>
              <span className="text-sm">{STATUS_ICON[status]}</span>
              <span className="text-xs font-mono font-medium">{gate}</span>
              <span className="text-xs opacity-70 truncate">{GATE_LABELS[gate]}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-800">
        <div className="text-xs text-gray-500 mb-1.5">Phase {currentPhase}/5</div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${(currentPhase / 5) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
