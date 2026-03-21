import { describe, expect, test } from "bun:test";
import { parseReview } from "../review-parser";

describe("parseReview", () => {
  test("NO ISSUES FOUND → hasIssues false, empty issues", () => {
    const result = parseReview("NO ISSUES FOUND");
    expect(result.hasIssues).toBe(false);
    expect(result.issues).toEqual([]);
    expect(result.raw).toBe("NO ISSUES FOUND");
  });

  test("NO ISSUES FOUND with trailing text → malformed (not exact match)", () => {
    const result = parseReview("NO ISSUES FOUND\n\ntrailing text here");
    expect(result.hasIssues).toBe(true);
    expect(result.issues[0].file).toBe("REVIEW");
  });

  test("single issue parsed correctly", () => {
    const input = `### Issues
1. **[src/main.ts:42]** Missing null check`;
    const result = parseReview(input);
    expect(result.hasIssues).toBe(true);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toEqual({
      file: "src/main.ts",
      line: 42,
      description: "Missing null check",
    });
  });

  test("multiple issues parsed correctly", () => {
    const input = `### Issues
1. **[src/main.ts:42]** Missing null check
2. **[src/utils.ts:10]** Unused variable
3. **[src/app.ts:100]** SQL injection risk`;
    const result = parseReview(input);
    expect(result.hasIssues).toBe(true);
    expect(result.issues).toHaveLength(3);
    expect(result.issues[0].file).toBe("src/main.ts");
    expect(result.issues[1].file).toBe("src/utils.ts");
    expect(result.issues[2].description).toBe("SQL injection risk");
  });

  test("text without issues or sentinel → treated as malformed", () => {
    const input = "Everything looks good, no problems detected.";
    const result = parseReview(input);
    expect(result.hasIssues).toBe(true);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].file).toBe("REVIEW");
    expect(result.issues[0].description).toContain("Malformed");
  });

  test("directory path with nested folders", () => {
    const input = `### Issues
1. **[src/lib/utils.ts:123]** Type mismatch`;
    const result = parseReview(input);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toEqual({
      file: "src/lib/utils.ts",
      line: 123,
      description: "Type mismatch",
    });
  });

  test("description with special characters", () => {
    const input = `### Issues
1. **[src/main.ts:5]** Missing \`await\` in async function — causes race condition`;
    const result = parseReview(input);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].description).toBe(
      "Missing `await` in async function — causes race condition"
    );
  });

  test("mixed response quoting NO ISSUES FOUND but listing real issues", () => {
    const input = `The expected output should be NO ISSUES FOUND but I found problems:
### Issues
1. **[src/main.ts:10]** Null pointer dereference`;
    const result = parseReview(input);
    expect(result.hasIssues).toBe(true);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].file).toBe("src/main.ts");
  });

  test("sentinel embedded in other text → malformed (not exact match)", () => {
    const input = "Some preamble\nNO ISSUES FOUND\nSome trailing";
    const result = parseReview(input);
    expect(result.hasIssues).toBe(true);
    expect(result.issues[0].file).toBe("REVIEW");
  });

  test("NO ISSUES FOUND with whitespace padding → hasIssues false", () => {
    const result = parseReview("  NO ISSUES FOUND  \n");
    expect(result.hasIssues).toBe(false);
    expect(result.issues).toEqual([]);
  });
});
