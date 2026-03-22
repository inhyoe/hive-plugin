import { spawnPane, sendCtrlC, killPane } from './tmux.js';
import * as registry from './registry.js';
import type { SpawnOptions, RegistryEntry } from './types.js';

export function spawnProvider(options: SpawnOptions): RegistryEntry {
  const paneId = spawnPane(
    options.name,
    options.session,
    options.historyLimit ?? 10_000,
  );

  const entry: RegistryEntry = {
    paneId,
    provider: options.provider,
    startedAt: new Date().toISOString(),
  };

  registry.register(options.name, entry);
  return entry;
}

export function killProvider(name: string): void {
  const entry = registry.get(name);
  if (!entry) return;

  try {
    sendCtrlC(entry.paneId);
    // Small delay for C-c to take effect
    const start = Date.now();
    while (Date.now() - start < 500) { /* busy wait */ }
    killPane(entry.paneId);
  } finally {
    registry.unregister(name);
  }
}
