import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { runOpeningDecisions } from "../../convex/chat_http/decisions/engine"
import { createVerbosityCaller, resolveVerbosity } from "../../convex/chat_http/decisions/verbosity"
import type { DecisionAnswers, NoulQuestion } from "../../convex/lib/decisions"

const fetchMock = vi.fn<typeof fetch>()
const answer = (answers: unknown) => Response.json({ model: "typesafe/jev-1.13", answers })
const opening = () => ({
    createdThread: true,
    parts: [{ type: "text", text: "Explain TCP congestion control in depth" }],
    routing: "silkchat" as const,
    signal: new AbortController().signal
})
const noulCaller = (key: string, state?: Record<string, unknown>) => ({
    state,
    questions: { [key]: { type: "noul", instructions: key } as NoulQuestion },
    interpret: (answers: DecisionAnswers<Record<string, NoulQuestion>> | null) =>
        answers ? (answers[key]?.noul ?? "missing") : "failed"
})
const choice = (probabilities: Record<string, number>) => ({
    verbosity: { type: "choice", choice: "usual", probabilities }
})
const requestBody = () => JSON.parse(fetchMock.mock.calls[0][1]!.body as string)

beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key")
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockReset()
})
afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
})

describe("opening decisions engine", () => {
    it("asks every caller in one request and returns each caller its own answers", async () => {
        fetchMock.mockResolvedValue(
            answer({ first: { type: "noul", noul: 0.9 }, second: { type: "noul", noul: 0.2 } })
        )
        const decisions = await runOpeningDecisions({
            ...opening(),
            sessionId: "thread-1",
            callers: { a: noulCaller("first", { onlyA: 1 }), b: noulCaller("second") }
        })
        expect(decisions).toEqual({ a: 0.9, b: 0.2 })
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const body = requestBody()
        expect(Object.keys(body.questions)).toEqual(["first", "second"])
        expect(body.state).toMatchObject({ request: opening().parts[0].text, onlyA: 1 })
        expect(body.session_id).toBe("thread-1")
    })

    it("gives every caller the failure when the request fails", async () => {
        fetchMock.mockResolvedValue(new Response("unavailable", { status: 503 }))
        expect(
            await runOpeningDecisions({
                ...opening(),
                callers: { a: noulCaller("first"), b: noulCaller("second") }
            })
        ).toEqual({ a: "failed", b: "failed" })
    })

    it("does not ask when no caller has a question", async () => {
        expect(await runOpeningDecisions({ ...opening(), callers: {} })).toEqual({})
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it.each([
        [{ a: noulCaller("same"), b: noulCaller("same") }],
        [{ a: noulCaller("first", { request: "override" }) }]
    ])("rejects callers that collide on question or state names", async (callers) => {
        await expect(runOpeningDecisions({ ...opening(), callers })).rejects.toThrow(/Duplicate/)
    })

    it("accepts optional answer fields and drops answers that do not match their question", async () => {
        fetchMock.mockResolvedValue(
            answer({
                verbosity: { type: "choice", choice: "longer" },
                first: { type: "choice", choice: "longer" }
            })
        )
        const decisions = await runOpeningDecisions({
            ...opening(),
            callers: { a: noulCaller("first"), verbosity: createVerbosityCaller() }
        })
        expect(decisions.a).toBe("missing")
        // Without probabilities or confidence there is no evidence to leave the usual length.
        expect(decisions.verbosity).toEqual({ level: "default", status: "complete" })
    })
})

describe("opening verbosity decisions", () => {
    it.each([
        [{ shorter: 1, usual: 0, longer: 0 }, "less"],
        [{ shorter: 0, usual: 0, longer: 1 }, "more"],
        [{ shorter: 0, usual: 0.23, longer: 0.77 }, "default"],
        [{ shorter: 0.04, usual: 0.96, longer: 0 }, "default"]
    ] as const)("maps %j to %s", async (probabilities, level) => {
        fetchMock.mockResolvedValue(answer(choice(probabilities)))
        const decisions = await runOpeningDecisions({
            ...opening(),
            callers: { verbosity: createVerbosityCaller() }
        })
        expect(decisions.verbosity).toEqual({ level, status: "complete" })
    })

    it("records a failed decision as the usual length", async () => {
        fetchMock.mockRejectedValue(new Error("network"))
        const decisions = await runOpeningDecisions({
            ...opening(),
            callers: { verbosity: createVerbosityCaller() }
        })
        expect(decisions.verbosity).toEqual({ level: "default", status: "failed" })
    })

    it.each([
        [undefined, undefined, undefined],
        [undefined, "less", "less"],
        ["default", "more", undefined],
        ["more", "less", "more"],
        ["less", undefined, "less"]
    ] as const)("setting %s with opening decision %s resolves to %s", (setting, opening, level) => {
        expect(resolveVerbosity(setting, opening ? { level: opening } : undefined)).toBe(level)
    })
})
