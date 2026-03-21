// Whitelist: only create-marker.sh standalone calls are allowed to touch .marker files
const MARKER_FILE_RE = /\.marker\b/i;
const CREATE_MARKER_RE = /(?:bash\s+)?(?:\.\/)?scripts\/create-marker\.sh/;
// Strict version: must be the command being executed (anchored to start)
const CREATE_MARKER_EXEC_RE = /^\s*(?:bash\s+)?(?:\.\/)?scripts\/create-marker\.sh/;
export function isDirectMarkerCreation(command) {
    // If command doesn't reference .marker files at all, it's fine
    if (!MARKER_FILE_RE.test(command))
        return false;
    // Only exempt pure create-marker.sh calls (no shell metacharacters)
    if (CREATE_MARKER_RE.test(command) && !/[;&|`$(){}\n<>]/.test(command))
        return false;
    // Everything else that touches .marker is blocked
    return true;
}
export function isCreateMarkerCall(command) {
    return CREATE_MARKER_RE.test(command);
}
export function isCreateMarkerExecution(command) {
    return CREATE_MARKER_EXEC_RE.test(command);
}
export function extractCreateMarkerGate(command) {
    const match = command.match(/create-marker\.sh\s+(.*)/);
    if (!match)
        return null;
    // Tokenize and skip known flags with their values
    const tokens = match[1].trim().split(/\s+/);
    const FLAGS_WITH_VALUE = new Set(['--team-id', '--evidence-file']);
    for (let i = 0; i < tokens.length; i++) {
        if (FLAGS_WITH_VALUE.has(tokens[i])) {
            i++; // skip flag value
            continue;
        }
        if (tokens[i].startsWith('--'))
            continue; // unknown flag without value
        return tokens[i]; // first positional = gate
    }
    return null;
}
export function isGitCommit(command) {
    // Match: git commit, git -c key=val commit, git --no-pager commit, etc.
    return /\bgit\b.*\bcommit\b/.test(command);
}
export function isHiveStateWrite(command, stateDir) {
    // Check both hardcoded .hive-state and custom stateDir
    const stateDirPattern = stateDir && stateDir !== '.hive-state'
        ? new RegExp(`\\.hive-state|${stateDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
        : /\.hive-state/;
    if (!stateDirPattern.test(command))
        return false;
    // Write indicators: redirects, destructive/write commands, interpreters, mkdir
    return /[>]|\btee\b|\b(cp|mv|rm|touch|chmod|chown|dd|ln|install|sed|perl|python|python3|ruby|node|mkdir)\s/.test(command);
}
export function hasShellChaining(command) {
    // Matches: &&, ||, ;, |, & (background), newlines, backticks, $()
    return /&&|\|\||[;|&`\n]|\$\(/.test(command);
}
export function isBashSuccess(stdin) {
    try {
        const parsed = JSON.parse(stdin);
        const exitCode = parsed?.tool_result?.exit_code;
        // Treat missing exit_code as success (conservative — don't block on schema gaps)
        return exitCode === undefined || exitCode === 0;
    }
    catch {
        return false;
    }
}
export function extractCommandFromStdin(stdin) {
    try {
        const parsed = JSON.parse(stdin);
        const cmd = parsed?.tool_input?.command;
        if (typeof cmd !== 'string')
            return null;
        return cmd;
    }
    catch {
        return null;
    }
}
export function extractPromptFromStdin(stdin) {
    try {
        const parsed = JSON.parse(stdin);
        const prompt = parsed?.prompt;
        if (typeof prompt !== 'string')
            return null;
        return prompt;
    }
    catch {
        return null;
    }
}
export function extractAgentInfoFromStdin(stdin) {
    try {
        const parsed = JSON.parse(stdin);
        const input = parsed?.tool_input;
        if (typeof input?.prompt !== 'string' || typeof input?.subagent_type !== 'string')
            return null;
        const description = typeof input.description === 'string' ? input.description : '';
        return {
            prompt: input.prompt,
            subagentType: input.subagent_type,
            description,
        };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=patterns.js.map