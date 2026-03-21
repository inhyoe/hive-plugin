import { execFileSync } from "node:child_process";
import type { DiffResult } from "./lib/types";

const MAX_LINES = 5000;

export function parseDiffOutput(raw: string): DiffResult {
  if (raw === "") {
    return { diff: "", lineCount: 0, empty: true, tooLarge: false };
  }

  const lines = raw.split("\n");
  const lineCount = lines.length;

  return {
    diff: raw,
    lineCount,
    empty: false,
    tooLarge: lineCount > MAX_LINES,
  };
}

export function buildDiffCommand(base: string): string[] {
  return ["git", "diff", `${base}...HEAD`];
}

export function collectDiff(base: string): DiffResult {
  const [cmd, ...args] = buildDiffCommand(base);
  try {
    const raw = execFileSync(cmd, args, { encoding: "utf-8" });
    return parseDiffOutput(raw);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { diff: "", lineCount: 0, empty: false, tooLarge: false, error: message };
  }
}

// CLI
if (import.meta.main) {
  const args = process.argv.slice(2);
  const baseIdx = args.indexOf("--base");
  const base = baseIdx !== -1 ? args[baseIdx + 1] : "main";

  const result = collectDiff(base);
  console.log(JSON.stringify(result, null, 2));
}
