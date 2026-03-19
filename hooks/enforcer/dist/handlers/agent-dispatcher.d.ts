export interface AgentInput {
    prompt: string;
    subagentType: string;
    description: string;
}
export interface HandlerResult {
    exitCode: number;
    message?: string;
}
export declare function handleAgentDispatcher(input: AgentInput, stateDir: string): HandlerResult;
