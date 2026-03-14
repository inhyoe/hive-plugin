'use client';

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { LeadNode as LeadNodeData } from '@/types/agents';

type LeadNodeType = Node<LeadNodeData, 'lead'>;

export function LeadNode({ data }: NodeProps<LeadNodeType>) {
  return (
    <div className="rounded-xl border-2 border-blue-500 bg-blue-950 px-6 py-4 shadow-lg shadow-blue-500/20 min-w-[160px]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse" />
        <span className="text-xs font-mono text-blue-300 uppercase tracking-wider">Lead</span>
      </div>
      <div className="text-lg font-bold text-white">Claude</div>
      <div className="text-xs text-blue-300 mt-1">
        {data.status === 'orchestrating' ? `Phase ${data.currentPhase}` : 'Idle'}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-3 !h-3" />
    </div>
  );
}
