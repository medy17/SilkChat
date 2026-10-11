// Opt-in live Jev evaluation for Auto verbosity, never chat-model inference. Uses the app's hosted key.
// bun scripts/evals/opening-verbosity.ts [--filter=trip] [--with-tools] [--output=/tmp/jev-verbosity.json]
// --with-tools batches the question with the tool questions, as in production with Magic on.
import { writeFile } from "node:fs/promises"
import { config } from "dotenv"
import { decisionResponseSchema } from "../../convex/lib/decisions"
import { runOpeningDecisions } from "../../convex/chat_http/decisions/engine"
import { createOpeningToolsCaller } from "../../convex/chat_http/decisions/tools"
import { createVerbosityCaller } from "../../convex/chat_http/decisions/verbosity"
import { APP_SKILL_IDS } from "../../convex/chat_http/skills"
config({ path: ["envs/.env.convex", "envs/.env.local"], quiet: true })
if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required")
const arg = (name: string) =>
    process.argv
        .find((a) => a.startsWith(`--${name}=`))
        ?.split("=")
        .slice(1)
        .join("=")

type Case = { id: string; text: string; expected: "less" | "default" | "more"; exploratory?: true }
// "default" cases include openers: one decision covers the whole conversation.
const cases: Case[] = [
    { id: "capital", text: "What's the capital of Australia?", expected: "less" },
    { id: "even-zero", text: "quick q: is 0 an even number?", expected: "less" },
    { id: "convert", text: "Convert 72°F to Celsius", expected: "less" },
    { id: "tldr", text: "tl;dr what is kubernetes, one sentence please", expected: "less" },
    { id: "typo", text: "Fix the typo: 'Thier going to the store tomorow'", expected: "less" },
    { id: "yes-no", text: "Just yes or no: can dogs eat grapes?", expected: "less" },
    { id: "hi", text: "hi", expected: "default" },
    { id: "greeting", text: "hey, how's it going?", expected: "default" },
    { id: "help", text: "Can you help me with something?", expected: "default" },
    { id: "puppy", text: "Some good names for a golden retriever puppy?", expected: "default" },
    {
        id: "debug",
        text: "Help me debug this: TypeError: Cannot read properties of undefined (reading 'map') in my React component",
        expected: "default"
    },
    {
        id: "cover-letter",
        text: "Write a cover letter for a junior frontend developer role at Stripe",
        expected: "default",
        exploratory: true
    },
    {
        id: "fridge",
        text: "How does a refrigerator work?",
        expected: "default",
        exploratory: true
    },
    {
        id: "tcp",
        text: "Explain in depth how TCP congestion control works, including slow start, AIMD, and modern algorithms like BBR",
        expected: "more"
    },
    {
        id: "homelab",
        text: "Write a comprehensive guide to setting up a home lab with Proxmox, networking, backups and monitoring",
        expected: "more"
    },
    {
        id: "trip",
        text: "I'm planning a 3-week trip across Japan in spring. Give me a detailed day-by-day itinerary with transport, budget, and food recommendations.",
        expected: "more"
    },
    {
        id: "databases",
        text: "Compare PostgreSQL, MySQL and SQLite in detail for a SaaS app: performance, scaling, tooling, and operational cost",
        expected: "more"
    },
    {
        id: "linear-algebra",
        text: "Teach me linear algebra from scratch, thoroughly, as if I've never seen it",
        expected: "more"
    }
]
const filter = arg("filter")
const withTools = process.argv.includes("--with-tools")
const selected = cases.filter((c) => !filter || c.id.includes(filter))
if (!selected.length) throw new Error("No matching cases")

const fetchOriginal = globalThis.fetch
let answers: unknown = null
globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await fetchOriginal(...args)
    if (String(args[0]).includes("/decisions")) {
        const parsed = decisionResponseSchema.safeParse(await response.clone().json())
        answers = parsed.success ? parsed.data.answers : null
    }
    return response
}
const results = []
for (const c of selected) {
    answers = null
    const startedAt = performance.now()
    const decisions = await runOpeningDecisions({
        callers: {
            verbosity: createVerbosityCaller(),
            ...(withTools
                ? {
                      tools: createOpeningToolsCaller({
                          availableSkillIds: [...APP_SKILL_IDS],
                          chatModel: { id: "eval-model", knowledgeCutoff: "2026-02-16" }
                      })
                  }
                : {})
        },
        createdThread: true,
        parts: [{ type: "text", text: c.text }],
        routing: "silkchat",
        signal: new AbortController().signal
    })
    const ms = Math.round(performance.now() - startedAt)
    const level = decisions.verbosity?.level
    const result = { ...c, level, ms, pass: level === c.expected, answers }
    results.push(result)
    console.log(
        JSON.stringify({
            id: c.id,
            expected: c.expected,
            level,
            ms,
            exploratory: c.exploratory ?? false,
            probabilities: (answers as Record<string, { probabilities?: unknown }> | null)
                ?.verbosity?.probabilities
        })
    )
}
await writeFile(
    arg("output") ?? "/tmp/silkchat-jev-verbosity.json",
    JSON.stringify(results, null, 2)
)
console.log(
    JSON.stringify({
        cases: results.length,
        failures: results.filter((r) => !r.exploratory && !r.pass).length,
        exploratory: results.filter((r) => r.exploratory).length,
        maxMs: Math.max(...results.map((r) => r.ms))
    })
)
