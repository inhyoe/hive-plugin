export const PROVIDER_COMMANDS = {
    codex: 'codex -a never -s danger-full-access',
    gemini: 'gemini',
};
export const DEFAULT_POLL_INTERVAL = 2000;
export const DEFAULT_POLL_TIMEOUT = 300;
export const REGISTRY_DIR = '/tmp/hive-tmux';
export const REGISTRY_FILE = '/tmp/hive-tmux/sessions.json';
/** Response file path for a given provider name */
export function responseFilePath(name) {
    return `${REGISTRY_DIR}/${name}-response.txt`;
}
//# sourceMappingURL=types.js.map