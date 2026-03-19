export interface HandlerResult {
    exitCode: number;
    message?: string;
}
export declare function handleIntentGate(prompt: string, stateDir: string): HandlerResult;
