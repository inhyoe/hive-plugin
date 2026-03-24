export interface ReviewIssue {
  file: string;
  line: number;
  description: string;
}

export interface CodeReviewerIssue {
  id: string;
  file?: string;
  line?: number;
  description: string;
  severity: "critical" | "important";
}

export interface CodeReviewerResult {
  hasIssues: boolean;
  issues: CodeReviewerIssue[];
  raw: string;
}

export interface DualReviewResult {
  codex: ParsedReview;
  codeReviewer: CodeReviewerResult;
  merged: ReviewIssue[];
}

export interface ParsedReview {
  hasIssues: boolean;
  issues: ReviewIssue[];
  raw: string;
}

export interface DiffResult {
  diff: string;
  lineCount: number;
  empty: boolean;
  tooLarge: boolean;
  error?: string;
}

export interface LoopState {
  branch: string;
  baseBranch: string;
  iteration: number;
  maxIterations: number;
  previousIssues: ReviewIssue[];
  startedAt: string;
}

export interface StateCheckResult {
  shouldContinue: boolean;
  reason: string;
  iteration: number;
}

export interface FileCollectResult {
  files: string[];
  deletedFiles?: string[];
  reviewDir: string;
  fileCount: number;
  error?: string;
}

export interface Phase6Result {
  reviewer: "codex" | "claude-team" | "codex+code-reviewer" | "claude-team+code-reviewer";
  files: string[];
  reviewDir: string;
  prompt: string;
  codeReviewerPrompt?: string;
  entryValid: boolean;
  error?: string;
}
