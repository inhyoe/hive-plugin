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

  if (!type || !diffPath) {
    console.error("Usage: --type review|verify --diff <file> [--issues <json-file>]");
    process.exit(1);
  }

  const diff = await Bun.file(diffPath).text();

  if (type === "review") {
    console.log(buildReviewPrompt(diff));
  } else if (type === "verify") {
    const issuesPath = issuesIdx !== -1 ? args[issuesIdx + 1] : null;
    const issues = issuesPath
      ? extractIssues(JSON.parse(await Bun.file(issuesPath).text()))
      : [];
    console.log(buildVerifyPrompt(issues, diff));
  } else {
    console.error("Unknown type: " + type);
    process.exit(1);
  }
}
