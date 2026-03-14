'use client';

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { AgentNode } from '@/types/agents';

type WorkerNodeType = Node<AgentNode, 'worker'>;

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-400',
  working: 'bg-green-400 animate-pulse',
  done: 'bg-emerald-400',
  error: 'bg-red-400 animate-pulse',
};

const PROVIDER_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  claude: { border: 'border-blue-500', bg: 'bg-blue-950', text: 'text-blue-300' },
  codex: { border: 'border-amber-500', bg: 'bg-amber-950', text: 'text-amber-300' },
  gemini: { border: 'border-purple-500', bg: 'bg-purple-950', text: 'text-purple-300' },
};

const PROVIDER_LABELS: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  gemini: 'Gemini',
};

export function WorkerNode({ data }: NodeProps<WorkerNodeType>) {
  const colors = PROVIDER_COLORS[data.provider] || PROVIDER_COLORS.claude;
  const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS.idle;

  return (
    <div className={`rounded-xl border-2 ${colors.border} ${colors.bg} px-5 py-4 shadow-lg min-w-[180px] max-w-[220px]`}>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3" />
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-mono ${colors.text} uppercase tracking-wider`}>
          {PROVIDER_LABELS[data.provider]}
        </span>
        <div className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
      </div>
      <div className="text-sm font-bold text-white">{data.teamId}</div>
      <div className={`text-xs ${colors.text} mt-0.5`}>{data.modules?.join(', ')}</div>
      {data.currentTask && (
        <div className="mt-2 px-2 py-1.5 rounded-md bg-black/30 text-xs text-gray-300 leading-snug">
          {data.currentTask}
        </div>
      )}
      <div className="flex items-center gap-1 mt-2">
        <span className={`text-[10px] font-mono ${colors.text}`}>{data.status}</span>
        {data.consensusRounds > 0 && (
          <span className="text-[10px] text-gray-500 ml-auto">R{data.consensusRounds}</span>
        )}
      </div>
    </div>
  );
}
