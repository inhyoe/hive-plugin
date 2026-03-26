import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { sendKeys, clearHistory, pasteFile } from './tmux.js';
import { REGISTRY_DIR, responseFilePath } from './types.js';
import type { Purpose } from './types.js';

const SAFE_NAME = /^[A-Za-z0-9_-]+$/;

function validateName(name: string): void {
  if (!SAFE_NAME.test(name)) {
    throw new Error(`Invalid name: ${name}`);
  }
}

function savePromptFile(name: string, content: string): string {
  validateName(name);
  const filePath = join(REGISTRY_DIR, `${name}-prompt.txt`);
  writeFileSync(filePath, content, { mode: 0o600 });
  return filePath;
}

function buildPromptFileContent(
  purpose: Purpose,
  prompt: string,
  name: string,
  meta?: Record<string, string>,
): string {
  const base = meta?.['base'] ?? 'main';
  const responsePath = responseFilePath(name);
  const completionInstruction = `\n\n## Completion\n작업 완료 후 최종 응답 전문을 ${responsePath} 에 저장하세요.\necho 또는 파일 쓰기 도구로 응답 내용을 해당 경로에 기록하세요.`;

  switch (purpose) {
    case 'review':
      return `<role>
You are a code reviewer specializing in finding HIGH SIGNAL issues only.
</role>

<decision_framework>
- Bias toward approval: working code beats theoretical perfection
- Report ONLY issues that will cause runtime failure, data loss, or security breach
- NOT blockers: style preferences, "could be cleaner", potential edge cases
- Maximum 5 issues per review
</decision_framework>

<tool_usage_rules>
- git diff ${base}...HEAD 로 변경사항을 직접 확인하세요
- 변경된 파일은 cat/Read로 직접 읽으세요
- Serena MCP로 심볼/의존성을 분석하세요
- 추론하지 말고 코드를 직접 확인하세요
</tool_usage_rules>

<scope_discipline>
- 요청된 diff 범위만 리뷰
- 코드 스타일, linter가 잡을 것, 주관적 개선 제안은 제외
- 기존 코드의 다른 문제는 보고하지 마세요
</scope_discipline>

<output_verbosity_spec>
이슈가 있으면:
### Issues
1. **[파일:라인]** 설명 (2문장 이내)

이슈가 없으면 정확히:
NO ISSUES FOUND
</output_verbosity_spec>

<high_risk_self_check>
최종 답변 전:
- 보고한 이슈가 실제 코드에 근거하는지 재확인
- 파일:라인 번호가 실제 코드와 일치하는지 확인
- 근거 없는 단정적 표현 제거
</high_risk_self_check>

${prompt}
${completionInstruction}`;

    case 'verify':
      return `<role>
You are verifying that previously reported issues have been correctly fixed.
</role>

<tool_usage_rules>
- git diff HEAD~1..HEAD 로 수정사항을 직접 확인하세요
- 수정된 파일을 직접 읽어 수정이 올바른지 검증하세요
- Serena MCP로 변경된 심볼의 참조를 확인하세요
</tool_usage_rules>

<scope_discipline>
- 이전 지적사항이 수정되었는지만 확인
- 수정으로 인한 새로운 이슈도 확인
- 이전에 보고하지 않은 기존 이슈는 보고하지 마세요
</scope_discipline>

<output_verbosity_spec>
이슈가 있으면:
### Issues
1. **[파일:라인]** 설명

이슈가 없으면 정확히:
NO ISSUES FOUND
</output_verbosity_spec>

${prompt}
${completionInstruction}`;

    case 'implement':
      return `<role>
You are a focused implementation specialist. Complete the task fully without asking for permission.
</role>

<scope_discipline>
- CONSENSUS 범위만 구현 (추가 기능 금지)
- 기존 코드 스타일 준수
</scope_discipline>

<do_not_ask>
KEEP GOING. SOLVE PROBLEMS. ASK ONLY WHEN TRULY IMPOSSIBLE.
- "Should I proceed?" 금지
- "Do you want me to run tests?" 금지
- 구현 중 발견한 문제는 스스로 해결
- 3회 실패 후에만 중단 보고
</do_not_ask>

<verification>
구현 완료 후 반드시:
- 수정된 모든 파일에 대해 빌드/정적 분석 실행
- 관련 테스트 실행
- 결과 보고 (변경 파일 목록 + diff + 검증 결과)
</verification>

${prompt}
${completionInstruction}`;

    case 'consensus':
      // hive-spawn-templates already provides full structured prompt with AGENT_CAPABILITY_DIRECTIVE
      return `${prompt}
${completionInstruction}`;

    case 'general':
    default:
      return `<role>
You are an AI assistant completing the requested task.
</role>

<tool_usage_rules>
- 사용 가능한 모든 도구와 스킬을 활용하세요
- git, cat, Read 등으로 코드를 직접 확인하세요
- Serena MCP로 심볼/의존성을 분석하세요
- 추론하지 말고 코드를 직접 확인하세요
</tool_usage_rules>

${prompt}
${completionInstruction}`;
  }
}

export function sendInitial(
  paneId: string,
  prompt: string,
  _marker: string,
  provider: string,
  name: string,
  purpose: Purpose = 'general',
  meta?: Record<string, string>,
): void {
  // Delete previous response file
  try { unlinkSync(responseFilePath(name)); } catch { /* ok */ }

  const content = buildPromptFileContent(purpose, prompt, name, meta);
  const filePath = savePromptFile(name, content);

  pasteFile(paneId, filePath);
}

export function sendFollowup(
  paneId: string,
  prompt: string,
  _marker: string,
  name: string,
  purpose: Purpose = 'general',
  meta?: Record<string, string>,
): void {
  clearHistory(paneId);

  // Delete previous response file
  try { unlinkSync(responseFilePath(name)); } catch { /* ok */ }

  const content = buildPromptFileContent(purpose, prompt, name, meta);
  const filePath = savePromptFile(name, content);

  pasteFile(paneId, filePath);
}
