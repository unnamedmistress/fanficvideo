declare module "vitest" {
  export const describe: <T>(name: string, fn: () => T) => void;
  export const it: <T>(name: string, fn: () => T | Promise<T>) => void;
  export const expect: any;
}

declare module "vitest/config" {
  export function defineConfig(config: unknown): unknown;
}
