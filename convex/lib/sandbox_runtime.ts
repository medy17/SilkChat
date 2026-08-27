export const SANDBOX_RUNTIME_VALUES = ["node", "python"] as const

export const DEFAULT_SANDBOX_RUNTIME_VERSIONS = {
    node: "24",
    python: "3.14"
} as const

export type SandboxRuntime = (typeof SANDBOX_RUNTIME_VALUES)[number]
export type SandboxLanguage = "javascript" | "python"
export type SandboxRuntimeVersion = string

export const sandboxRuntimeForLanguage = (language: SandboxLanguage): SandboxRuntime =>
    language === "javascript" ? "node" : "python"

export const sandboxLanguageForRuntime = (runtime: SandboxRuntime): SandboxLanguage =>
    runtime === "node" ? "javascript" : "python"

export const parseSandboxRuntime = (runtime: unknown): SandboxRuntime | null =>
    runtime === "node" || runtime === "python" ? runtime : null

export const parseSandboxRuntimeVersion = (runtimeVersion: unknown): string | null =>
    typeof runtimeVersion === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(runtimeVersion)
        ? runtimeVersion
        : null

export const defaultSandboxRuntimeVersion = (runtime: SandboxRuntime): string =>
    DEFAULT_SANDBOX_RUNTIME_VERSIONS[runtime]

export const sandboxImageForRuntime = (
    runtime: SandboxRuntime,
    runtimeVersion: SandboxRuntimeVersion
): string => `vercel/sandbox/${runtime}:${runtimeVersion}`
