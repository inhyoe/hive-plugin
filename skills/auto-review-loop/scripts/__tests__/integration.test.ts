import { describe, expect, test } from "bun:test";
import { parseReview } from "../review-parser";
import { buildReviewPrompt, buildVerifyPrompt } from "../prompt-builder";
import { initState, updateState, checkState } from "../state-manager";
import { parseDiffOutput, buildDiffCommand } from "../diff-collector";

describe("module imports", () => {
  test("all modules import successfully", () => {
    expect(parseReview).toBeFunction();
    expect(buildReviewPrompt).toBeFunction();
    expect(buildVerifyPrompt).toBeFunction();
    expect(initState).toBeFunction();
    expect(updateState).toBeFunction();
    expect(checkState).toBeFunction();
    expect(parseDiffOutput).toBeFunction();
    expect(buildDiffCommand).toBeFunction();
  });
});

describe("full pipeline: parse → check → build verify", () => {
  test("issues found → fix → verify prompt", () => {
    const reviewResponse = `### Issues
1. **[src/main.ts:42]** Missing null check
2. **[src/utils.ts:10]** Unused import`;

    // Step 1: Parse review
    const parsed = parseReview(reviewResponse);
    expect(parsed.hasIssues).toBe(true);
    expect(parsed.issues).toHaveLength(2);

    // Step 2: Check state
    const state = initState("feature/test", "main", 10);
    const result = checkState(state, parsed.issues);
    expect(result.shouldContinue).toBe(true);

    // Step 3: Update state
    const updated = updateState(state, parsed.issues);
    expect(updated.iteration).toBe(1);

    // Step 4: Build verify prompt
    const fixDiff = "--- a/src/main.ts\n+++ b/src/main.ts\n+ if (!x) return;";
    const prompt = buildVerifyPrompt(parsed.issues, fixDiff);
    expect(prompt).toContain("[VERIFY REQUEST]");
    expect(prompt).toContain("Missing null check");
    expect(prompt).toContain(fixDiff);
  });
});

describe("no issues path", () => {
  test("NO ISSUES FOUND → shouldContinue false", () => {
    const parsed = parseReview("NO ISSUES FOUND");
    expect(parsed.hasIssues).toBe(false);

    const state = initState("feature/test", "main", 10);
    const result = checkState(state, parsed.issues);
    expect(result.shouldContinue).toBe(false);
    expect(result.reason).toBe("no issues");
  });
});

describe("max iterations path", () => {
  test("state at max → shouldContinue false", () => {
    let state = initState("feature/test", "main", 1);
    const issues = [{ file: "a.ts", line: 1, description: "bug" }];
    state = updateState(state, issues);

    const result = checkState(state, issues);
    expect(result.shouldContinue).toBe(false);
    expect(result.reason).toMatch(/max iterations|duplicate issues/);
  });
});

describe("diff pipeline", () => {
  test("parseDiffOutput integrates with buildDiffCommand", () => {
    const cmd = buildDiffCommand("develop");
    expect(cmd).toEqual(["git", "diff", "develop...HEAD"]);

    const diffResult = parseDiffOutput("+ line1\n+ line2\n+ line3");
    expect(diffResult.empty).toBe(false);
    expect(diffResult.lineCount).toBe(3);

    // Can feed diff into review prompt
    const prompt = buildReviewPrompt(diffResult.diff);
    expect(prompt).toContain("+ line1");
  });
});
