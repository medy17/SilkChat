// Opt-in live check of the thread-title and share-question prompts across small models.
// Uses the app's OpenRouter key. See docs/THREAD_TITLES.md before reading much into averages.
// bun scripts/evals/title-models.ts [--dry] [--task=title|share] [--repeat=1] [--concurrency=8]
//   [--filter=gemini,luna] [--case=real,arabizi] [--category=coding,romanized]
//   [--variants=production,<candidate>] [--output=temp/title-models] (writes .json and .csv)
import { writeFile } from "node:fs/promises"
import { config } from "dotenv"
import {
    buildShareQuestionPrompt,
    getTitlePromptMessages,
    normalizeShareQuestion,
    normalizeTitle
} from "../../convex/chat_http/generate_thread_name"
import { hasJunkText, scriptsIn } from "../../convex/chat_http/title_quality"
import { type TitleCase, titleCases } from "./title-models-cases"
import { type TitlePromptVariant, titlePromptVariants } from "./title-prompt-variants"
config({ path: ["envs/.env.convex", "envs/.env.local"], quiet: true })
const arg = (name: string) =>
    process.argv
        .find((a) => a.startsWith(`--${name}=`))
        ?.split("=")
        .slice(1)
        .join("=")
const dry = process.argv.includes("--dry")
const apiKey = process.env.OPENROUTER_API_KEY
if (!apiKey && !dry) throw new Error("OPENROUTER_API_KEY is required")
const repeat = Number(arg("repeat") ?? 1)
if (!Number.isInteger(repeat) || repeat < 1 || repeat > 20) throw new Error("repeat must be 1–20")
const taskArg = arg("task")
if (taskArg && taskArg !== "title" && taskArg !== "share")
    throw new Error("task must be title|share")
const variantArg = arg("variants")?.split(",")
for (const v of variantArg ?? [])
    if (!(v in titlePromptVariants)) throw new Error(`Unknown variant ${v}`)
const variants = (variantArg ?? ["production"]) as TitlePromptVariant[]

// Reasoning off where the model allows it, otherwise its lowest effort.
// Prices are OpenRouter USD per 1M tokens, fetched 2026-10-09; used for --dry and when usage.cost is absent.
const OFF = { enabled: false, exclude: true, effort: "none" }
const models = [
    {
        name: "Gemini 3.1 Flash Lite",
        slug: "google/gemini-3.1-flash-lite",
        reasoning: { enabled: true, effort: "minimal" },
        input: 0.25,
        output: 1.5
    },
    { name: "GPT 6 Luna", slug: "openai/gpt-6-luna", reasoning: OFF, input: 0.1, output: 0.5 },
    {
        name: "Haiku 5.5",
        slug: "anthropic/claude-haiku-5.5",
        reasoning: OFF,
        input: 0.1,
        output: 0.5
    },
    {
        name: "DeepSeek V4.1 Flash",
        slug: "deepseek/deepseek-v4.1-flash",
        reasoning: OFF,
        input: 0.3,
        output: 1.2
    },
    {
        name: "GLM 5.3 Flash",
        slug: "z-ai/glm-5.3-flash",
        reasoning: { enabled: true, effort: "low" },
        input: 0.15,
        output: 0.5
    }
].filter(
    (m) => !arg("filter") || (arg("filter") ?? "").split(",").some((part) => m.slug.includes(part))
)
type Model = (typeof models)[number]

// Mirrors the app's two title paths: the first send titles a thread holding one user message
// (after any persona opening), and "regenerate title" sends the full history.
const scenarioFor = (c: TitleCase) => {
    const userTurns = c.messages.filter((message) => message.role === "user").length
    const last = c.messages.at(-1)?.role
    const prefix = c.persona ? "persona-" : ""
    if (userTurns === 1 && last === "user") return `${prefix}new-chat`
    if (last === "assistant") return `${prefix}retitle`
    throw new Error(`${c.id}: multi-turn cases must end with an assistant reply`)
}

type Task = "title" | "share"
// Share questions come from existing threads and the app passes no persona to them.
const jobs = titleCases
    .filter(
        (c) =>
            (!arg("case") || (arg("case") ?? "").split(",").some((part) => c.id.includes(part))) &&
            (!arg("category") || (arg("category") ?? "").split(",").includes(c.category))
    )
    .flatMap((c) => {
        const scenario = scenarioFor(c)
        const tasks: Task[] = ["title"]
        if (scenario.endsWith("retitle")) tasks.push("share")
        return tasks
            .filter((task) => !taskArg || task === taskArg)
            .flatMap((task) =>
                (task === "title" ? variants : (["production"] as const)).map((variant) => ({
                    c,
                    scenario,
                    task,
                    variant,
                    // Summary bucket: the task, split by prompt variant when comparing several.
                    group: variants.length > 1 ? `${task}:${variant}` : task
                }))
            )
    })
type Job = (typeof jobs)[number]
if (!jobs.length || !models.length) throw new Error("No matching cases or models")

const promptFor = ({ c, task, variant }: Job) => {
    const relevant = getTitlePromptMessages(c.messages)
    const { instructions, messages } =
        task === "title"
            ? titlePromptVariants[variant](relevant, c.persona)
            : buildShareQuestionPrompt(relevant)
    return [{ role: "system", content: instructions }, ...messages]
}

if (dry) {
    // ~4 chars per token, ~20 output tokens per call (Haiku's quoted titles ran ~15–22).
    const inputTokens = jobs.reduce(
        (sum, job) => sum + Math.ceil(JSON.stringify(promptFor(job)).length / 4),
        0
    )
    const outputTokens = jobs.length * 20
    let total = 0
    for (const m of models) {
        const cost = (repeat * (inputTokens * m.input + outputTokens * m.output)) / 1e6
        total += cost
        console.log(`${m.name.padEnd(22)} ~$${cost.toFixed(4)}`)
    }
    const counts = new Map<string, number>()
    for (const job of jobs) {
        const key = `${job.group} · ${job.scenario}`
        counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    for (const [key, n] of counts) console.log(`  ${key}: ${n} prompts`)
    console.log(
        `${jobs.length} prompts × ${models.length} models × ${repeat} runs = ${jobs.length * models.length * repeat} calls, ~${Math.round(inputTokens / jobs.length)} input tokens/call, ~$${total.toFixed(4)} total`
    )
    process.exit(0)
}

const wordCount = (text: string) => text.split(" ").filter(Boolean).length
// Words of 4+ Latin letters starting lowercase break the title prompt's title-case rule.
const isTitleCase = (title: string) => !title.split(" ").some((w) => /^[a-z][a-zA-Z]{3,}/.test(w))
const graphemeCount = (text: string) =>
    Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)).length

// For users writing in a non-Latin script: did the title keep it? null for Latin-script input.
const keptScript = (output: string, userText: string) => {
    const user = [...scriptsIn(userText)].filter((script) => script !== "latin")
    if (!user.length) return null
    const out = scriptsIn(output)
    return user.some((script) => out.has(script))
}

// Last user turn, so CSV rows can be judged without opening the cases file.
const lastUserText = (c: TitleCase) => {
    const content = [...c.messages].reverse().find((message) => message.role === "user")?.content
    const text =
        typeof content === "string"
            ? content
            : (content ?? [])
                  .map((part) => ("text" in part ? part.text : `[${part.type}]`))
                  .join(" ")
    return text.replace(/\s+/g, " ").slice(0, 200)
}

const call = async (m: Model, job: Job) => {
    const startedAt = Date.now()
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            model: m.slug,
            reasoning: m.reasoning,
            usage: { include: true },
            messages: promptFor(job)
        })
    })
    const latencyMs = Date.now() - startedAt
    const json = await response.json().catch(() => null)
    return { ok: response.ok, status: response.status, json, latencyMs }
}

const run = async (m: Model, job: Job, runNumber: number) => {
    let result = await call(m, job).catch((error) => ({ error: String(error) }) as const)
    // One retry for transient failures so rate limits don't read as model failures.
    if ("error" in result || !result.ok) {
        result = await call(m, job).catch((error) => ({ error: String(error) }) as const)
    }
    const { c, scenario, task, variant, group } = job
    const base = {
        task,
        variant,
        group,
        scenario,
        caseId: c.id,
        category: c.category,
        level: c.level ?? null,
        run: runNumber,
        model: m.name,
        lastUserMessage: lastUserText(c)
    }
    if ("error" in result || !result.ok) {
        const error =
            "error" in result
                ? result.error
                : `${result.status}: ${result.json?.error?.message ?? "unknown"}`
        return { ...base, error }
    }
    const { json, latencyMs } = result
    const raw = String(json.choices?.[0]?.message?.content ?? "")
    // What the app would actually save after its own cleanup.
    const output = task === "title" ? normalizeTitle(raw) : normalizeShareQuestion(raw)
    // Compliance is judged on the model's own text, before the app trims or truncates it.
    const rawClean = normalizeTitle(raw)
    const rawWords = wordCount(rawClean)
    const inputTokens: number = json.usage?.prompt_tokens ?? 0
    const outputTokens: number = json.usage?.completion_tokens ?? 0
    return {
        ...base,
        raw,
        output,
        empty: !output,
        rawWords,
        inRange:
            task === "title"
                ? rawWords >= 2 && rawWords <= 6
                : rawWords >= 4 && rawWords <= 10 && graphemeCount(rawClean) <= 72,
        quoted: /^\s*["'`“”]/.test(raw),
        labeled: /^\s*(title|question)\s*:/i.test(raw),
        titleCase: task === "title" ? isTitleCase(output) : null,
        endsWithQuestion: task === "share" ? rawClean.endsWith("?") : null,
        trailingPunct: task === "title" ? /[.!?:;]$/.test(output) : null,
        truncatedByApp: task === "share" ? wordCount(output) < rawWords : null,
        junk: hasJunkText(output, base.lastUserMessage, c.allowScripts),
        reusedSpelling: c.userSpellings ? c.userSpellings.test(output) : null,
        keptScript: keptScript(output, base.lastUserMessage),
        expectHit: c.expect ? c.expect.test(output) : null,
        avoidHit: c.avoid ? c.avoid.test(output) : null,
        latencyMs,
        inputTokens,
        outputTokens,
        reasoningTokens: json.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
        // BYOK calls bill the provider key via upstream_inference_cost on top of OpenRouter's fee.
        // Non-BYOK calls also report upstream_inference_cost, but it's already inside cost.
        costUsd:
            json.usage?.cost === undefined
                ? (inputTokens * m.input + outputTokens * m.output) / 1e6
                : json.usage.cost +
                  (json.usage.is_byok
                      ? (json.usage.cost_details?.upstream_inference_cost ?? 0)
                      : 0),
        byok: json.usage?.is_byok ?? null,
        provider: json.provider ?? null,
        finishReason: json.choices?.[0]?.finish_reason ?? null,
        error: null
    }
}
type Row = Awaited<ReturnType<typeof run>>
type DoneRow = Extract<Row, { output: string }>
const ok = (r: Row): r is DoneRow => "output" in r

// Several prompts in flight at once, each sent to every model in parallel.
const concurrency = Number(arg("concurrency") ?? 8)
if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("concurrency must be ≥ 1")
const work = Array.from({ length: repeat }, (_, i) =>
    jobs.map((job) => ({ job, runNumber: i + 1 }))
).flat()
// One slot per prompt keeps rows in prompt order however calls finish.
const slots: Row[][] = []
let nextItem = 0
let finished = 0
const worker = async () => {
    while (nextItem < work.length) {
        const order = nextItem++
        const { job, runNumber } = work[order]
        const results = await Promise.all(models.map((m) => run(m, job, runNumber)))
        slots[order] = results
        console.log(
            `\n[${++finished}/${work.length} run ${runNumber}] ${job.group} · ${job.scenario} · ${job.c.category}/${job.c.id}`
        )
        for (const r of results) {
            const line = ok(r)
                ? `${r.output}  (${r.latencyMs}ms, ${r.outputTokens} out, ${r.reasoningTokens} reasoning${r.expectHit === false ? ", MISS" : ""}${r.avoidHit ? ", AVOID" : ""}${r.inRange ? "" : ", LENGTH"})`
                : `ERROR ${r.error}`
            console.log(`  ${r.model.padEnd(22)} ${line}`)
        }
    }
}
await Promise.all(Array.from({ length: Math.min(concurrency, work.length) }, worker))
const rows = slots.flat()

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : "–")
const rate = (rs: DoneRow[], pick: (r: DoneRow) => boolean | null) => {
    const scored = rs.filter((r) => pick(r) !== null)
    return pct(scored.filter((r) => pick(r)).length, scored.length)
}
const quantile = (values: number[], q: number) => {
    const sorted = [...values].sort((x, y) => x - y)
    return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0
}
const groups = [...new Set(jobs.map((job) => job.group))]

const summary = groups.flatMap((group) =>
    models.map((m) => {
        const all = rows.filter((r) => r.model === m.name && r.group === group)
        const done = all.filter(ok)
        const latencies = done.map((r) => r.latencyMs)
        const cost = done.reduce((sum, r) => sum + r.costUsd, 0)
        return {
            group,
            model: m.name,
            calls: all.length,
            errors: all.length - done.length,
            empty: done.filter((r) => r.empty).length,
            junk: done.filter((r) => r.junk).length,
            keptScript: rate(done, (r) => r.keptScript),
            expectHit: rate(done, (r) => r.expectHit),
            avoidHit: `${done.filter((r) => r.avoidHit).length}/${done.filter((r) => r.avoidHit !== null).length}`,
            inRange: rate(done, (r) => r.inRange),
            format: rate(done, (r) =>
                r.task === "title"
                    ? Boolean(r.titleCase && !r.trailingPunct && !r.quoted && !r.labeled)
                    : Boolean(r.endsWithQuestion && !r.quoted && !r.labeled)
            ),
            avgWords: +(done.reduce((s, r) => s + r.rawWords, 0) / (done.length || 1)).toFixed(1),
            p50Ms: quantile(latencies, 0.5),
            p95Ms: quantile(latencies, 0.95),
            avgOut: +(done.reduce((s, r) => s + r.outputTokens, 0) / (done.length || 1)).toFixed(1),
            reasoningTokens: done.reduce((s, r) => s + r.reasoningTokens, 0),
            costUsd: +cost.toFixed(5),
            usdPer1k: +((1000 * cost) / (done.length || 1)).toFixed(4)
        }
    })
)

// Expect-hit rate per model for each value of a row field, split by task (and variant).
const hitRateBy = (key: "scenario" | "category" | "level") =>
    groups.flatMap((group) =>
        [
            ...new Set(rows.filter((r) => r.group === group && r[key] !== null).map((r) => r[key]))
        ].map((value) =>
            Object.fromEntries([
                ["group", group],
                [key, value],
                ...models.map((m) => [
                    m.name,
                    rate(
                        rows.filter(
                            (r): r is DoneRow =>
                                ok(r) && r.group === group && r.model === m.name && r[key] === value
                        ),
                        (r) => r.expectHit
                    )
                ])
            ])
        )
    )
const byScenario = hitRateBy("scenario")
const byCategory = hitRateBy("category")
const byLevel = hitRateBy("level")

console.log("\nPer model:")
console.table(summary)
console.log("Expect-hit rate by scenario:")
console.table(byScenario)
console.log("Expect-hit rate by category:")
console.table(byCategory)
console.log("Expect-hit rate by math/science level:")
console.table(byLevel)

// Every distinct output per case, with counts. Titles are judged by their worst run, and a model
// that alternates between a great title and a silly one averages out fine in the tables above.
console.log("\nDistinct outputs by case:")
for (const group of groups)
    for (const id of [...new Set(rows.filter((r) => r.group === group).map((r) => r.caseId))]) {
        console.log(`\n${group} · ${id}`)
        for (const m of models) {
            const counts = new Map<string, number>()
            for (const r of rows.filter(
                (row) => row.group === group && row.caseId === id && row.model === m.name
            )) {
                const text = ok(r) ? r.output : `ERROR ${r.error}`
                counts.set(text, (counts.get(text) ?? 0) + 1)
            }
            const outputs = [...counts]
                .sort((a, b) => b[1] - a[1])
                .map(([text, n]) => `${text} ×${n}`)
            console.log(`  ${m.name.padEnd(22)} ${outputs.join(" | ")}`)
        }
    }

const outputPath =
    arg("output") ?? `temp/title-models-${new Date().toISOString().replace(/[:.]/g, "-")}`
const columns = [
    "task",
    "variant",
    "scenario",
    "caseId",
    "category",
    "level",
    "run",
    "model",
    "lastUserMessage",
    "output",
    "raw",
    "rawWords",
    "inRange",
    "quoted",
    "labeled",
    "titleCase",
    "trailingPunct",
    "endsWithQuestion",
    "truncatedByApp",
    "expectHit",
    "avoidHit",
    "junk",
    "keptScript",
    "reusedSpelling",
    "latencyMs",
    "inputTokens",
    "outputTokens",
    "reasoningTokens",
    "costUsd",
    "byok",
    "provider",
    "finishReason",
    "error"
] as const
const csvCell = (value: unknown) =>
    value === null || value === undefined ? "" : `"${String(value).replace(/"/g, '""')}"`
const csv = [
    columns.join(","),
    ...rows.map((r) => columns.map((col) => csvCell((r as Record<string, unknown>)[col])).join(","))
].join("\n")
await writeFile(
    `${outputPath}.json`,
    JSON.stringify({ models, summary, byScenario, byCategory, byLevel, rows }, null, 2)
)
await writeFile(`${outputPath}.csv`, csv)
console.log(`Wrote ${outputPath}.json and ${outputPath}.csv`)
