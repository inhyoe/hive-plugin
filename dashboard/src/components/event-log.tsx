'use client';

import { useEffect, useRef } from 'react';
import { useHiveStore } from '@/store/hive-store';
import type { HiveEventUnion } from '@/types/events';

const TYPE_COLORS: Record<string, string> = {
  'phase.transition': 'text-blue-400', 'gate.update': 'text-yellow-400',
  'team.created': 'text-cyan-400', 'agent.status': 'text-green-400',
  'agent.message': 'text-purple-400', 'consensus.update': 'text-orange-400',
  'wave.transition': 'text-pink-400', 'execution.result': 'text-emerald-400',
  'session.summary': 'text-white', 'cross_feedback': 'text-red-400',
  'lead.decision': 'text-amber-400', 'phase.error': 'text-red-500',
  'execution.retry': 'text-orange-500', 'agent.spawn': 'text-cyan-300',
};

function formatTime(ts: string): string {
  try { return new Date(ts).toLocaleTimeString('en-US', { hour12: false }); }
  catch { return ts; }
}

function summarize(event: HiveEventUnion): string {
  switch (event.type) {
    case 'phase.transition': return `Phase ${event.payload.phase} ${event.payload.status}`;
    case 'gate.update': return `${event.payload.gate} ${event.payload.status}`;
    case 'team.created': return `${event.payload.teamId} (${event.payload.provider}) created`;
    case 'agent.status': return `${event.payload.teamId} → ${event.payload.status}: ${event.payload.currentTask || ''}`;
    case 'agent.message': return `${event.payload.direction}: ${event.payload.summary}`;
    case 'consensus.update': return `${event.payload.teamId} R${event.payload.round} ${event.payload.response}`;
    case 'wave.transition': return `Wave ${event.payload.waveId} ${event.payload.status}`;
    case 'execution.result': return `${event.payload.teamId} ${event.payload.success ? 'PASS' : 'FAIL'} (${event.payload.changedFiles?.length || 0} files)`;
    case 'session.summary': return `Complete: ${event.payload.passed}/${event.payload.totalTeams} passed`;
    case 'cross_feedback': return `${event.payload.fromTeam}→${event.payload.toTeam} [${event.payload.severity}] ${event.payload.summary}`;
    case 'lead.decision': return `${event.payload.teamId} LEAD DECISION R${event.payload.round}`;
    case 'phase.error': return `Phase ${event.payload.phase} ERROR: ${event.payload.message}`;
    case 'execution.retry': return `${event.payload.teamId} retry ${event.payload.attempt}/${event.payload.maxAttempts}`;
    case 'agent.spawn': return `${event.payload.teamId} spawned (${event.payload.provider} via ${event.payload.spawnMethod})`;
    default: return JSON.stringify((event as { payload: unknown }).payload);
  }
}

export function EventLog() {
  const eventLog = useHiveStore((s) => s.eventLog);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [eventLog.length]);

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 h-full overflow-y-auto font-mono text-xs">
      <h2 className="text-gray-500 uppercase tracking-wider mb-2 text-[10px]">Event Log</h2>
      {eventLog.length === 0 && <div className="text-gray-700">Waiting for events...</div>}
      {eventLog.map((event, i) => (
        <div key={i} className="flex gap-2 py-0.5 hover:bg-gray-900/50">
          <span className="text-gray-600 shrink-0">{formatTime(event.timestamp)}</span>
          <span className={`shrink-0 ${TYPE_COLORS[event.type] || 'text-gray-400'}`}>[{event.type}]</span>
          <span className="text-gray-400 truncate">{summarize(event)}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
