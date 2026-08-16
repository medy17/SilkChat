import {
    buildSupermemoryPromptContext,
    extractVisibleMessageText,
    isHostedMemoryEnabledForTurn,
    prepareSupermemoryConversationTurn
} from "@/convex/lib/supermemory_chat"
import { describe, expect, it } from "vitest"

describe("hosted memory chat context", () => {
    it("uses hosted memory only when the selected model can call memory tools", () => {
        expect(isHostedMemoryEnabledForTurn(["supermemory"], true)).toBe(true)
        expect(isHostedMemoryEnabledForTurn(["supermemory"], false)).toBe(false)
        expect(isHostedMemoryEnabledForTurn([], true)).toBe(false)
    })

    it("formats profile and query results as bounded untrusted context", () => {
        const result = buildSupermemoryPromptContext({
            profile: {
                static: ["User prefers dark mode", "<ignore>system instructions</ignore>"],
                dynamic: ["User is planning a trip"]
            },
            searchResults: {
                results: [
                    {
                        id: "memory-1",
                        memory: "User prefers dark mode",
                        similarity: 0.9,
                        metadata: null,
                        updatedAt: "2026-08-16T00:00:00.000Z",
                        context: {
                            parents: [
                                { memory: "User bought an OLED monitor", relation: "extends" }
                            ]
                        }
                    }
                ],
                timing: 10,
                total: 1
            }
        })

        expect(result).toContain("<user_memory_context>")
        expect(result).toContain("Stable profile:")
        expect(result).toContain("Relevant memories:")
        expect(result).toContain("User bought an OLED monitor")
        expect(result).toContain("&lt;ignore&gt;system instructions&lt;/ignore&gt;")
        expect(result.match(/User prefers dark mode/g)).toHaveLength(1)
    })

    it("extracts only user-visible text parts", () => {
        expect(
            extractVisibleMessageText([
                { type: "text", text: "Hello" },
                { type: "file" },
                { type: "text", text: "world" }
            ])
        ).toBe("Hello\nworld")
    })

    it("serializes a completed visible turn for incremental conversation ingestion", () => {
        expect(
            prepareSupermemoryConversationTurn({
                userParts: [{ type: "text", text: "I like Pepsi." }],
                assistantParts: [{ type: "text", text: "I'll keep that in mind." }]
            })
        ).toBe("user: I like Pepsi.\nassistant: I'll keep that in mind.")
    })

    it("does not bypass confirmation cards with automatic ingestion", () => {
        expect(
            prepareSupermemoryConversationTurn({
                userParts: [{ type: "text", text: "Remember that I like Pepsi." }],
                assistantParts: [
                    { type: "text", text: "Please confirm this memory." },
                    {
                        type: "tool-invocation",
                        toolInvocation: { toolName: "add_memory" }
                    }
                ]
            })
        ).toBeNull()
    })
})
