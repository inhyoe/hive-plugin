export interface ReviewIssue {
  file: string;
  line: number;
  description: string;
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
  reviewDir: string;
  fileCount: number;
  error?: string;
}

export interface Phase6Result {
  reviewer: "codex" | "claude-team";
  files: string[];
  reviewDir: string;
  prompt: string;
  entryValid: boolean;
  error?: string;
}
