// Whitelist: only create-marker.sh standalone calls are allowed to touch .marker files
const MARKER_FILE_RE = /\.marker\b/i;
const CREATE_MARKER_RE = /(?:bash\s+)?(?:\.\/)?scripts\/create-marker\.sh/;
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
    return /\bgit\s+commit\b/.test(command);
}
export function isHiveStateWrite(command) {
    if (!/\.hive-state/.test(command))
        return false;
    // Write indicators: redirects, destructive/write commands, interpreters
    return /[>]|\btee\b|\b(cp|mv|rm|touch|chmod|chown|dd|ln|install|sed|perl|python|python3|ruby|node)\s/.test(command);
}
export function hasShellChaining(command) {
    // Matches: &&, ||, ;, |, & (background), newlines, backticks, $()
    return /&&|\|\||[;|&`\n]|\$\(/.test(command);
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