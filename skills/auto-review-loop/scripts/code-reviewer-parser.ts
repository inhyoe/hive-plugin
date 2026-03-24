import type { CodeReviewerIssue, CodeReviewerResult } from "./lib/types";

type Severity = CodeReviewerIssue["severity"];

const SECTION_HEADER = /^###\s+(CRITICAL|IMPORTANT|SUGGESTION)/i;

// **C1. [file:line] description**  or  **I2. [file:line] description**
const BOLD_DOT_PATTERN =
  /^\*\*([CI]\d+)\.\s*\[([^:\]]+):(\d+)\]\s*(.*?)\*\*$/;

// **C1: [file:line] description**  (colon variant)
const BOLD_COLON_FILE_PATTERN =
  /^\*\*([CI]\d+):\s*\[([^:\]]+):(\d+)\]\s*(.*?)\*\*$/;

// **C1: description without file reference**
const BOLD_COLON_NOFILE_PATTERN =
  /^\*\*([CI]\d+)[.:]\s*(?!\[)(.+?)\*\*$/;

// Codex-style: 1. **[file:line]** description
const CODEX_STYLE_PATTERN =
  /^\d+\.\s*\*\*\[([^:\]]+):(\d+)\]\*\*\s*(.+)/;

function tryParseIssue(
  line: string,
  sectionSeverity: Severity,
): CodeReviewerIssue | null {
  let m: RegExpMatchArray | null;

  // **C1. [file:line] desc**
  m = line.match(BOLD_DOT_PATTERN);
  if (m) {
    return {
      id: m[1],
      file: m[2],
      line: parseInt(m[3], 10),
      description: m[4].trim() || m[0],
      severity: sectionSeverity,
    };
  }

  // **C1: [file:line] desc**
  m = line.match(BOLD_COLON_FILE_PATTERN);
  if (m) {
    return {
      id: m[1],
      file: m[2],
      line: parseInt(m[3], 10),
      description: m[4].trim() || m[0],
      severity: sectionSeverity,
    };
  }

  // **C1: description without file**
  m = line.match(BOLD_COLON_NOFILE_PATTERN);
  if (m) {
    return {
      id: m[1],
      description: m[2].trim(),
      severity: sectionSeverity,
    };
  }

  // Codex-style: 1. **[file:line]** description
  m = line.match(CODEX_STYLE_PATTERN);
  if (m) {
    const idPrefix = sectionSeverity === "critical" ? "C" : "I";
    return {
      id: `${idPrefix}?`,
      file: m[1],
      line: parseInt(m[2], 10),
      description: m[3].trim(),
      severity: sectionSeverity,
    };
  }

  return null;
}

export function parseCodeReviewerOutput(input: string): CodeReviewerResult {
  const raw = input;
  const lines = input.split("\n");
  const issues: CodeReviewerIssue[] = [];

  let currentSection: Severity | "suggestion" | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers
    const headerMatch = trimmed.match(SECTION_HEADER);
    if (headerMatch) {
      const section = headerMatch[1].toUpperCase();
      if (section === "CRITICAL") currentSection = "critical";
      else if (section === "IMPORTANT") currentSection = "important";
      else currentSection = "suggestion";
      continue;
    }

    // Skip suggestion sections entirely
    if (currentSection === "suggestion") continue;

    // Only parse issue lines inside critical/important sections
    if (currentSection === "critical" || currentSection === "important") {
      if (!trimmed) continue;
      const issue = tryParseIssue(trimmed, currentSection);
      if (issue) issues.push(issue);
    }
  }

  // Issues found — always report, regardless of any sentinel text
  if (issues.length > 0) {
    return { hasIssues: true, issues, raw };
  }

  // Check for "NO ISSUES FOUND" sentinel anywhere in the text
  if (/NO ISSUES FOUND/i.test(input)) {
    return { hasIssues: false, issues: [], raw };
  }

  // Check for PASS verdict (without FAIL)
  if (/\bPASS\b/i.test(input) && !/\bFAIL\b/i.test(input)) {
    return { hasIssues: false, issues: [], raw };
  }

  // No sentinel and no parsed issues — malformed response
  return {
    hasIssues: true,
    issues: [
      {
        id: "X0",
        description:
          "Malformed code-reviewer response — could not parse issues or sentinels",
        severity: "critical",
      },
    ],
    raw,
  };
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

  const result = parseCodeReviewerOutput(input);
  console.log(JSON.stringify(result, null, 2));
}
