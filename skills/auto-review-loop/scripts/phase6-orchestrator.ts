import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { Phase6Result } from "./lib/types";
import { collectFiles } from "./diff-collector";
import { buildFileReviewPrompt, buildClaudeTeamPrompt } from "./prompt-builder";

function validateEntry(): { valid: boolean; reason?: string } {
  // G7 marker check
  if (!existsSync(".hive-state/g7-e2e-validate.marker")) {
    return { valid: false, reason: "G7 marker not found (.hive-state/g7-e2e-validate.marker)" };
  }

  // git clean check
  try {
    const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf-8" }).trim();
    if (status !== "") {
      return { valid: false, reason: `git working tree not clean: ${status.split("\n")[0]}...` };
    }
  } catch {
    return { valid: false, reason: "failed to check git status" };
  }

  return { valid: true };
}

function checkCodexAvailable(): boolean {
  const result = spawnSync("ccb-ping", ["codex"], { encoding: "utf-8" });
  return result.status === 0;
}

// CLI
if (import.meta.main) {
  const args = process.argv.slice(2);
  const baseIdx = args.indexOf("--base");
  const base = baseIdx !== -1 ? args[baseIdx + 1] : "main";

  // 1. Entry validation
  const entry = validateEntry();
  if (!entry.valid) {
    const result: Phase6Result = {
      reviewer: "codex",
      files: [],
      reviewDir: "",
      prompt: "",
      entryValid: false,
      error: entry.reason,
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  // 2. Collect changed files
  const collected = collectFiles(base);
  if (collected.error) {
    const result: Phase6Result = {
      reviewer: "codex",
      files: [],
      reviewDir: collected.reviewDir,
      prompt: "",
      entryValid: true,
      error: collected.error,
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  if (collected.fileCount === 0) {
    const result: Phase6Result = {
      reviewer: "codex",
      files: [],
      reviewDir: collected.reviewDir,
      prompt: "",
      entryValid: true,
      error: "no changed files",
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  // 3. Select reviewer
  const codexAvailable = checkCodexAvailable();
  const reviewer = codexAvailable ? "codex" : "claude-team";

  // 4. Build prompt
  const prompt = reviewer === "codex"
    ? buildFileReviewPrompt(collected.files)
    : buildClaudeTeamPrompt(collected.files, collected.reviewDir);

  const result: Phase6Result = {
    reviewer,
    files: collected.files,
    reviewDir: collected.reviewDir,
    prompt,
    entryValid: true,
  };

  console.log(JSON.stringify(result, null, 2));
}
