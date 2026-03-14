'use client';

import { useHiveStore } from '@/store/hive-store';
import type { AgentNode } from '@/types/agents';

interface Props { selectedTeamId: string | null; }

const STATUS_BADGE: Record<string, string> = {
  idle: 'bg-gray-700 text-gray-300', working: 'bg-green-900 text-green-300',
  done: 'bg-emerald-900 text-emerald-300', error: 'bg-red-900 text-red-300',
};

export function AgentDetailPanel({ selectedTeamId }: Props) {
  const workers = useHiveStore((s) => s.workers);
  const eventLog = useHiveStore((s) => s.eventLog);
  const agent: AgentNode | null = selectedTeamId ? workers[selectedTeamId] ?? null : null;

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full text-gray-600 text-sm p-4">
        Click a worker node to view details
      </div>
    );
  }

  const agentMessages = eventLog.filter(
    (e): e is import('@/types/events').AgentMessageEvent => {
      if (e.type !== 'agent.message') return false;
      const p = e.payload;
      return p.from === agent.teamId || p.to === agent.teamId;
    }
  );

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-900 rounded-xl border border-gray-800 h-full overflow-y-auto">
      <div>
        <h2 className="text-lg font-bold text-white">{agent.teamId}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs font-mono text-gray-400 capitalize">{agent.provider}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_BADGE[agent.status]}`}>{agent.status}</span>
        </div>
      </div>
      <div>
        <h3 className="text-xs font-mono text-gray-500 uppercase mb-1">Current Task</h3>
        <p className="text-sm text-gray-300 bg-black/30 rounded-lg px-3 py-2">{agent.currentTask || 'No active task'}</p>
      </div>
      <div>
        <h3 className="text-xs font-mono text-gray-500 uppercase mb-1">Modules</h3>
        <div className="flex flex-wrap gap-1">
          {agent.modules.map((m) => (
            <span key={m} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">{m}</span>
          ))}
        </div>
      </div>
      {agent.changedFiles.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-gray-500 uppercase mb-1">Changed Files ({agent.changedFiles.length})</h3>
          <ul className="text-xs text-gray-400 space-y-0.5 font-mono">
            {agent.changedFiles.map((f) => (<li key={f} className="truncate">{f}</li>))}
          </ul>
        </div>
      )}
      <div>
        <h3 className="text-xs font-mono text-gray-500 uppercase mb-1">Consensus (Round {agent.consensusRounds})</h3>
      </div>
      {agentMessages.length > 0 && (
        <div>
          <h3 className="text-xs font-mono text-gray-500 uppercase mb-1">Messages</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {agentMessages.slice(-10).map((e, i) => (
              <div key={i} className="text-xs text-gray-400 bg-black/20 rounded px-2 py-1">
                {String(e.payload.direction)}: {String(e.payload.summary)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
