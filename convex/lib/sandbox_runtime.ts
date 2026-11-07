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

export const defaultSandboxRuntimeVersion = (runtime: SandboxRuntime): string =>
    DEFAULT_SANDBOX_RUNTIME_VERSIONS[runtime]

export const sandboxImageForRuntime = (
    runtime: SandboxRuntime,
    runtimeVersion: SandboxRuntimeVersion
): string => `vercel/sandbox/${runtime}:${runtimeVersion}`
