import { spawnPane, sendKeys, sendCtrlC, killPane } from './tmux.js';
import * as registry from './registry.js';
import { PROVIDER_COMMANDS } from './types.js';
export function spawnProvider(options) {
    const paneId = spawnPane(options.name, options.session, options.historyLimit ?? 10_000);
    // Launch provider TUI without prompt
    const providerCmd = PROVIDER_COMMANDS[options.provider] ?? options.provider;
    sendKeys(paneId, providerCmd);
    // Wait for TUI to be ready
    const start = Date.now();
    while (Date.now() - start < 2000) { /* busy wait for TUI init */ }
    const entry = {
        paneId,
        provider: options.provider,
        startedAt: new Date().toISOString(),
    };
    registry.register(options.name, entry);
    return entry;
}
export function killProvider(name) {
    const entry = registry.get(name);
    if (!entry)
        return;
    try {
        sendCtrlC(entry.paneId);
        // Small delay for C-c to take effect
        const start = Date.now();
        while (Date.now() - start < 500) { /* busy wait */ }
        killPane(entry.paneId);
    }
    finally {
        registry.unregister(name);
    }
}
//# sourceMappingURL=spawner.js.map