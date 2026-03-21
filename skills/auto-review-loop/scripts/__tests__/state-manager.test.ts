import { describe, expect, test } from "bun:test";
import {
  initState,
  updateState,
  checkState,
  getStatePath,
  serializeState,
  deserializeState,
  extractIssues,
} from "../state-manager";
import type { ReviewIssue } from "../lib/types";

describe("initState", () => {
  test("creates state with iteration 0", () => {
    const state = initState("feature/foo", "main", 10);
    expect(state.branch).toBe("feature/foo");
    expect(state.baseBranch).toBe("main");
    expect(state.iteration).toBe(0);
    expect(state.maxIterations).toBe(10);
    expect(state.previousIssues).toEqual([]);
    expect(state.startedAt).toBeTruthy();
  });
});

describe("updateState", () => {
  test("increments iteration and sets previousIssues", () => {
    const state = initState("feature/foo", "main", 10);
    const issues: ReviewIssue[] = [
      { file: "a.ts", line: 1, description: "bug" },
    ];
    const updated = updateState(state, issues);
    expect(updated.iteration).toBe(1);
    expect(updated.previousIssues).toEqual(issues);
  });
});

describe("checkState", () => {
  test("no issues → shouldContinue false", () => {
    const state = initState("feature/foo", "main", 10);
    const result = checkState(state, []);
    expect(result.shouldContinue).toBe(false);
    expect(result.reason).toBe("no issues");
  });

  test("issues with iteration < max → shouldContinue true", () => {
    const state = initState("feature/foo", "main", 10);
    const issues: ReviewIssue[] = [
      { file: "a.ts", line: 1, description: "bug" },
    ];
    const result = checkState(state, issues);
    expect(result.shouldContinue).toBe(true);
  });

  test("iteration >= max → shouldContinue false", () => {
    let state = initState("feature/foo", "main", 2);
    state = updateState(state, [
      { file: "a.ts", line: 1, description: "bug" },
    ]);
    state = updateState(state, [
      { file: "a.ts", line: 1, description: "bug" },
    ]);
    const result = checkState(state, [
      { file: "a.ts", line: 1, description: "bug" },
    ]);
    expect(result.shouldContinue).toBe(false);
    expect(result.reason).toBe("max iterations");
  });

  test("duplicate issues → shouldContinue false", () => {
    const issues: ReviewIssue[] = [
      { file: "a.ts", line: 1, description: "bug" },
    ];
    let state = initState("feature/foo", "main", 10);
    state = updateState(state, issues);
    const result = checkState(state, issues);
    expect(result.shouldContinue).toBe(false);
    expect(result.reason).toBe("duplicate issues");
  });

  test("partial overlap → shouldContinue true", () => {
    const prevIssues: ReviewIssue[] = [
      { file: "a.ts", line: 1, description: "bug" },
      { file: "b.ts", line: 2, description: "typo" },
    ];
    const newIssues: ReviewIssue[] = [
      { file: "a.ts", line: 5, description: "bug" },
      { file: "c.ts", line: 3, description: "new issue" },
    ];
    let state = initState("feature/foo", "main", 10);
    state = updateState(state, prevIssues);
    const result = checkState(state, newIssues);
    expect(result.shouldContinue).toBe(true);
  });
});

describe("getStatePath", () => {
  test("sanitizes branch name", () => {
    const path = getStatePath("feature/my-branch");
    expect(path).toBe("/tmp/auto-review-state-feature-my-branch.json");
  });
});

describe("extractIssues", () => {
  test("unwraps ParsedReview wrapper object", () => {
    const wrapper = {
      hasIssues: true,
      issues: [{ file: "a.ts", line: 1, description: "bug" }],
      raw: "### Issues\n1. **[a.ts:1]** bug",
    };
    const result = extractIssues(wrapper);
    expect(result).toEqual([{ file: "a.ts", line: 1, description: "bug" }]);
  });

  test("passes through ReviewIssue[] directly", () => {
    const issues: ReviewIssue[] = [{ file: "a.ts", line: 1, description: "bug" }];
    const result = extractIssues(issues);
    expect(result).toEqual(issues);
  });

  test("returns empty array for hasIssues: false wrapper", () => {
    const wrapper = { hasIssues: false, issues: [], raw: "NO ISSUES FOUND" };
    const result = extractIssues(wrapper);
    expect(result).toEqual([]);
  });

  test("returns empty array for unexpected input", () => {
    expect(extractIssues(null)).toEqual([]);
    expect(extractIssues("string")).toEqual([]);
    expect(extractIssues(42)).toEqual([]);
  });
});

describe("serialize/deserialize roundtrip", () => {
  test("roundtrip preserves state", () => {
    const state = initState("feature/foo", "main", 10);
    const updated = updateState(state, [
      { file: "a.ts", line: 1, description: "bug" },
    ]);
    const json = serializeState(updated);
    const restored = deserializeState(json);
    expect(restored).toEqual(updated);
  });
});
