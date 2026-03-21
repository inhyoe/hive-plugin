import type { LoopState, ReviewIssue, StateCheckResult } from "./lib/types";

export function initState(
  branch: string,
  baseBranch: string,
  maxIterations: number
): LoopState {
  return {
    branch,
    baseBranch,
    iteration: 0,
    maxIterations,
    previousIssues: [],
    startedAt: new Date().toISOString(),
  };
}

export function updateState(
  state: LoopState,
  newIssues: ReviewIssue[]
): LoopState {
  return {
    ...state,
    iteration: state.iteration + 1,
    previousIssues: newIssues,
  };
}

export function checkState(
  state: LoopState,
  currentIssues: ReviewIssue[]
): StateCheckResult {
  if (currentIssues.length === 0) {
    return { shouldContinue: false, reason: "no issues", iteration: state.iteration };
  }

  if (state.iteration >= state.maxIterations) {
    return { shouldContinue: false, reason: "max iterations", iteration: state.iteration };
  }

  if (areDuplicateIssues(state.previousIssues, currentIssues)) {
    return { shouldContinue: false, reason: "duplicate issues", iteration: state.iteration };
  }

  return { shouldContinue: true, reason: "", iteration: state.iteration };
}

function areDuplicateIssues(
  prev: ReviewIssue[],
  current: ReviewIssue[]
): boolean {
  if (prev.length === 0 || current.length === 0) return false;
  if (prev.length !== current.length) return false;

  const prevSet = new Set(prev.map((i) => `${i.file}::${i.description}`));
  return current.every((i) => prevSet.has(`${i.file}::${i.description}`));
}

export function getStatePath(branch: string): string {
  const sanitized = branch.replace(/\//g, "-");
  return `/tmp/auto-review-state-${sanitized}.json`;
}

export function serializeState(state: LoopState): string {
  return JSON.stringify(state, null, 2);
}

export function deserializeState(json: string): LoopState {
  return JSON.parse(json);
}

// Unwrap ParsedReview wrapper or accept ReviewIssue[] directly
export function extractIssues(raw: unknown): ReviewIssue[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && "issues" in raw && Array.isArray((raw as any).issues)) {
    return (raw as any).issues;
  }
  return [];
}

// CLI
if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.includes("--init")) {
    const branchIdx = args.indexOf("--branch");
    const baseIdx = args.indexOf("--base");
    const maxIdx = args.indexOf("--max");

    const branch = branchIdx !== -1 ? args[branchIdx + 1] : "";
    const base = baseIdx !== -1 ? args[baseIdx + 1] : "main";
    const max = maxIdx !== -1 ? parseInt(args[maxIdx + 1], 10) : 10;

    const state = initState(branch, base, max);
    const path = getStatePath(branch);
    await Bun.write(path, serializeState(state));
    console.log(JSON.stringify({ path, state }, null, 2));
  } else if (args.includes("--update")) {
    const stateIdx = args.indexOf("--state");
    const issuesIdx = args.indexOf("--issues");

    if (stateIdx === -1 || issuesIdx === -1) {
      console.error("Usage: --update --state <file> --issues <json-file>");
      process.exit(1);
    }

    const state = deserializeState(await Bun.file(args[stateIdx + 1]).text());
    const issues = extractIssues(JSON.parse(await Bun.file(args[issuesIdx + 1]).text()));
    const updated = updateState(state, issues);
    await Bun.write(args[stateIdx + 1], serializeState(updated));
    console.log(JSON.stringify(updated, null, 2));
  } else if (args.includes("--check")) {
    const stateIdx = args.indexOf("--state");
    const issuesIdx = args.indexOf("--issues");

    if (stateIdx === -1 || issuesIdx === -1) {
      console.error("Usage: --check --state <file> --issues <json-file>");
      process.exit(1);
    }

    const state = deserializeState(await Bun.file(args[stateIdx + 1]).text());
    const issues = extractIssues(JSON.parse(await Bun.file(args[issuesIdx + 1]).text()));
    const result = checkState(state, issues);
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.error("Usage: --init|--update|--check");
    process.exit(1);
  }
}
