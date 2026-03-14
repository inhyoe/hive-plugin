'use client';

import { useMemo } from 'react';
import { useHiveStore } from '@/store/hive-store';

export function ResultsSummary() {
  const workers = useHiveStore((s) => s.workers);
  const eventLog = useHiveStore((s) => s.eventLog);

  const stats = useMemo(() => {
    const workerList = Object.values(workers);
    const completed = workerList.filter((w) => w.status === 'done' || w.status === 'error');
    const passed = workerList.filter((w) => w.success === true);
    const failed = workerList.filter((w) => w.success === false);
    const totalFiles = workerList.reduce((sum, w) => sum + w.changedFiles.length, 0);

    const resultEvents = eventLog.filter((e) => e.type === 'execution.result');
    const totalLinesAdded = resultEvents.reduce((sum, e) => sum + (Number(e.payload.linesAdded) || 0), 0);
    const totalLinesRemoved = resultEvents.reduce((sum, e) => sum + (Number(e.payload.linesRemoved) || 0), 0);

    const avgRounds = workerList.length > 0
      ? (workerList.reduce((sum, w) => sum + w.consensusRounds, 0) / workerList.length).toFixed(1)
      : '0';

    return {
      total: workerList.length,
      completed: completed.length,
      passed: passed.length,
      failed: failed.length,
      totalFiles,
      totalLinesAdded,
      totalLinesRemoved,
      avgRounds,
    };
  }, [workers, eventLog]);

  if (stats.total === 0) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
      <h2 className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2">Results</h2>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-lg font-bold text-white">{stats.passed}/{stats.total}</div>
          <div className="text-[10px] text-gray-500">Teams Passed</div>
        </div>
        <div>
          <div className="text-lg font-bold text-cyan-400">{stats.totalFiles}</div>
          <div className="text-[10px] text-gray-500">Files Changed</div>
        </div>
        <div>
          <div className="text-lg font-bold text-green-400">+{stats.totalLinesAdded}</div>
          <div className="text-[10px] text-gray-500">Lines Added</div>
        </div>
        <div>
          <div className="text-lg font-bold text-red-400">-{stats.totalLinesRemoved}</div>
          <div className="text-[10px] text-gray-500">Lines Removed</div>
        </div>
      </div>
      {stats.failed > 0 && (
        <div className="mt-2 text-xs text-red-400 text-center">{stats.failed} team(s) failed</div>
      )}
      <div className="mt-1 text-[10px] text-gray-600 text-center">Avg consensus rounds: {stats.avgRounds}</div>
    </div>
  );
}
