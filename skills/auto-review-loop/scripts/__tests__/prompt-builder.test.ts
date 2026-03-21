import { describe, expect, test } from "bun:test";
import { buildReviewPrompt, buildVerifyPrompt } from "../prompt-builder";
import type { ReviewIssue } from "../lib/types";

describe("buildReviewPrompt", () => {
  test("contains required markers and diff", () => {
    const diff = "--- a/file.ts\n+++ b/file.ts\n+ added line";
    const prompt = buildReviewPrompt(diff);
    expect(prompt).toContain("[REVIEW REQUEST]");
    expect(prompt).toContain("--- DIFF START ---");
    expect(prompt).toContain(diff);
    expect(prompt).toContain("--- DIFF END ---");
  });

  test("contains HIGH SIGNAL directive", () => {
    const prompt = buildReviewPrompt("some diff");
    expect(prompt).toContain("HIGH SIGNAL");
  });

  test("does not substitute {variable} literals in diff", () => {
    const diff = "const x = `${variable}`;\nconst y = {value};";
    const prompt = buildReviewPrompt(diff);
    expect(prompt).toContain("${variable}");
    expect(prompt).toContain("{value}");
  });
});

describe("buildVerifyPrompt", () => {
  test("contains required markers, issues, and fix diff", () => {
    const issues: ReviewIssue[] = [
      { file: "src/main.ts", line: 42, description: "Missing null check" },
    ];
    const fixDiff = "--- a/src/main.ts\n+++ b/src/main.ts\n+ if (!x) return;";
    const prompt = buildVerifyPrompt(issues, fixDiff);
    expect(prompt).toContain("[VERIFY REQUEST]");
    expect(prompt).toContain("src/main.ts");
    expect(prompt).toContain("Missing null check");
    expect(prompt).toContain("--- FIX DIFF START ---");
    expect(prompt).toContain(fixDiff);
    expect(prompt).toContain("--- FIX DIFF END ---");
  });

  test("handles empty issues array", () => {
    const prompt = buildVerifyPrompt([], "some fix diff");
    expect(prompt).toContain("[VERIFY REQUEST]");
    expect(prompt).toContain("--- FIX DIFF START ---");
  });
});

describe("prompt-builder CLI wrapper unwrap", () => {
  test("buildVerifyPrompt renders issues from ParsedReview wrapper via CLI", async () => {
    // Simulate the wrapper object that review-parser outputs
    const wrapper = JSON.stringify({
      hasIssues: true,
      issues: [{ file: "a.ts", line: 1, description: "test bug" }],
      raw: "### Issues\n1. **[a.ts:1]** test bug",
    });
    const diff = "--- a/a.ts\n+++ b/a.ts\n+ fixed";

    await Bun.write("/tmp/test-pb-wrapper.json", wrapper);
    await Bun.write("/tmp/test-pb-diff.txt", diff);

    const proc = Bun.spawn([
      "bun", "run", "scripts/prompt-builder.ts",
      "--type", "verify",
      "--diff", "/tmp/test-pb-diff.txt",
      "--issues", "/tmp/test-pb-wrapper.json",
    ], { cwd: import.meta.dir + "/../.." });

    const output = await new Response(proc.stdout).text();
    expect(output).toContain("a.ts:1");
    expect(output).toContain("test bug");
    expect(output).not.toContain("(없음)");
  });
});
