import { tool } from "ai"
import { z } from "zod"
import { internal } from "../../_generated/api"
import {
    type SupermemoryMemorySearchResponse,
    type SupermemoryProfileResponse,
    supermemoryRequest
} from "../supermemory_api"
import type { ToolAdapter } from "../toolkit"

const memoryMetadataSchema = z
    .object({
        title: z.string().nullable().optional().describe("A concise title for this memory."),
        category: z.string().nullable().optional().describe("An optional organisational category."),
        tags: z
            .array(z.string())
            .nullable()
            .optional()
            .describe("Optional tags that make this memory easier to find.")
    })
    .nullable()
    .optional()

export const supermemoryInputSchemas = {
    get_memory_profile: z.object({}),
    add_memory: z.object({
        content: z.string().min(1).describe("The exact concise memory to store."),
        metadata: memoryMetadataSchema
    }),
    update_memory: z.object({
        memoryId: z.string().min(1).describe("The exact id returned by search_memories."),
        currentContent: z.string().min(1).describe("The existing memory being replaced."),
        newContent: z.string().min(1).describe("The corrected replacement memory."),
        metadata: memoryMetadataSchema
    }),
    forget_memory: z.object({
        memoryId: z.string().min(1).describe("The exact id returned by search_memories."),
        content: z.string().min(1).describe("The existing memory that will be forgotten."),
        reason: z.string().nullable().optional().describe("Why this memory should be forgotten.")
    }),
    search_memories: z.object({
        query: z.string().min(1).describe("A focused semantic query for the missing context."),
        limit: z
            .number()
            .int()
            .min(1)
            .max(10)
            .default(5)
            .describe("Maximum number of memories to return.")
    })
} as const

const normalizeMetadata = (
    metadata:
        | {
              title?: string | null
              category?: string | null
              tags?: string[] | null
          }
        | null
        | undefined
) => ({
    ...(metadata?.title?.trim() ? { title: metadata.title.trim() } : {}),
    ...(metadata?.category?.trim() ? { category: metadata.category.trim() } : {}),
    ...(metadata?.tags?.length
        ? { tags: metadata.tags.map((tag) => tag.trim()).filter(Boolean) }
        : {})
})

export const SupermemoryAdapter: ToolAdapter = async ({ ctx, enabledTools, userSettings }) => {
    if (!enabledTools.includes("supermemory")) return {}

    const getApiKey = () =>
        ctx.runQuery(internal.settings.getSupermemoryKey, {
            userId: userSettings.userId
        })

    // One adapter is constructed per turn. This prevents a model from creating duplicate
    // confirmation cards for the same mutation while still allowing distinct changes.
    const preparedChangeKeys = new Set<string>()
    const prepareChange = (change: Record<string, unknown>) => {
        const cardKey = JSON.stringify(change)
        if (preparedChangeKeys.has(cardKey)) {
            return {
                success: false,
                code: "duplicate_memory_change",
                error: "An identical memory change is already awaiting confirmation this turn."
            }
        }
        preparedChangeKeys.add(cardKey)

        return {
            success: true,
            kind: "prepared_memory_change" as const,
            status: "pending_confirmation" as const,
            cardId: crypto.randomUUID(),
            ...change
        }
    }

    return {
        get_memory_profile: tool({
            description: [
                "Retrieve the user's broad memory profile: stable facts and recent context.",
                'Use this for broad questions such as "What do you know or remember about me?"',
                "Do not use a broad search_memories query as a substitute for this profile."
            ].join("\n"),
            inputSchema: supermemoryInputSchemas.get_memory_profile,
            execute: async () => {
                try {
                    const apiKey = await getApiKey()
                    if (!apiKey) {
                        return {
                            success: false,
                            error: "Supermemory is not configured. Please add your API key in settings."
                        }
                    }

                    const response = await supermemoryRequest<SupermemoryProfileResponse>(
                        apiKey,
                        "/v4/profile",
                        {
                            body: { containerTag: userSettings.userId }
                        }
                    )
                    const stableFacts = response.profile.static ?? []
                    const recentContext = response.profile.dynamic ?? []

                    return {
                        success: true,
                        profile: { stableFacts, recentContext },
                        message:
                            stableFacts.length + recentContext.length === 0
                                ? "The memory profile is currently empty."
                                : "Retrieved the user's memory profile."
                    }
                } catch (error) {
                    console.error("Error retrieving memory profile:", error)
                    return {
                        success: false,
                        error: `Failed to retrieve memory profile: ${error instanceof Error ? error.message : "Unknown error"}`
                    }
                }
            }
        }),

        add_memory: tool({
            description: [
                "Prepare a durable memory for the user to review and confirm.",
                "This does not save anything immediately. A successful result is a pending confirmation card.",
                "Use concise, factual, self-contained content that remains useful without the current conversation."
            ].join("\n"),
            inputSchema: supermemoryInputSchemas.add_memory,
            execute: async ({ content, metadata }) =>
                prepareChange({
                    operation: "add",
                    content: content.trim(),
                    metadata: normalizeMetadata(metadata)
                })
        }),

        update_memory: tool({
            description: [
                "Prepare a correction or replacement for an existing memory.",
                "Search first to obtain the exact memory id and current content.",
                "This does not update anything immediately. A successful result is a pending confirmation card."
            ].join("\n"),
            inputSchema: supermemoryInputSchemas.update_memory,
            execute: async ({ memoryId, currentContent, newContent, metadata }) =>
                prepareChange({
                    operation: "update",
                    memoryId,
                    currentContent: currentContent.trim(),
                    newContent: newContent.trim(),
                    metadata: normalizeMetadata(metadata)
                })
        }),

        forget_memory: tool({
            description: [
                "Prepare removal of an existing memory for the user to review and confirm.",
                "Search first to obtain the exact memory id and content.",
                "This does not forget anything immediately. A successful result is a pending confirmation card."
            ].join("\n"),
            inputSchema: supermemoryInputSchemas.forget_memory,
            execute: async ({ memoryId, content, reason }) =>
                prepareChange({
                    operation: "forget",
                    memoryId,
                    content: content.trim(),
                    ...(reason?.trim() ? { reason: reason.trim() } : {})
                })
        }),

        search_memories: tool({
            description:
                "Search the user's stored memories for relevant cross-conversation context.",
            inputSchema: supermemoryInputSchemas.search_memories,
            execute: async ({ query, limit = 5 }) => {
                try {
                    const apiKey = await getApiKey()

                    if (!apiKey) {
                        return {
                            success: false,
                            error: "Supermemory is not configured. Please add your API key in settings."
                        }
                    }

                    const response = await supermemoryRequest<SupermemoryMemorySearchResponse>(
                        apiKey,
                        "/v4/search",
                        {
                            body: {
                                q: query,
                                limit,
                                threshold: 0.5,
                                containerTag: userSettings.userId,
                                searchMode: "memories"
                            }
                        }
                    )

                    const memories = response.results
                        .filter((result) => Boolean(result.memory))
                        .map((result) => ({
                            content: result.memory,
                            score: result.similarity,
                            metadata: result.metadata,
                            memoryId: result.id,
                            updatedAt: result.updatedAt
                        }))

                    return {
                        success: true,
                        results: memories,
                        message:
                            memories.length === 0
                                ? "No memories found matching this search."
                                : `Found ${memories.length} relevant ${memories.length === 1 ? "memory" : "memories"}.`
                    }
                } catch (error) {
                    console.error("Error searching memories:", error)
                    return {
                        success: false,
                        error: `Failed to search memories: ${error instanceof Error ? error.message : "Unknown error"}`
                    }
                }
            }
        })
    }
}
