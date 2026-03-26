import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { REGISTRY_DIR, REGISTRY_FILE } from './types.js';
import type { Registry, RegistryEntry } from './types.js';
import { paneExists } from './tmux.js';

function ensureDir(): void {
  mkdirSync(REGISTRY_DIR, { recursive: true });
}

export function load(): Registry {
  try {
    const raw = readFileSync(REGISTRY_FILE, 'utf-8');
    return JSON.parse(raw) as Registry;
  } catch {
    return {};
  }
}

export function save(registry: Registry): void {
  ensureDir();
  const tmp = `${REGISTRY_FILE}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(registry, null, 2));
  renameSync(tmp, REGISTRY_FILE);
}

export function register(name: string, entry: RegistryEntry): void {
  const reg = load();
  reg[name] = entry;
  save(reg);
}

export function unregister(name: string): void {
  const reg = load();
  delete reg[name];
  save(reg);
}

export function get(name: string): RegistryEntry | null {
  const reg = load();
  return reg[name] ?? null;
}

export function list(): Registry {
  return load();
}

export function reconcile(): Registry {
  const reg = load();
  let changed = false;
  for (const [name, entry] of Object.entries(reg)) {
    if (!paneExists(entry.paneId)) {
      delete reg[name];
      changed = true;
    }
  }
  if (changed) save(reg);
  return reg;
}
