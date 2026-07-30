import { describe, expect, it, vi } from "vitest"

vi.mock("../../convex/_generated/server", () => ({
    internalMutation: (config: unknown) => config,
    internalQuery: (config: unknown) => config,
    query: (config: unknown) => config
}))

import { getPreparedImageGenerationCardResult } from "../../convex/messages"

const handler = (
    getPreparedImageGenerationCardResult as unknown as {
        handler: (
            ctx: {
                auth: { getUserIdentity: () => Promise<Record<string, unknown> | null> }
                db: {
                    get: ReturnType<typeof vi.fn>
                    query: ReturnType<typeof vi.fn>
                }
            },
            args: {
                threadId: string
                messageId: string
                toolCallId: string
                cardId: string
            }
        ) => Promise<unknown>
    }
).handler

const preparedResult = {
    success: true,
    kind: "prepared_image_generation",
    status: "submitting",
    cardId: "card-1"
}

const createCtx = ({ authorId = "user-1" }: { authorId?: string } = {}) => ({
    auth: {
        getUserIdentity: vi.fn().mockResolvedValue({
            subject: "auth-user-1",
            userId: "user-1",
            isAnonymous: false
        })
    },
    db: {
        get: vi.fn().mockResolvedValue({ _id: "thread-1", authorId }),
        query: vi.fn().mockReturnValue({
            withIndex: vi.fn().mockReturnValue({
                collect: vi.fn().mockResolvedValue([
                    {
                        threadId: "thread-1",
                        messageId: "assistant-1",
                        parts: [
                            {
                                type: "tool-invocation",
                                toolInvocation: {
                                    toolName: "prepareImageGeneration",
                                    toolCallId: "tool-1",
                                    state: "result",
                                    result: preparedResult
                                }
                            }
                        ]
                    }
                ])
            })
        })
    }
})

describe("prepared image generation card query", () => {
    it("returns the persisted card result for its thread owner", async () => {
        await expect(
            handler(createCtx(), {
                threadId: "thread-1",
                messageId: "assistant-1",
                toolCallId: "tool-1",
                cardId: "card-1"
            })
        ).resolves.toEqual(preparedResult)
    })

    it("does not expose a card from another user's thread", async () => {
        const ctx = createCtx({ authorId: "user-2" })

        await expect(
            handler(ctx, {
                threadId: "thread-1",
                messageId: "assistant-1",
                toolCallId: "tool-1",
                cardId: "card-1"
            })
        ).resolves.toBeNull()
        expect(ctx.db.query).not.toHaveBeenCalled()
    })
})
