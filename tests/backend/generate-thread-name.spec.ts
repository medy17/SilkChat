import { describe, expect, it } from "vitest"
import {
    fallbackTitleFromMessages,
    getTitlePromptMessages
} from "../../convex/chat_http/generate_thread_name"

describe("getTitlePromptMessages", () => {
    it("uses start and recent user or assistant excerpts with thread message numbers", () => {
        const messages = getTitlePromptMessages([
            {
                role: "system",
                content: "Do not include me"
            },
            {
                role: "user",
                content: "Help me plan a migration"
            },
            {
                role: "assistant",
                content: "Sure, what stack are you using?"
            },
            {
                role: "user",
                content: "Recent implementation details"
            },
            {
                role: "assistant",
                content: "Recent assistant response"
            },
            {
                role: "user",
                content: "Latest deployment question"
            }
        ])

        expect(messages).toEqual([
            {
                section: "start",
                messageNumber: 2,
                role: "user",
                content: "Help me plan a migration"
            },
            {
                section: "start",
                messageNumber: 3,
                role: "assistant",
                content: "Sure, what stack are you using?"
            },
            {
                section: "recent",
                messageNumber: 4,
                role: "user",
                content: "Recent implementation details"
            },
            {
                section: "recent",
                messageNumber: 5,
                role: "assistant",
                content: "Recent assistant response"
            },
            {
                section: "recent",
                messageNumber: 6,
                role: "user",
                content: "Latest deployment question"
            }
        ])
    })

    it("includes the latest excerpts when a thread has drifted beyond the opening messages", () => {
        const messages = getTitlePromptMessages([
            { role: "user", content: "Plan a React migration" },
            { role: "assistant", content: "We can start with routing" },
            { role: "user", content: "Now compare auth vendors" },
            { role: "assistant", content: "Clerk and Better Auth differ" },
            { role: "user", content: "Actually focus on billing webhooks" },
            { role: "assistant", content: "Webhook idempotency matters" },
            { role: "user", content: "Add Lemon Squeezy retries" },
            { role: "assistant", content: "Use durable retry state" }
        ])

        expect(messages.map((message) => message.messageNumber)).toEqual([1, 2, 5, 6, 7, 8])
        expect(messages.map((message) => message.section)).toEqual([
            "start",
            "start",
            "recent",
            "recent",
            "recent",
            "recent"
        ])
        expect(messages.at(-1)).toMatchObject({
            messageNumber: 8,
            role: "assistant",
            content: "Use durable retry state"
        })
    })

    it("truncates large message text from the middle before sending it to the title model", () => {
        const messages = getTitlePromptMessages([
            {
                role: "user",
                content: `start ${"middle ".repeat(400)} finish`
            }
        ])

        expect(messages).toHaveLength(1)
        expect(messages[0].content).toHaveLength(1200)
        expect(messages[0].content.startsWith("start middle")).toBe(true)
        expect(messages[0].content.endsWith("middle finish")).toBe(true)
        expect(messages[0].content).toContain(" ... [truncated] ... ")
    })

    it("collapses inlined file bodies to filenames", () => {
        const messages = getTitlePromptMessages([
            {
                role: "user",
                content: `Please summarize this\n<file name="large-report.md">\n${"very long file body ".repeat(100)}\n</file>`
            }
        ])

        expect(messages).toEqual([
            {
                section: "start",
                messageNumber: 1,
                role: "user",
                content: "Please summarize this [file: large-report.md]"
            }
        ])
    })

    it("collapses fenced code blocks to language labels", () => {
        const messages = getTitlePromptMessages([
            {
                role: "user",
                content: `Why does this fail?\n\`\`\`ts\n${"const value = 1\n".repeat(100)}\`\`\``
            }
        ])

        expect(messages).toEqual([
            {
                section: "start",
                messageNumber: 1,
                role: "user",
                content: "Why does this fail? [code block: ts]"
            }
        ])
    })

    it("collapses inlined file parts when body text contains closing file tags", () => {
        const messages = getTitlePromptMessages([
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "Please summarize this"
                    },
                    {
                        type: "text",
                        text:
                            '<file name="large-report.md">\n' +
                            "This line mentions </file> as text.\n" +
                            'This line mentions <file name="nested.md"> as text.\n' +
                            "This content should not reach the title model.\n" +
                            "</file>"
                    }
                ]
            }
        ])

        expect(messages).toEqual([
            {
                section: "start",
                messageNumber: 1,
                role: "user",
                content: "Please summarize this [file: large-report.md]"
            }
        ])
    })

    it("derives fallback titles from compacted file context", () => {
        const title = fallbackTitleFromMessages([
            {
                role: "user",
                content: `Please summarize this\n<file name="large-report.md">\n${"very long file body ".repeat(100)}\n</file>`
            }
        ])

        expect(title).toBe("Please summarize this [file: large-report.md]")
    })
})
