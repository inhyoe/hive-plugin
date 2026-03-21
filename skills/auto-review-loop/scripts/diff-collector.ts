import { execFileSync } from "node:child_process";
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { DiffResult, FileCollectResult } from "./lib/types";

const MAX_LINES = 5000;
const REVIEW_DIR = ".hive-state/review";

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

export function collectFiles(base: string, reviewDir: string = REVIEW_DIR): FileCollectResult {
  try {
    const raw = execFileSync("git", ["diff", "--name-only", `${base}...HEAD`], { encoding: "utf-8" });
    const files = raw.trim().split("\n").filter(Boolean);

    if (files.length === 0) {
      return { files: [], reviewDir, fileCount: 0 };
    }

    mkdirSync(reviewDir, { recursive: true });

    const copiedFiles: string[] = [];
    const deletedFiles: string[] = [];

    for (const file of files) {
      if (!existsSync(file)) {
        deletedFiles.push(file);
        continue;
      }
      const dest = join(reviewDir, file);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(file, dest);
      copiedFiles.push(file);
    }

    return { files: copiedFiles, deletedFiles, reviewDir, fileCount: copiedFiles.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { files: [], reviewDir, fileCount: 0, error: message };
  }
}

// CLI
if (import.meta.main) {
  const args = process.argv.slice(2);
  const baseIdx = args.indexOf("--base");
  const modeIdx = args.indexOf("--mode");
  const base = baseIdx !== -1 ? args[baseIdx + 1] : "main";
  const mode = modeIdx !== -1 ? args[modeIdx + 1] : "diff";

  if (mode === "files") {
    const result = collectFiles(base);
    console.log(JSON.stringify(result, null, 2));
  } else {
    const result = collectDiff(base);
    console.log(JSON.stringify(result, null, 2));
  }
}
