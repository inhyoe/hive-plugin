// Regex: direct writes to .marker files (forgery attempts)
const MARKER_WRITE_RE = /(?:echo|printf)\s.*>.*\.marker/i;
const HEREDOC_MARKER_RE = /cat\s+<<.*>.*\.marker/i;
const TEE_MARKER_RE = /tee\s+.*\.marker/i;
const CREATE_MARKER_RE = /(?:bash\s+)?(?:\.\/)?scripts\/create-marker\.sh/;
export function isDirectMarkerCreation(command) {
    if (CREATE_MARKER_RE.test(command))
        return false;
    return MARKER_WRITE_RE.test(command) || HEREDOC_MARKER_RE.test(command) || TEE_MARKER_RE.test(command);
}
export function isCreateMarkerCall(command) {
    return CREATE_MARKER_RE.test(command);
}
export function extractCreateMarkerGate(command) {
    const match = command.match(/create-marker\.sh\s+(\S+)/);
    return match ? match[1] : null;
}
export function isGitCommit(command) {
    return /\bgit\s+commit\b/.test(command);
}
export function extractCommandFromStdin(stdin) {
    try {
        const parsed = JSON.parse(stdin);
        return parsed?.tool_input?.command ?? null;
    }
    catch {
        return null;
    }
}
export function extractPromptFromStdin(stdin) {
    try {
        const parsed = JSON.parse(stdin);
        return parsed?.prompt ?? null;
    }
    catch {
        return null;
    }
}
export function extractAgentInfoFromStdin(stdin) {
    try {
        const parsed = JSON.parse(stdin);
        const input = parsed?.tool_input;
        if (!input?.prompt || !input?.subagent_type)
            return null;
        return {
            prompt: input.prompt,
            subagentType: input.subagent_type,
            description: input.description ?? '',
        };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=patterns.js.map