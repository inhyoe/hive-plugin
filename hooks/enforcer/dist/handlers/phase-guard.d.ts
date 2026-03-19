export interface HandlerResult {
    exitCode: number;
    message?: string;
}
export declare function handlePhaseGuard(command: string, stateDir: string): HandlerResult;
