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
