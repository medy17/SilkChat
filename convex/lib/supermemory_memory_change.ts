import { type SupermemoryMutationResponse, supermemoryRequest } from "./supermemory_api"

export type PreparedMemoryChange = {
    success?: boolean
    kind?: string
    operation?: "add" | "update" | "forget"
    content?: string
    memoryId?: string
    currentContent?: string
    newContent?: string
    reason?: string
    metadata?: Record<string, string | number | boolean | string[]>
}

export const applyPreparedMemoryChange = async ({
    apiKey,
    containerTag,
    change
}: {
    apiKey: string
    containerTag: string
    change: PreparedMemoryChange
}): Promise<{ operation: "add" | "update" | "forget"; memoryId?: string }> => {
    if (!change.operation) throw new Error("The memory operation is missing.")

    if (change.operation === "add") {
        if (!change.content?.trim()) throw new Error("The proposed memory is empty.")
        const response = await supermemoryRequest<SupermemoryMutationResponse>(
            apiKey,
            "/v3/documents",
            {
                body: {
                    content: change.content.trim(),
                    containerTag,
                    ...(change.metadata && Object.keys(change.metadata).length > 0
                        ? { metadata: change.metadata }
                        : {})
                }
            }
        )
        return { operation: change.operation, memoryId: response.id }
    }

    if (change.operation === "update") {
        if (!change.memoryId || !change.newContent?.trim()) {
            throw new Error("The proposed memory update is incomplete.")
        }
        const response = await supermemoryRequest<SupermemoryMutationResponse>(
            apiKey,
            "/v4/memories",
            {
                method: "PATCH",
                body: {
                    containerTag,
                    id: change.memoryId,
                    newContent: change.newContent.trim(),
                    ...(change.metadata && Object.keys(change.metadata).length > 0
                        ? { metadata: change.metadata }
                        : {})
                }
            }
        )
        return { operation: change.operation, memoryId: response.id }
    }

    if (!change.memoryId) throw new Error("The memory to forget is missing.")
    const response = await supermemoryRequest<SupermemoryMutationResponse>(apiKey, "/v4/memories", {
        method: "DELETE",
        body: {
            containerTag,
            id: change.memoryId,
            ...(change.reason?.trim() ? { reason: change.reason.trim() } : {})
        }
    })
    return { operation: change.operation, memoryId: response.id }
}
