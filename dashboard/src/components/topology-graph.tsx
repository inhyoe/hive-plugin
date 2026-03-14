'use client';

import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeTypes,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import type React from 'react';
import '@xyflow/react/dist/style.css';

import { useHiveStore } from '@/store/hive-store';
import type { LeadNode as LeadNodeData } from '@/types/agents';
import type { AgentNode } from '@/types/agents';
import { LeadNode } from '@/components/nodes/lead-node';
import { WorkerNode } from '@/components/nodes/worker-node';

const nodeTypes: NodeTypes = {
  lead: LeadNode,
  worker: WorkerNode,
};

const EDGE_STYLES: Record<string, { stroke: string; strokeDasharray?: string }> = {
  claude: { stroke: '#3b82f6' },
  codex: { stroke: '#f59e0b', strokeDasharray: '6 3' },
  gemini: { stroke: '#a855f7', strokeDasharray: '6 3' },
};

interface Props {
  onSelectTeam: (teamId: string | null) => void;
}

export function TopologyGraph({ onSelectTeam }: Props) {
  const lead = useHiveStore((s) => s.lead);
  const workers = useHiveStore((s) => s.workers);

  const workerEntries = useMemo(() => Object.entries(workers), [workers]);

  const nodes = useMemo<Node[]>(() => {
    const totalWorkers = workerEntries.length;
    const spacing = 240;
    const startX = -(totalWorkers - 1) * spacing / 2;

    const leadNode: Node<LeadNodeData, 'lead'> = {
      id: 'lead',
      type: 'lead',
      position: { x: 0, y: 0 },
      data: { ...lead },
    };

    const workerNodes: Node<AgentNode, 'worker'>[] = workerEntries.map(([teamId, worker], i) => ({
      id: teamId,
      type: 'worker',
      position: { x: startX + i * spacing, y: 200 },
      data: { ...worker },
    }));

    return [leadNode, ...workerNodes];
  }, [lead, workerEntries]);

  const edges = useMemo<Edge[]>(() => {
    return workerEntries.map(([teamId, worker]) => {
      const style = EDGE_STYLES[worker.provider] || EDGE_STYLES.claude;
      return {
        id: `lead-${teamId}`,
        source: 'lead',
        target: teamId,
        animated: worker.status === 'working',
        style,
      };
    });
  }, [workerEntries]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === 'worker') {
        onSelectTeam(node.id);
      } else {
        onSelectTeam(null);
      }
    },
    [onSelectTeam],
  );

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#374151" />
      </ReactFlow>
    </div>
  );
}
