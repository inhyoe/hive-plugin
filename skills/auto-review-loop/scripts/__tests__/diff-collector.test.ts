import { describe, expect, test } from "bun:test";
import { parseDiffOutput, buildDiffCommand, collectFiles } from "../diff-collector";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";

describe("parseDiffOutput", () => {
  test("empty string → empty true, tooLarge false", () => {
    const result = parseDiffOutput("");
    expect(result.empty).toBe(true);
    expect(result.tooLarge).toBe(false);
    expect(result.lineCount).toBe(0);
  });

  test("two lines → correct lineCount", () => {
    const result = parseDiffOutput("+ line1\n+ line2");
    expect(result.empty).toBe(false);
    expect(result.lineCount).toBe(2);
    expect(result.tooLarge).toBe(false);
  });

  test("5001 lines → tooLarge true", () => {
    const lines = Array(5001).fill("+ line").join("\n");
    const result = parseDiffOutput(lines);
    expect(result.tooLarge).toBe(true);
  });

  test("exactly 5000 lines → tooLarge false (boundary)", () => {
    const lines = Array(5000).fill("+ line").join("\n");
    const result = parseDiffOutput(lines);
    expect(result.tooLarge).toBe(false);
    expect(result.lineCount).toBe(5000);
  });
});

describe("buildDiffCommand", () => {
  test("builds correct git diff command", () => {
    const cmd = buildDiffCommand("main");
    expect(cmd).toEqual(["git", "diff", "main...HEAD"]);
  });
});

describe("collectDiff error handling", () => {
  test("invalid base branch returns error, not empty", () => {
    // collectDiff with a non-existent branch should produce an error field
    const { collectDiff } = require("../diff-collector");
    const result = collectDiff("nonexistent-branch-xyz-9999");
    expect(result.empty).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe("collectFiles", () => {
  test("invalid base branch returns error", () => {
    const result = collectFiles("nonexistent-branch-xyz-9999", "/tmp/test-review-dir");
    expect(result.error).toBeTruthy();
    expect(result.files).toEqual([]);
  });

  test("result has correct shape", () => {
    const result = collectFiles("nonexistent-branch-xyz-9999", "/tmp/test-review-dir");
    expect(result).toHaveProperty("files");
    expect(result).toHaveProperty("reviewDir");
    expect(result).toHaveProperty("fileCount");
    expect(result.reviewDir).toBe("/tmp/test-review-dir");
  });
});
