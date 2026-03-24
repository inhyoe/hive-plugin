import type { ReviewIssue, CodeReviewerIssue } from "./types";

/**
 * Merge Codex issues + code-reviewer issues, deduplicating by file:line.
 * Codex issues take priority (more specific file:line references).
 */
export function deduplicateIssues(
  codexIssues: ReviewIssue[],
  crIssues: CodeReviewerIssue[]
): ReviewIssue[] {
  const seen = new Set<string>();
  const merged: ReviewIssue[] = [];

  // Codex issues first (priority)
  for (const issue of codexIssues) {
    const key = `${issue.file}:${issue.line}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(issue);
    }
  }

  // code-reviewer issues (skip duplicates)
  for (const issue of crIssues) {
    const key = `${issue.file || ""}:${issue.line || 0}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({
        file: issue.file || "UNKNOWN",
        line: issue.line || 0,
        description: `[${issue.severity}] ${issue.description}`,
      });
    }
  }

  return merged;
}
