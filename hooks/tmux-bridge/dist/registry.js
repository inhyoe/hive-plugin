import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { REGISTRY_DIR, REGISTRY_FILE } from './types.js';
import { paneExists } from './tmux.js';
function ensureDir() {
    mkdirSync(REGISTRY_DIR, { recursive: true });
}
export function load() {
    try {
        const raw = readFileSync(REGISTRY_FILE, 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
export function save(registry) {
    ensureDir();
    const tmp = `${REGISTRY_FILE}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(registry, null, 2));
    renameSync(tmp, REGISTRY_FILE);
}
export function register(name, entry) {
    const reg = load();
    reg[name] = entry;
    save(reg);
}
export function unregister(name) {
    const reg = load();
    delete reg[name];
    save(reg);
}
export function get(name) {
    const reg = load();
    return reg[name] ?? null;
}
export function list() {
    return load();
}
export function reconcile() {
    const reg = load();
    let changed = false;
    for (const [name, entry] of Object.entries(reg)) {
        if (!paneExists(entry.paneId)) {
            delete reg[name];
            changed = true;
        }
    }
    if (changed)
        save(reg);
    return reg;
}
//# sourceMappingURL=registry.js.map