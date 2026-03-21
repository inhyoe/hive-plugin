import type { ReviewIssue } from "./lib/types";

export function buildReviewPrompt(diff: string): string {
  return `[REVIEW REQUEST]
아래 코드 변경사항을 리뷰해주세요.

HIGH SIGNAL 이슈만 보고하세요:
- 컴파일/파싱 실패 (구문 오류, 타입 오류, missing imports)
- 확실한 로직 오류 (입력과 무관하게 잘못된 결과)
- 보안 취약점
- CLAUDE.md 규칙 위반 (정확한 규칙 인용)

보고하지 마세요:
- 코드 스타일, 품질 우려
- 특정 입력에만 발생하는 잠재적 이슈
- 주관적 개선 제안
- linter가 잡을 수 있는 것

출력 형식:
이슈가 있으면:
### Issues
1. **[파일:라인]** 설명
2. ...

이슈가 없으면 정확히:
NO ISSUES FOUND

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
이전 리뷰에서 지적된 이슈들이 수정되었습니다.
수정된 부분만 검증해주세요. 새로운 이슈도 확인해주세요.

이전 지적사항:
${issueList}

수정 diff:
--- FIX DIFF START ---
${fixDiff}
--- FIX DIFF END ---

출력 형식:
이슈가 있으면:
### Issues
1. **[파일:라인]** 설명
2. ...

이슈가 없으면 정확히:
NO ISSUES FOUND`;
}

export function buildFileReviewPrompt(files: string[]): string {
  const fileList = files.map((f, i) => `${i + 1}. ${f}`).join("\n");

  return `[REVIEW REQUEST]
아래 파일들을 리뷰해주세요. 각 파일을 Read 도구로 읽어 검토하세요.

HIGH SIGNAL 이슈만 보고하세요:
- 컴파일/파싱 실패 (구문 오류, 타입 오류, missing imports)
- 확실한 로직 오류 (입력과 무관하게 잘못된 결과)
- 보안 취약점

보고하지 마세요:
- 코드 스타일, 품질 우려
- 특정 입력에만 발생하는 잠재적 이슈
- 주관적 개선 제안
- linter가 잡을 수 있는 것

변경 파일 목록:
${fileList}

출력 형식:
이슈가 있으면:
### Issues
1. **[파일:라인]** 설명
2. ...

이슈가 없으면 정확히:
NO ISSUES FOUND`;
}

export function buildClaudeTeamPrompt(files: string[], reviewDir: string): string {
  const fileList = files.map((f) => `- ${reviewDir}/${f}`).join("\n");

  return `당신은 독립 코드 리뷰어입니다. Phase 5에서 구현된 코드를 리뷰합니다.

각 파일을 Read 도구로 읽고 HIGH SIGNAL 이슈만 보고하세요:
- 컴파일/파싱 실패 (구문 오류, 타입 오류, missing imports)
- 확실한 로직 오류 (입력과 무관하게 잘못된 결과)
- 보안 취약점

보고하지 마세요:
- 코드 스타일, 품질 우려
- 특정 입력에만 발생하는 잠재적 이슈
- 주관적 개선 제안

리뷰할 파일:
${fileList}

출력 형식:
이슈가 있으면:
### Issues
1. **[파일:라인]** 설명
2. ...

이슈가 없으면 정확히:
NO ISSUES FOUND`;
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
  } else {
    console.error("Unknown type: " + type);
    process.exit(1);
  }
}
