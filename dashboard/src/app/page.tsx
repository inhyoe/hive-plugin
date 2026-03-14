'use client';

import { useState } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { useHiveStore } from '@/store/hive-store';
import { TopologyGraph } from '@/components/topology-graph';
import { PipelinePanel } from '@/components/pipeline-panel';
import { AgentDetailPanel } from '@/components/agent-detail-panel';
import { EventLog } from '@/components/event-log';
import { ResultsSummary } from '@/components/results-summary';
import { HistoryPanel } from '@/components/history-panel';

export default function Home() {
  useWebSocket();
  const connected = useHiveStore((s) => s.connected);
  const sessionId = useHiveStore((s) => s.sessionId);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight">Hive Dashboard</h1>
          <HistoryPanel />
          {sessionId && (
            <span className="text-xs font-mono text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
              {sessionId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`}
          />
          <span className="text-xs text-gray-400">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </header>

      {/* Main content: 3-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Pipeline */}
        <aside className="w-48 shrink-0 p-2 overflow-y-auto">
          <PipelinePanel />
        </aside>

        {/* Center: Topology Graph */}
        <main className="flex-1 min-w-0">
          <TopologyGraph onSelectTeam={setSelectedTeamId} />
        </main>

        {/* Right: Agent Detail */}
        <aside className="w-72 shrink-0 p-2 overflow-y-auto">
          <AgentDetailPanel selectedTeamId={selectedTeamId} />
        </aside>
      </div>

      {/* Bottom section */}
      <div className="flex shrink-0 h-48 border-t border-gray-800">
        <div className="w-1/2 p-2 overflow-y-auto">
          <ResultsSummary />
        </div>
        <div className="w-1/2 p-2 overflow-y-auto border-l border-gray-800">
          <EventLog />
        </div>
      </div>
    </div>
  );
}
