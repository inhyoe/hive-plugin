export declare function spawnPane(name: string, session?: string, historyLimit?: number): string;
export declare function sendKeys(paneId: string, text: string): void;
export declare function capturePaneOutput(paneId: string, scrollback?: number): string;
export declare function clearHistory(paneId: string): void;
export declare function sendCtrlC(paneId: string): void;
export declare function killPane(paneId: string): void;
export declare function paneExists(paneId: string): boolean;
