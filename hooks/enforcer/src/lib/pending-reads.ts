import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import { acquireLock, releaseLock } from './state.js';

const PENDING_FILE = 'pending-reads.json';

function pendingPath(stateDir: string): string {
  return join(stateDir, PENDING_FILE);
}

/**
 * Read current pending reads list.
 */
export function readPendingReads(stateDir: string): string[] {
  const filePath = pendingPath(stateDir);
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Write pending reads (lock-backed).
 */
export function writePendingReads(stateDir: string, paths: string[]): void {
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
  acquireLock(stateDir);
  try {
    writeFileSync(pendingPath(stateDir), JSON.stringify(paths, null, 2), 'utf-8');
  } finally {
    releaseLock(stateDir);
  }
}

/**
 * Check if there are pending reads.
 */
export function hasPendingReads(stateDir: string): boolean {
  return readPendingReads(stateDir).length > 0;
}

/**
 * Normalize a file path for comparison.
 * Resolves against repoRoot if relative, then attempts realpath.
 */
function normalizePath(filePath: string, repoRoot: string): string {
  const absolute = resolve(repoRoot, filePath);
  try {
    return realpathSync(absolute);
  } catch {
    // File might not exist yet; use resolved absolute
    return absolute;
  }
}

/**
 * Clear a specific read path from pending reads (lock-backed).
 * Compares using realpath normalization to prevent symlink/path bypasses.
 */
export function clearReadPath(stateDir: string, readPath: string, repoRoot: string): void {
  acquireLock(stateDir);
  try {
    const pending = readPendingReads(stateDir);
    if (pending.length === 0) return;

    const normalizedRead = normalizePath(readPath, repoRoot);
    const remaining = pending.filter(
      (p) => normalizePath(p, repoRoot) !== normalizedRead,
    );

    if (remaining.length !== pending.length) {
      writeFileSync(pendingPath(stateDir), JSON.stringify(remaining, null, 2), 'utf-8');
    }
  } finally {
    releaseLock(stateDir);
  }
}
