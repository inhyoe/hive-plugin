import type { ParsedReview, ReviewIssue } from "./lib/types";

const ISSUE_PATTERN = /^\d+\.\s*\*\*\[([^:\]]+):(\d+)\]\*\*\s*(.+)/;

export function parseReview(input: string): ParsedReview {
  const raw = input;

  // Parse issues first — a response may quote "NO ISSUES FOUND" while listing real issues
  const issues: ReviewIssue[] = [];
  const lines = input.split("\n");

  for (const line of lines) {
    const match = line.trim().match(ISSUE_PATTERN);
    if (match) {
      issues.push({
        file: match[1],
        line: parseInt(match[2], 10),
        description: match[3],
      });
    }
  }

  // Issues found → always report them, regardless of sentinel text
  if (issues.length > 0) {
    return { hasIssues: true, issues, raw };
  }

  // No issues parsed — no actionable items
  return { hasIssues: false, issues: [], raw };
}

// CLI
if (import.meta.main) {
  const args = process.argv.slice(2);
  const inputIdx = args.indexOf("--input");

  let input: string;
  if (inputIdx !== -1 && args[inputIdx + 1] && !args[inputIdx + 1].startsWith("--")) {
    input = await Bun.file(args[inputIdx + 1]).text();
  } else if (inputIdx !== -1) {
    console.error("Usage: --input <file>");
    process.exit(1);
  } else {
    input = await Bun.stdin.text();
  }

  const result = parseReview(input);
  console.log(JSON.stringify(result, null, 2));
}
