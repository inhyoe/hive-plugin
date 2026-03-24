import type { ReviewIssue } from "./lib/types";

export function buildReviewPrompt(diff: string): string {
  return `[REVIEW REQUEST]

<role>
You are a code reviewer specializing in finding HIGH SIGNAL issues only.
Approach each review by first understanding the full change scope, then
reasoning through the implications before reporting issues.
</role>

<decision_framework>
- Bias toward approval: working code beats theoretical perfection
- Report ONLY issues that will cause runtime failure, data loss, or security breach
- NOT blockers: style preferences, "could be cleaner", potential edge cases
- Maximum 5 issues per review
- When in doubt, APPROVE — a review that's 80% clear is good enough
</decision_framework>

<tool_usage_rules>
- diff가 인라인으로 제공되지만, 변경된 파일을 직접 Read/cat으로 읽어 전체 맥락을 확인하세요
- Serena MCP로 변경된 심볼의 참조/의존성을 분석하세요
- import/export 체인을 추적하여 영향 범위를 파악하세요
- 추론하지 말고 코드를 직접 확인하세요
</tool_usage_rules>

<scope_discipline>
보고하지 마세요:
- 코드 스타일, 품질 우려
- 특정 입력에만 발생하는 잠재적 이슈
- 주관적 개선 제안
- linter가 잡을 수 있는 것
- diff 범위 밖의 기존 코드 문제
</scope_discipline>

<output_verbosity_spec>
이슈가 있으면:
### Issues
1. **[파일:라인]** 설명 (2문장 이내. 왜 런타임/보안 문제인지 근거 포함)
2. ...

이슈가 없으면 정확히:
NO ISSUES FOUND
</output_verbosity_spec>

<high_risk_self_check>
최종 답변 전 반드시:
- 보고한 이슈가 실제 코드에 근거하는지 재확인
- 파일:라인 번호가 실제 코드와 일치하는지 확인
- "항상", "절대" 같은 단정적 표현이 정당화되는지 확인
- 이슈가 정말 런타임 실패/보안 위협을 일으키는지 재검증
</high_risk_self_check>

--- DIFF START ---
${diff}
--- DIFF END ---`;
}

export function buildVerifyPrompt(
  issues: ReviewIssue[],
  fixDiff: string
): string {
  const issueList =
    issues.length > 0
      ? issues
          .map(
            (i, idx) => `${idx + 1}. **[${i.file}:${i.line}]** ${i.description}`
          )
          .join("\n")
      : "(없음)";

  return `[VERIFY REQUEST]

<role>
You are verifying that previously reported issues have been correctly fixed.
Focus on whether each fix addresses the root cause, not just the symptom.
</role>

<tool_usage_rules>
- 수정된 파일을 직접 Read/cat으로 읽어 수정이 올바른지 검증하세요
- 수정이 새로운 문제를 도입하지 않았는지 주변 코드도 확인하세요
- Serena MCP로 변경된 심볼의 참조를 확인하세요
</tool_usage_rules>

<scope_discipline>
- 이전 지적사항이 수정되었는지만 확인
- 수정으로 인한 새로운 HIGH SIGNAL 이슈도 확인
- 이전에 보고하지 않은 기존 이슈는 보고하지 마세요
- 수정 방식이 "다를 뿐"인 경우는 이슈가 아닙니다
</scope_discipline>

<output_verbosity_spec>
이슈가 있으면:
### Issues
1. **[파일:라인]** 설명 (미수정/새 이슈 구분)

이슈가 없으면 정확히:
NO ISSUES FOUND
</output_verbosity_spec>

<high_risk_self_check>
- 수정 전후를 비교하여 실제로 문제가 해결되었는지 확인
- 파일:라인 번호가 수정 후 코드와 일치하는지 확인
</high_risk_self_check>

이전 지적사항:
${issueList}

수정 diff:
--- FIX DIFF START ---
${fixDiff}
--- FIX DIFF END ---`;
}

export function buildFileReviewPrompt(files: string[]): string {
  const fileList = files.map((f, i) => `${i + 1}. ${f}`).join("\n");

  return `[REVIEW REQUEST]

<role>
You are a code reviewer. Review the listed files by reading them directly.
</role>

<decision_framework>
- Bias toward approval: working code beats theoretical perfection
- Report ONLY: 컴파일/파싱 실패, 확실한 로직 오류, 보안 취약점
- Maximum 5 issues
</decision_framework>

<tool_usage_rules>
- 각 파일을 Read 도구로 직접 읽어 검토하세요
- Serena MCP로 심볼/의존성을 분석하세요
- 파일 간 import/export 관계를 확인하세요
- 추론하지 말고 코드를 직접 확인하세요
</tool_usage_rules>

<scope_discipline>
- 코드 스타일, 품질 우려, 주관적 개선 제안은 제외
- linter가 잡을 수 있는 것은 제외
</scope_discipline>

<output_verbosity_spec>
### Issues
1. **[파일:라인]** 설명 (2문장 이내)

또는:
NO ISSUES FOUND
</output_verbosity_spec>

<high_risk_self_check>
- 파일:라인 번호가 실제 코드와 일치하는지 확인
- 근거 없는 단정 제거
</high_risk_self_check>

변경 파일 목록:
${fileList}`;
}

export function buildClaudeTeamPrompt(files: string[], reviewDir: string): string {
  const fileList = files.map((f) => `- ${reviewDir}/${f}`).join("\n");

  return `<role>
당신은 독립 코드 리뷰어입니다. Phase 5에서 구현된 코드를 리뷰합니다.
</role>

<decision_framework>
- Bias toward approval: 80% clear is good enough
- Report ONLY: 컴파일/파싱 실패, 확실한 로직 오류, 보안 취약점
- Maximum 5 issues
</decision_framework>

<tool_usage_rules>
- 각 파일을 Read 도구로 직접 읽으세요
- Serena MCP로 심볼/의존성을 분석하세요
- 추론하지 말고 코드를 직접 확인하세요
</tool_usage_rules>

<scope_discipline>
- 코드 스타일, 품질 우려, 주관적 개선 제안은 제외
</scope_discipline>

<output_verbosity_spec>
### Issues
1. **[파일:라인]** 설명

또는:
NO ISSUES FOUND
</output_verbosity_spec>

<high_risk_self_check>
- 파일:라인이 실제와 일치하는지 확인
</high_risk_self_check>

리뷰할 파일:
${fileList}`;
}

export function buildCodeReviewerPrompt(files: string[], baseBranch: string): string {
  const fileList = files.map((f, i) => `${i + 1}. ${f}`).join("\n");

  return `Review this implementation against the project's plan and coding standards.

Files to review (read each one directly):
${fileList}

Base branch: ${baseBranch}

Review for:
1. Code correctness and alignment with plan
2. Security concerns
3. Error handling adequacy
4. Thread-safety issues
5. Test coverage

Categorize findings as:

### CRITICAL (must fix — runtime failures, security, data loss)
**C1. [file:line] description**

### IMPORTANT (should fix — correctness, design issues)
**I1. [file:line] description**

### SUGGESTIONS (nice to have — skip if none)
**S1. description**

If no issues found, respond exactly: NO ISSUES FOUND`;
}

export function buildCodeReviewerVerifyPrompt(
  issues: Array<{file?: string; line?: number; description: string}>,
  fixDiff: string
): string {
  const issueList = issues
    .map((i, idx) => `${idx + 1}. ${i.file ? `[${i.file}:${i.line || 0}]` : ""} ${i.description}`)
    .join("\n");

  return `Verify that previously reported issues have been correctly fixed.

Previous issues:
${issueList}

Fix diff:
--- FIX DIFF START ---
${fixDiff}
--- FIX DIFF END ---

Check:
1. Each issue is properly addressed
2. Fixes don't introduce new problems
3. Read the actual files to verify

### CRITICAL / ### IMPORTANT / ### SUGGESTIONS format, or: NO ISSUES FOUND`;
}

// Unwrap ParsedReview wrapper or accept ReviewIssue[] directly
function extractIssues(raw: unknown): ReviewIssue[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && "issues" in raw && Array.isArray((raw as any).issues)) {
    return (raw as any).issues;
  }
  return [];
}

// CLI
if (import.meta.main) {
  const args = process.argv.slice(2);
  const typeIdx = args.indexOf("--type");
  const diffIdx = args.indexOf("--diff");
  const issuesIdx = args.indexOf("--issues");

  const type = typeIdx !== -1 ? args[typeIdx + 1] : null;
  const diffPath = diffIdx !== -1 ? args[diffIdx + 1] : null;

  const filesIdx = args.indexOf("--files");
  const reviewDirIdx = args.indexOf("--review-dir");

  if (!type) {
    console.error("Usage: --type review|verify|file-review --diff <file> [--issues <json-file>] [--files <json-file>] [--review-dir <dir>]");
    process.exit(1);
  }

  if (type === "review") {
    if (!diffPath) { console.error("--diff required"); process.exit(1); }
    const diff = await Bun.file(diffPath).text();
    console.log(buildReviewPrompt(diff));
  } else if (type === "verify") {
    if (!diffPath) { console.error("--diff required"); process.exit(1); }
    const diff = await Bun.file(diffPath).text();
    const issuesPath = issuesIdx !== -1 ? args[issuesIdx + 1] : null;
    let issues: ReviewIssue[] = [];
    if (issuesPath) {
      try {
        issues = extractIssues(JSON.parse(await Bun.file(issuesPath).text()));
      } catch (e) {
        console.error(`Failed to parse issues file '${issuesPath}': ${e instanceof Error ? e.message : e}`);
        process.exit(1);
      }
    }
    console.log(buildVerifyPrompt(issues, diff));
  } else if (type === "file-review") {
    const filesPath = filesIdx !== -1 ? args[filesIdx + 1] : null;
    const reviewDir = reviewDirIdx !== -1 ? args[reviewDirIdx + 1] : ".hive-state/review";
    if (!filesPath) { console.error("--files required for file-review"); process.exit(1); }
    let filesData: unknown;
    try {
      filesData = JSON.parse(await Bun.file(filesPath).text());
    } catch (e) {
      console.error(`Failed to parse files JSON '${filesPath}': ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }
    const files: string[] = Array.isArray(filesData)
      ? filesData
      : (filesData && typeof filesData === "object" && "files" in filesData && Array.isArray((filesData as any).files))
        ? (filesData as any).files
        : [];
    console.log(buildClaudeTeamPrompt(files, reviewDir));
  } else if (type === "code-reviewer") {
    const filesPath = filesIdx !== -1 ? args[filesIdx + 1] : null;
    const baseIdx2 = args.indexOf("--base");
    const base = baseIdx2 !== -1 ? args[baseIdx2 + 1] : "main";
    if (!filesPath) { console.error("--files required for code-reviewer"); process.exit(1); }
    const filesData = JSON.parse(await Bun.file(filesPath).text());
    const files: string[] = Array.isArray(filesData) ? filesData : (filesData as any).files || [];
    console.log(buildCodeReviewerPrompt(files, base));
  } else if (type === "code-reviewer-verify") {
    if (!diffPath) { console.error("--diff required"); process.exit(1); }
    const diff = await Bun.file(diffPath).text();
    const issuesPath = issuesIdx !== -1 ? args[issuesIdx + 1] : null;
    let issues: Array<{file?: string; line?: number; description: string}> = [];
    if (issuesPath) {
      issues = JSON.parse(await Bun.file(issuesPath).text());
    }
    console.log(buildCodeReviewerVerifyPrompt(issues, diff));
  } else {
    console.error("Unknown type: " + type);
    process.exit(1);
  }
}
