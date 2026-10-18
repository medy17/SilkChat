// The model titles each workspace request. Cards from before titles existed, and any request
// that arrives without one, fall back to the runtime.
export const getPersistentSandboxTitle = (title: unknown, runtime: unknown) => {
    if (typeof title === "string" && title.trim()) return title.trim()
    if (runtime === "python") return "Python workspace"
    if (runtime === "node") return "Node.js workspace"
    return "Workspace"
}
