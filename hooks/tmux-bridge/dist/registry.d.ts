import type { Registry, RegistryEntry } from './types.js';
export declare function load(): Registry;
export declare function save(registry: Registry): void;
export declare function register(name: string, entry: RegistryEntry): void;
export declare function unregister(name: string): void;
export declare function get(name: string): RegistryEntry | null;
export declare function list(): Registry;
export declare function reconcile(): Registry;
