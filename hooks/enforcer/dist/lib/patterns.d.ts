export declare function isDirectMarkerCreation(command: string): boolean;
export declare function isCreateMarkerCall(command: string): boolean;
export declare function extractCreateMarkerGate(command: string): string | null;
export declare function isGitCommit(command: string): boolean;
export declare function extractCommandFromStdin(stdin: string): string | null;
export declare function extractPromptFromStdin(stdin: string): string | null;
export interface AgentInfo {
    prompt: string;
    subagentType: string;
    description: string;
}
export declare function extractAgentInfoFromStdin(stdin: string): AgentInfo | null;
