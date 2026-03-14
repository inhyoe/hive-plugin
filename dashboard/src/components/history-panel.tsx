'use client';

import { useState, useEffect, useCallback } from 'react';
import { useHiveStore } from '@/store/hive-store';

interface SessionSummary {
  sessionId: string;
  startedAt: string;
  completedAt: string;
  totalEvents: number;
  teams: number;
  passed: number;
  failed: number;
  providers: string;
  teamIds: string;
  project: string;
}

const API_BASE = process.env.NEXT_PUBLIC_HISTORY_API || 'http://localhost:3570';

export function HistoryPanel() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const currentSessionId = useHiveStore((s) => s.sessionId);
  const handleEvent = useHiveStore((s) => s.handleEvent);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/history`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch {
      // API not available
    }
  }, []);

  useEffect(() => {
    if (expanded) fetchSessions();
  }, [expanded, fetchSessions]);

  const loadSession = async (sessionId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/history/${sessionId}`);
      if (res.ok) {
        const events = await res.json();
        // Reset store and replay events
        useHiveStore.getState().reset();
        useHiveStore.setState({ connected: true });
        for (const event of events) {
          handleEvent(event);
        }
      }
    } catch {
      // Failed to load
    }
    setLoading(false);
  };

  function formatTime(ts: string): string {
    try {
      const d = new Date(ts);
      return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch {
      return ts;
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded border border-gray-700 hover:border-gray-500 transition-colors"
      >
        History ({sessions.length || '...'})
      </button>
    );
  }

  return (
    <div className="fixed top-14 left-2 w-72 max-h-96 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <h3 className="text-xs font-mono text-gray-400 uppercase">Session History</h3>
        <button
          onClick={() => setExpanded(false)}
          className="text-gray-500 hover:text-gray-300 text-sm"
        >
          x
        </button>
      </div>

      <div className="overflow-y-auto max-h-80">
        {sessions.length === 0 && (
          <div className="text-xs text-gray-600 p-3">No past sessions</div>
        )}
        {sessions.map((s) => (
          <button
            key={s.sessionId}
            onClick={() => loadSession(s.sessionId)}
            disabled={loading || s.sessionId === currentSessionId}
            className={`w-full text-left px-3 py-2 border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${
              s.sessionId === currentSessionId ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : ''
            } ${loading ? 'opacity-50' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-gray-300 truncate max-w-[140px]">
                {s.sessionId}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                s.failed > 0 ? 'bg-red-900 text-red-300' : 'bg-emerald-900 text-emerald-300'
              }`}>
                {s.passed}/{s.teams}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-gray-500">{formatTime(s.completedAt)}</span>
              <span className="text-[10px] text-gray-600">{s.providers}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="px-3 py-1.5 border-t border-gray-800">
        <button
          onClick={fetchSessions}
          className="text-[10px] text-gray-500 hover:text-gray-300"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
