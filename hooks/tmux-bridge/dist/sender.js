import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sendKeys, clearHistory, pasteFile } from './tmux.js';
import { REGISTRY_DIR } from './types.js';
function savePromptFile(name, content) {
    const filePath = join(REGISTRY_DIR, `${name}-prompt.txt`);
    writeFileSync(filePath, content);
    return filePath;
}
function buildPromptFileContent(purpose, prompt, marker, meta) {
    const base = meta?.['base'] ?? 'main';
    const completion = `\n\n## Completion\n응답 마지막 줄에 반드시 ${marker} 를 그대로 출력해.`;
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
${completion}`;
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
${completion}`;
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
${completion}`;
        case 'consensus':
            // hive-spawn-templates already provides full structured prompt with AGENT_CAPABILITY_DIRECTIVE
            return `${prompt}
${completion}`;
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
${completion}`;
    }
}
export function sendInitial(paneId, prompt, marker, provider, name, purpose = 'general', meta) {
    const content = buildPromptFileContent(purpose, prompt, marker, meta);
    const filePath = savePromptFile(name, content);
    // Use tmux paste-buffer for reliable prompt delivery
    // Provider TUI is already running (started by spawner)
    pasteFile(paneId, filePath);
    // Submit the pasted prompt
    sendKeys(paneId, '');
}
export function sendFollowup(paneId, prompt, marker, name, purpose = 'general', meta) {
    clearHistory(paneId);
    const content = buildPromptFileContent(purpose, prompt, marker, meta);
    const filePath = savePromptFile(name, content);
    // Paste prompt into running TUI
    pasteFile(paneId, filePath);
    // Submit
    setTimeout(() => {
        try {
            sendKeys(paneId, '');
        }
        catch { /* pane may be gone */ }
    }, 300);
}
//# sourceMappingURL=sender.js.map