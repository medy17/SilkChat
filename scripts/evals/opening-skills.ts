// Opt-in live Jev evaluation, never chat-model inference. Uses the app's hosted key.
// bun scripts/evals/opening-skills.ts [--filter=polar] [--repeat=7] [--output=/tmp/jev-eval.json]
import { writeFile } from "node:fs/promises"
import { config } from "dotenv"
import { classifierResponseSchema } from "../../convex/lib/classifiers"
import { selectOpeningSkills } from "../../convex/chat_http/select_opening_skills"
import { APP_SKILL_IDS } from "../../convex/chat_http/skills"
import { selectionCases } from "./opening-skills-cases"
config({ path: ["envs/.env.convex", "envs/.env.local"], quiet: true })
if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required")
const arg = (name: string) =>
    process.argv
        .find((a) => a.startsWith(`--${name}=`))
        ?.split("=")
        .slice(1)
        .join("=")
const repeat = Number(arg("repeat") ?? 1)
if (!Number.isInteger(repeat) || repeat < 1 || repeat > 20) throw new Error("repeat must be 1–20")
const filter = arg("filter")
const cases = selectionCases.filter((c) => !filter || c.id.includes(filter))
if (!cases.length) throw new Error("No matching cases")
const fetchOriginal = globalThis.fetch
let answers: unknown = null
globalThis.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await fetchOriginal(...args)
    if (String(args[0]).includes("/decisions")) {
        const parsed = classifierResponseSchema.safeParse(await response.clone().json())
        answers = parsed.success ? parsed.data.answers : null
    }
    return response
}
const results = []
for (const c of cases)
    for (let run = 1; run <= repeat; run++) {
        answers = null
        const selected = await selectOpeningSkills({
            createdThread: true,
            availableSkillIds: [...APP_SKILL_IDS],
            enabledTools: [],
            parts: [{ type: "text", text: c.text }, ...(c.attachments ?? [])],
            chatModel: { id: "eval-model", knowledgeCutoff: "2026-02-16" },
            routing: "silkchat",
            signal: new AbortController().signal
        })
        const missing = (c.required ?? []).filter((id) => !selected.includes(id))
        const unwanted = (c.forbidden ?? []).filter((id) => selected.includes(id))
        const result = {
            id: c.id,
            run,
            text: c.text,
            selected,
            missing,
            unwanted,
            exploratory: c.exploratory ?? false,
            answers,
            classifierFailed: answers === null
        }
        results.push(result)
        console.log(
            JSON.stringify({
                id: c.id,
                run,
                selected,
                missing,
                unwanted,
                exploratory: result.exploratory
            })
        )
    }
await writeFile(arg("output") ?? "/tmp/silkchat-jev-eval.json", JSON.stringify(results, null, 2))
const failures = results.filter(
    (r) => r.classifierFailed || (!r.exploratory && (r.missing.length || r.unwanted.length))
).length
console.log(
    JSON.stringify({
        cases: results.length,
        failures,
        exploratory: results.filter((r) => r.exploratory).length
    })
)

if (failures) process.exitCode = 1
