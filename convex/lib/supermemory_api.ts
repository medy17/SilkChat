const SUPERMEMORY_API_URL = "https://api.supermemory.ai"

type SupermemoryRequestOptions = {
    method?: "GET" | "POST" | "PATCH" | "DELETE"
    body?: Record<string, unknown>
}

const getSupermemoryErrorMessage = async (response: Response) => {
    try {
        const payload = (await response.json()) as {
            error?: string | { message?: string }
            message?: string
        }
        if (typeof payload.error === "string") return payload.error
        if (payload.error && typeof payload.error.message === "string") {
            return payload.error.message
        }
        if (typeof payload.message === "string") return payload.message
    } catch {
        // Fall through to the HTTP status when the upstream body is not JSON.
    }
    return `Supermemory request failed with status ${response.status}.`
}

export const supermemoryRequest = async <T>(
    apiKey: string,
    path: string,
    { method = "POST", body }: SupermemoryRequestOptions = {}
): Promise<T> => {
    const response = await fetch(`${SUPERMEMORY_API_URL}${path}`, {
        method,
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...(body ? { "Content-Type": "application/json" } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    })

    if (!response.ok) {
        throw new Error(await getSupermemoryErrorMessage(response))
    }

    return (await response.json()) as T
}

export type SupermemoryMemorySearchResult = {
    id: string
    memory?: string
    similarity: number
    metadata: Record<string, unknown> | null
    updatedAt: string
}

export type SupermemoryMemorySearchResponse = {
    results: SupermemoryMemorySearchResult[]
    timing: number
    total: number
}

export type SupermemoryProfileResponse = {
    profile: {
        static: string[]
        dynamic: string[]
    }
}

export type SupermemoryMutationResponse = {
    id?: string
    status?: string
}
