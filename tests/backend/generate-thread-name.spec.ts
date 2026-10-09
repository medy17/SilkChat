import { describe, expect, it } from "vitest"
import {
    buildThreadTitlePrompt,
    fallbackShareQuestion,
    fallbackTitleFromMessages,
    firstUsableGeneration,
    getTitlePromptMessages,
    normalizeShareQuestion,
    orderTitleModelCandidates,
    titleReasoningOptions
} from "../../convex/chat_http/generate_thread_name"
import type { SharedModel } from "../../convex/lib/models/types"
import type { UserRegistry } from "../../convex/settings"

describe("title model selection", () => {
    const registryModels = (models: Record<string, { routingUnavailableReason?: string }>) =>
        Object.fromEntries(
            Object.entries(models).map(([id, extra]) => [
                id,
                { id, adapters: [`openrouter:vendor/${id}`], ...extra }
            ])
        ) as unknown as UserRegistry["models"]

    it("tries the preferred model, then the user's saved title model, then fallbacks, once each", () => {
        // The saved model is also a fallback, so it must appear once, in the saved position.
        const candidates = orderTitleModelCandidates(
            registryModels({
                "gemini-3.1-flash-lite": {},
                "gpt-6-luna": {},
                "gpt-4.1-mini": {}
            }),
            "gpt-4.1-mini"
        )

        expect(candidates).toEqual(["gemini-3.1-flash-lite", "gpt-4.1-mini", "gpt-6-luna"])
    })

    it("skips models that can't be routed on the app's keys", () => {
        const candidates = orderTitleModelCandidates(
            registryModels({
                "gemini-3.1-flash-lite": { routingUnavailableReason: "Blocked by routing mode" },
                "gpt-6-luna": {}
            }),
            "gemini-3.1-flash-lite"
        )

        expect(candidates).toEqual(["gpt-6-luna"])
    })

    it("turns reasoning off where possible and otherwise uses the lowest effort", () => {
        const model = (fields: Partial<SharedModel>) =>
            ({ abilities: ["reasoning", "effort_control"], ...fields }) as SharedModel

        expect(titleReasoningOptions(model({ supportsDisablingReasoning: true }))).toEqual({
            enabled: false,
            exclude: true,
            effort: "none"
        })
        expect(
            titleReasoningOptions(model({ reasoningEfforts: ["high", "minimal", "low"] }))
        ).toEqual({ enabled: true, effort: "minimal" })
        expect(titleReasoningOptions(model({ abilities: [] }))).toBeUndefined()
    })
})

describe("firstUsableGeneration", () => {
    it("moves to the next model when one fails or returns unusable text", async () => {
        const failing = await firstUsableGeneration(["a", "b"], async (modelId) => {
            if (modelId === "a") throw new Error("provider down")
            return "Title From B"
        })
        const corrupted = await firstUsableGeneration(["a", "b"], async (modelId) =>
            modelId === "a" ? null : "Title From B"
        )

        expect(failing).toBe("Title From B")
        expect(corrupted).toBe("Title From B")
    })

    it("gives up after two attempts so the caller can use its local fallback", async () => {
        const attempted: string[] = []
        const result = await firstUsableGeneration(["a", "b", "c"], async (modelId) => {
            attempted.push(modelId)
            return null
        })

        expect(result).toBeNull()
        expect(attempted).toEqual(["a", "b"])
    })
})

describe("share questions", () => {
    it("keeps generated questions short, clean, and question-shaped", () => {
        expect(
            normalizeShareQuestion(
                'Question: "How can a very long conversation become a warm specific invitation without overwhelming someone opening the link?"'
            )
        ).toBe("How can a very long conversation become a warm specific invitation?")
    })

    it("keeps a question that fits the character limit whole, however many words it has", () => {
        expect(
            normalizeShareQuestion("How can I cope with the end of a six-year relationship?")
        ).toBe("How can I cope with the end of a six-year relationship?")
    })

    it("reuses an opening user question when generation is unavailable", () => {
        expect(
            fallbackShareQuestion(
                [
                    { role: "user", content: "Why do stars shimmer? I keep noticing it." },
                    { role: "assistant", content: "It is mostly atmospheric turbulence." }
                ],
                "Twinkling Stars"
            )
        ).toBe("Why do stars shimmer?")
    })

    it("turns the existing thread title into a friendly fallback for statements", () => {
        expect(
            fallbackShareQuestion(
                [{ role: "user", content: "Help me make this migration less risky" }],
                "Safer Database Migration"
            )
        ).toBe("What should we know about Safer Database Migration?")
    })
})

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

describe("persona thread titles", () => {
    const persona = {
        name: "Elara",
        description: "A ranger seeking help at a ruined watchtower.",
        instructions: "Roleplay as Elara. The user is a fellow traveler."
    }
    const opening = {
        role: "assistant" as const,
        content: "Will you join me at the ruined watchtower?"
    }
    const reply = { role: "user" as const, content: "I'll come with you." }

    it("keeps persona background, the selected opening, and later scenes in the title context", () => {
        const prompt = buildThreadTitlePrompt(
            getTitlePromptMessages([
                opening,
                reply,
                { role: "assistant", content: "We reach the tower." },
                { role: "user", content: "Let's explore." },
                { role: "assistant", content: "Days later, we arrive at the harbor." },
                { role: "user", content: "I offer the captain a bargain." },
                { role: "assistant", content: "The captain demands our map." }
            ]),
            persona
        )

        const context = prompt.messages[0].content
        expect(context).toContain(persona.description)
        expect(context).toContain(persona.instructions)
        expect(context).toContain(opening.content)
        expect(context).toContain(reply.content)
        expect(context).toContain("I offer the captain a bargain.")
        expect(context).not.toContain("We reach the tower.")
    })

    it("bounds persona fields separately and excludes knowledge documents and unused starters", () => {
        const largePersona = {
            ...persona,
            description: "d".repeat(5000),
            instructions: "i".repeat(10000),
            compiledPrompt: "Full knowledge base should not be sent",
            conversationStarters: ["An unused opening"]
        }
        const prompt = buildThreadTitlePrompt(
            getTitlePromptMessages([opening, reply]),
            largePersona
        )
        const context = prompt.messages[0].content
        const background = JSON.parse(context.split("\n")[1])

        expect(background.description.length).toBeLessThanOrEqual(600)
        expect(background.instructions.length).toBeLessThanOrEqual(1800)
        expect(Object.keys(background)).toEqual(["name", "description", "instructions"])
        expect(context).not.toContain(largePersona.compiledPrompt)
        expect(context).not.toContain(largePersona.conversationStarters[0])
        expect(context).toContain(opening.content)
        expect(context).toContain(reply.content)
    })

    it("falls back to the persona name for roleplay and task personas, preserving ordinary chat fallback", () => {
        expect(fallbackTitleFromMessages([opening, reply], persona)).toBe("Elara")
        expect(fallbackTitleFromMessages([], persona)).toBe("Elara")
        expect(
            fallbackTitleFromMessages([reply], {
                name: "Code Tutor",
                description: "Helps debug code",
                instructions: "Explain programming concepts"
            })
        ).toBe("Code Tutor")
        expect(fallbackTitleFromMessages([reply], null)).toBe("I'll come with you.")
        expect(fallbackTitleFromMessages([])).toBe("New Chat")
    })
})
