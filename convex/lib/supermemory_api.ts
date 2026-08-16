const SUPERMEMORY_API_URL = "https://api.supermemory.ai"
const SUPERMEMORY_REQUEST_TIMEOUT_MS = 15_000
const DEFAULT_CONTAINER_PREFIX = "silkchat"

type SupermemoryRequestOptions = {
    method?: "GET" | "POST" | "PATCH" | "DELETE"
    body?: Record<string, unknown>
    timeoutMs?: number
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

export class SupermemoryApiError extends Error {
    constructor(
        message: string,
        readonly status: number
    ) {
        super(message)
        this.name = "SupermemoryApiError"
    }
}

export const getSupermemoryApiKey = () => process.env.SUPERMEMORY_API_KEY?.trim() || null

const getContainerPrefix = () => {
    const prefix = process.env.SUPERMEMORY_CONTAINER_PREFIX?.trim() || DEFAULT_CONTAINER_PREFIX
    if (!/^[a-zA-Z0-9_:-]{1,40}$/.test(prefix)) {
        throw new Error(
            "SUPERMEMORY_CONTAINER_PREFIX must be 1-40 letters, numbers, underscores, colons, or hyphens."
        )
    }
    return prefix
}

export const getSupermemoryContainerTag = async (userId: string) => {
    const prefix = getContainerPrefix()
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`${prefix}:${userId}`)
    )
    const opaqueUserId = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("")
    return `${prefix}:user:${opaqueUserId.slice(0, 48)}`
}

export const getSupermemoryConversationCustomId = async (userId: string, threadId: string) => {
    const prefix = getContainerPrefix()
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`${prefix}:conversation:${userId}:${threadId}`)
    )
    const opaqueConversationId = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("")
    return `${prefix}:chat:${opaqueConversationId.slice(0, 48)}`
}

export const supermemoryRequest = async <T>(
    apiKey: string,
    path: string,
    {
        method = "POST",
        body,
        timeoutMs = SUPERMEMORY_REQUEST_TIMEOUT_MS
    }: SupermemoryRequestOptions = {}
): Promise<T> => {
    const response = await fetch(`${SUPERMEMORY_API_URL}${path}`, {
        method,
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${apiKey}`,
            ...(body ? { "Content-Type": "application/json" } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    })

    if (!response.ok) {
        throw new SupermemoryApiError(await getSupermemoryErrorMessage(response), response.status)
    }

    return (await response.json()) as T
}

export type SupermemoryMemorySearchResult = {
    id: string
    memory?: string
    similarity: number
    metadata: Record<string, unknown> | null
    updatedAt: string
    context?: {
        parents?: SupermemoryRelatedMemory[]
        children?: SupermemoryRelatedMemory[]
    }
}

export type SupermemoryRelatedMemory = {
    id?: string
    memory?: string
    relation?: string
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
    searchResults?: SupermemoryMemorySearchResponse
}

export type SupermemoryMutationResponse = {
    id?: string
    status?: string
}

export type SupermemoryMemoryEntry = {
    id: string
    memory: string
    version: number
    isLatest: boolean
    isForgotten: boolean
    isStatic: boolean
    isInference: boolean
    createdAt: string
    updatedAt: string
    sourceCount: number
    parentMemoryId?: string | null
    rootMemoryId?: string | null
    forgetAfter?: string | null
    forgetReason?: string | null
    metadata?: Record<string, unknown> | null
}

export type SupermemoryMemoryListResponse = {
    memoryEntries: SupermemoryMemoryEntry[]
    pagination: {
        currentPage: number
        limit: number
        totalItems: number
        totalPages: number
    }
}

export const listAllSupermemoryMemories = async (userId: string) => {
    const apiKey = getSupermemoryApiKey()
    if (!apiKey) {
        throw new Error("Memory is unavailable, so the account export could not be completed.")
    }

    const containerTag = await getSupermemoryContainerTag(userId)
    const memories: SupermemoryMemoryEntry[] = []
    let page = 1

    while (page <= 500) {
        const result = await supermemoryRequest<SupermemoryMemoryListResponse>(
            apiKey,
            "/v4/memories/list",
            {
                body: {
                    containerTags: [containerTag],
                    page,
                    limit: 50,
                    order: "desc",
                    sort: "updatedAt"
                }
            }
        )
        memories.push(...result.memoryEntries.filter((memory) => !memory.isForgotten))
        if (page >= result.pagination.totalPages) break
        page += 1
    }

    return memories
}

export const deleteSupermemoryContainer = async (userId: string) => {
    const apiKey = getSupermemoryApiKey()
    if (!apiKey) {
        throw new Error("Memory is unavailable, so account deletion could not be completed.")
    }

    const containerTag = await getSupermemoryContainerTag(userId)
    try {
        await supermemoryRequest<{ success: boolean }>(
            apiKey,
            `/v3/container-tags/${encodeURIComponent(containerTag)}`,
            { method: "DELETE" }
        )
    } catch (error) {
        if (error instanceof SupermemoryApiError && error.status === 404) return
        throw error
    }
}
