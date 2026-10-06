import { convexTest } from "convex-test"
import { expect, it } from "vitest"
import schema from "../../convex/schema"
const modules = import.meta.glob("../../convex/**/*.ts")

it("preserves legacy visual metadata alongside current messages", async () => {
    const t = convexTest(schema, modules)
    const legacyMetadata = {
        visualStatus: "ready",
        visualSelections: [
            {
                key: '["gallery","giant frog",3]',
                cue: "giant frog",
                visuals: [
                    {
                        id: "legacy-image",
                        title: "Giant frog",
                        sourceUrl: "https://example.com/frog"
                    }
                ]
            }
        ]
    }
    const stored = await t.run(async (ctx) => {
        const threadId = await ctx.db.insert("threads", {
            authorId: "user",
            title: "Legacy chat",
            createdAt: 1,
            updatedAt: 1
        })
        const ids = await Promise.all(
            [legacyMetadata, {}].map((metadata, index) =>
                ctx.db.insert("messages", {
                    threadId,
                    messageId: `message-${index}`,
                    role: "assistant",
                    parts: [],
                    metadata,
                    createdAt: 1,
                    updatedAt: 1
                })
            )
        )
        return Promise.all(ids.map((id) => ctx.db.get(id)))
    })
    expect(stored.map((message) => message?.metadata)).toEqual([legacyMetadata, {}])
})
