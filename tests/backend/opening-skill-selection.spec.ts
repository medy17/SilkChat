import { TOOL_SELECTION_MODEL } from "../../convex/lib/models/typesafe"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
    OPENING_SKILL_SELECTION_TIMEOUT_MS,
    selectOpeningSkills
} from "../../convex/chat_http/select_opening_skills"

const fetchMock = vi.fn<typeof fetch>()
const options = () => ({
    createdThread: true,
    enabledTools: ["web_search"] as Array<"web_search">,
    availableSkillIds: ["web_search", "diagrams"] as Array<"web_search" | "diagrams">,
    parts: [{ type: "text", text: "Search the web for current news" }],
    routing: "silkchat" as const,
    chatModel: { id: "test-chat", knowledgeCutoff: "2024-01-01" },
    signal: new AbortController().signal
})
const answer = (answers: unknown) => Response.json({ model: "typesafe/jev-1.13", answers })

beforeEach(() => {
    vi.stubEnv("OPENROUTER_API_KEY", "test-key")
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockReset()
})
afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.useRealTimers()
})

describe("opening skill selection", () => {
    it.each([
        [0.5, ["web_search", "code_execution", "math"]],
        [0.3, ["math"]]
    ] as const)(
        "uses the selected classifier's calibration with prohibition threshold %s",
        async (prohibitionThreshold, expected) => {
            fetchMock.mockResolvedValue(
                answer({
                    web_search_current: { type: "noul", noul: 0.8 },
                    web_search_forbidden: { type: "noul", noul: 0.4 },
                    code_execution_data: { type: "noul", noul: 0.8 },
                    code_execution_forbidden: { type: "noul", noul: 0.4 },
                    math_visualization: { type: "noul", noul: 0.8 },
                    diagrams: { type: "noul", noul: 0.8 }
                })
            )
            const classifierModel = {
                ...TOOL_SELECTION_MODEL,
                id: "alternate-classifier",
                adapters: ["openrouter:test/alternate-classifier" as const],
                skillSelection: {
                    thresholds: {
                        ...TOOL_SELECTION_MODEL.skillSelection.thresholds,
                        web_search: 0.7,
                        code_execution: 0.7,
                        math: 0.7,
                        diagrams: 0.9
                    },
                    prohibitionThresholds: {
                        web_search: prohibitionThreshold,
                        code_execution: prohibitionThreshold
                    }
                }
            }
            expect(
                await selectOpeningSkills({
                    ...options(),
                    classifierModel,
                    availableSkillIds: ["web_search", "code_execution", "math", "diagrams"]
                })
            ).toEqual(expected)
            expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).model).toBe(
                "test/alternate-classifier"
            )
        }
    )

    it("batches available skills and only preloads confident allowed matches", async () => {
        fetchMock.mockResolvedValue(
            answer({
                web_search: { type: "noul", noul: 0.98 },
                web_search_forbidden: { type: "noul", noul: 0.01 },
                web_search_after_cutoff: { type: "noul", noul: 0.1 },
                diagrams: { type: "noul", noul: 0.5 },
                code_execution: { type: "noul", noul: 1 }
            })
        )
        expect(await selectOpeningSkills(options())).toEqual(["web_search"])
        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toBe("https://openrouter.ai/api/alpha/decisions")
        const request = JSON.parse(init!.body as string)
        expect(request.model).toBe("typesafe/jev-1.13")
        expect(Object.keys(request.questions)).toEqual([
            "web_search",
            "diagrams",
            "web_search_current",
            "web_search_after_cutoff",
            "web_search_data",
            "web_search_forbidden"
        ])
        expect(request.questions.web_search.type).toBe("noul")
        expect(request.state.currentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(request.state.chatModel.knowledgeCutoff).toBe("2024-01-01")
        expect(request.state.skills).toEqual([
            expect.objectContaining({ id: "web_search", availability: "user_enabled" }),
            expect.objectContaining({ id: "diagrams", availability: "always_available_format" })
        ])
    })

    it.each([
        { enabled: false },
        { createdThread: false },
        { createdThread: true, targetMode: "retry" as const },
        { createdThread: true, targetMode: "edit" as const },
        { availableSkillIds: [] },
        { parts: [] }
    ])("does not classify non-opening or unsupported requests: %j", async (override) => {
        expect(await selectOpeningSkills({ ...options(), ...override })).toEqual([])
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("falls back without credentials", async () => {
        vi.stubEnv("OPENROUTER_API_KEY", "")
        expect(await selectOpeningSkills(options())).toEqual([])
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it("selects current-information search without inventing an unknown cutoff", async () => {
        fetchMock.mockResolvedValue(
            answer({
                web_search: { type: "noul", noul: 0.1 },
                web_search_current: { type: "noul", noul: 0.95 },
                web_search_after_cutoff: { type: "noul", noul: 0.1 },
                web_search_forbidden: { type: "noul", noul: 0.01 }
            })
        )
        expect(
            await selectOpeningSkills({ ...options(), chatModel: { id: "custom-model" } })
        ).toEqual(["web_search"])
        const request = JSON.parse(fetchMock.mock.calls[0][1]!.body as string)
        expect(request.state.chatModel.knowledgeCutoff).toBeNull()
    })

    it.each([false, true])(
        "selects historical data retrieval and computation unless browsing is forbidden=%s",
        async (forbidden) => {
            // Recorded Jev scores from the South Pole request, independent of recency.
            fetchMock.mockResolvedValue(
                answer({
                    web_search: { type: "noul", noul: 0.82 },
                    web_search_current: { type: "noul", noul: 0.76 },
                    web_search_after_cutoff: { type: "noul", noul: 0.34 },
                    web_search_data: { type: "noul", noul: 0.98 },
                    web_search_forbidden: { type: "noul", noul: forbidden ? 0.99 : 0.04 },
                    code_execution: { type: "noul", noul: 0.2 },
                    code_execution_data: { type: "noul", noul: 0.92 },
                    code_execution_forbidden: { type: "noul", noul: 0.01 }
                })
            )
            expect(
                await selectOpeningSkills({
                    ...options(),
                    enabledTools: [],
                    availableSkillIds: ["web_search", "code_execution"],
                    chatModel: { id: "deepseek-v4-pro-0813" }
                })
            ).toEqual(forbidden ? ["code_execution"] : ["web_search", "code_execution"])
        }
    )

    it("respects a code-execution prohibition even when data processing scores highly", async () => {
        fetchMock.mockResolvedValue(
            answer({
                code_execution: { type: "noul", noul: 0.99 },
                code_execution_data: { type: "noul", noul: 0.98 },
                code_execution_forbidden: { type: "noul", noul: 0.99 }
            })
        )
        expect(
            await selectOpeningSkills({ ...options(), availableSkillIds: ["code_execution"] })
        ).toEqual([])
    })

    it("recognizes a requested plot independently of mathematical complexity", async () => {
        fetchMock.mockResolvedValue(
            answer({
                math: { type: "noul", noul: 0.3 },
                math_visualization: { type: "noul", noul: 0.96 }
            })
        )
        expect(await selectOpeningSkills({ ...options(), availableSkillIds: ["math"] })).toEqual([
            "math"
        ])
    })

    it("uses lower thresholds only for presentation instructions", async () => {
        fetchMock.mockResolvedValue(
            answer({
                diagrams: { type: "noul", noul: 0.75 },
                recipes: { type: "noul", noul: 0.74 },
                canvas: { type: "noul", noul: 0.8 },
                image_generation: { type: "noul", noul: 0.8 },
                memory: { type: "noul", noul: 0.8 }
            })
        )
        expect(
            await selectOpeningSkills({
                ...options(),
                availableSkillIds: ["diagrams", "recipes", "canvas", "image_generation", "memory"]
            })
        ).toEqual(["diagrams", "canvas"])
    })

    it.each([
        [0.94, 0.01, ["web_search"]],
        [0.2, 0.01, []],
        [0.94, 0.9, []],
        [0.94, 0.5, []]
    ])(
        "combines post-cutoff need=%s with browsing prohibition=%s",
        async (afterCutoff, forbidden, selected) => {
            fetchMock.mockResolvedValue(
                answer({
                    web_search: { type: "noul", noul: 0.3 },
                    web_search_after_cutoff: { type: "noul", noul: afterCutoff },
                    web_search_forbidden: { type: "noul", noul: forbidden }
                })
            )
            expect(await selectOpeningSkills(options())).toEqual(selected)
        }
    )

    it.each([
        () => new Response("unavailable", { status: 503 }),
        () => answer({ web_search: { type: "noul", noul: 1.5 } }),
        () => new Response("not JSON"),
        () => answer({})
    ])("keeps on-demand loading when the response is unusable", async (response) => {
        fetchMock.mockResolvedValue(response())
        expect(await selectOpeningSkills(options())).toEqual([])
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("preloads a current-event search when connection setup exceeds 1.5 seconds", async () => {
        vi.useFakeTimers()
        vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
            const controller = new AbortController()
            setTimeout(() => controller.abort(), milliseconds)
            return controller.signal
        })
        fetchMock.mockImplementation(
            (_url, init) =>
                new Promise((resolve, reject) => {
                    init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason))
                    setTimeout(
                        () =>
                            resolve(
                                answer({
                                    web_search_current: { type: "noul", noul: 0.95 },
                                    web_search_forbidden: { type: "noul", noul: 0.05 }
                                })
                            ),
                        2_000
                    )
                })
        )
        const selection = selectOpeningSkills({
            ...options(),
            parts: [{ type: "text", text: "When is the 2026 Apple Event?" }],
            chatModel: { id: "gpt-5.6-luna" }
        })
        await vi.advanceTimersByTimeAsync(2_000)
        expect(await selection).toEqual(["web_search"])
    })

    it("aborts a stalled classifier without retrying", async () => {
        vi.useFakeTimers()
        vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
            const controller = new AbortController()
            setTimeout(() => controller.abort(), milliseconds)
            return controller.signal
        })
        fetchMock.mockImplementation(
            (_url, init) =>
                new Promise((_resolve, reject) => {
                    init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason))
                })
        )
        const selection = selectOpeningSkills(options())
        await vi.advanceTimersByTimeAsync(OPENING_SKILL_SELECTION_TIMEOUT_MS)
        expect(await selection).toEqual([])
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("preserves ZDR routing and sends attachment labels without URLs or bytes", async () => {
        fetchMock.mockResolvedValue(answer({}))
        await selectOpeningSkills({
            ...options(),
            routing: "zdr",
            parts: [
                ...options().parts,
                {
                    type: "file",
                    filename: "report.csv",
                    mimeType: "text/csv",
                    data: "secret-url"
                } as never
            ]
        })
        const request = JSON.parse(fetchMock.mock.calls[0][1]!.body as string)
        expect(request.provider.zdr).toBe(true)
        expect(request.state.attachments).toEqual([
            { type: "file", filename: "report.csv", mimeType: "text/csv" }
        ])
        expect(JSON.stringify(request)).not.toContain("secret-url")
    })
})
