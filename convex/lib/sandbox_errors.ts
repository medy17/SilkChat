const getNumericStatus = (value: unknown): number | undefined => {
    if (!value || typeof value !== "object") return undefined
    const candidate = value as {
        status?: unknown
        statusCode?: unknown
        response?: { status?: unknown }
    }
    for (const status of [candidate.status, candidate.statusCode, candidate.response?.status]) {
        if (typeof status === "number" && Number.isFinite(status)) return status
    }
    return undefined
}

export const isSandboxHttpError = (error: unknown, status: number) => {
    if (getNumericStatus(error) === status) return true
    const message = error instanceof Error ? error.message : String(error)
    return new RegExp(`(?:status(?:\\s+code)?|http)\\s*${status}\\b`, "i").test(message)
}

export const isMissingSandboxError = (error: unknown) => {
    if (isSandboxHttpError(error, 404)) return true
    const message = error instanceof Error ? error.message : String(error)
    return /(?:not[ _-]?found|sandbox[^\n]*missing)/i.test(message)
}
