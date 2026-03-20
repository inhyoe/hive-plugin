export interface HandlerResult {
    exitCode: number;
    message?: string;
}
export interface AgentInfo {
    prompt: string;
    subagentType: string;
    description: string;
}
export declare const TEAM_ID_RE: RegExp;
