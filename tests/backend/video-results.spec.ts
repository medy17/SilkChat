import { afterEach, describe, expect, it, vi } from "vitest"
import { normalizeVideoResults } from "../../convex/lib/tools/video_results"

afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
})

const videoResult = (id: string, snippet = "") => ({
    title: `Video ${id}`,
    url: `https://www.youtube.com/watch?v=${id}`,
    snippet
})

describe("normalizeVideoResults with the YouTube Data API", () => {
    // Region data as YouTube reports it for a UK-only upload, an India-only upload, an
    // upload blocked in Malaysia, and an unrestricted one.
    const stubDataApi = () => {
        vi.stubEnv("YOUTUBE_API_KEY", "yt-key")
        const fetchMock = vi.fn(async (_input: string | URL | Request) =>
            Response.json({
                items: [
                    {
                        id: "LpKmQ7hohRg",
                        snippet: { channelTitle: "TNT Sports Football" },
                        status: { embeddable: true, privacyStatus: "public" },
                        contentDetails: {
                            duration: "PT6M19S",
                            regionRestriction: { allowed: ["GB", "GG", "GI", "IE", "IM", "JE"] }
                        }
                    },
                    {
                        id: "EMl0Z69Z3CA",
                        snippet: { channelTitle: "Visca elBarca" },
                        status: { embeddable: true, privacyStatus: "public" },
                        contentDetails: {
                            duration: "PT6M53S",
                            regionRestriction: { blocked: ["MY", "SG"] }
                        }
                    },
                    {
                        id: "yTqVn8QJHJk",
                        snippet: { channelTitle: "FC Barcelona" },
                        status: { embeddable: true, privacyStatus: "public" },
                        contentDetails: { duration: "PT1H3M55S" }
                    },
                    {
                        id: "Wr1px7OArBo",
                        snippet: { channelTitle: "BARCA MEDIA" },
                        status: { embeddable: false, privacyStatus: "public" },
                        contentDetails: { duration: "PT13M52S" }
                    }
                ]
            })
        )
        vi.stubGlobal("fetch", fetchMock)
        return fetchMock
    }

    const results = [
        videoResult("LpKmQ7hohRg"),
        videoResult("EMl0Z69Z3CA"),
        videoResult("yTqVn8QJHJk"),
        videoResult("Wr1px7OArBo"),
        // Returned by the search index but no longer on YouTube.
        videoResult("8Ls15b2iWvU")
    ]
    const ids = (normalized: Awaited<ReturnType<typeof normalizeVideoResults>>) =>
        normalized.map((result) => result.video?.id)

    it.each([
        ["MY", ["yTqVn8QJHJk"]],
        ["GB", ["LpKmQ7hohRg", "EMl0Z69Z3CA", "yTqVn8QJHJk"]]
    ])("keeps only the videos that play in %s", async (country, expected) => {
        stubDataApi()
        expect(ids(await normalizeVideoResults(results, { country }))).toEqual(expected)
    })

    it("applies no region filter when the country is unknown", async () => {
        stubDataApi()
        expect(ids(await normalizeVideoResults(results))).toEqual([
            "LpKmQ7hohRg",
            "EMl0Z69Z3CA",
            "yTqVn8QJHJk"
        ])
    })

    it("looks every video up in one request and reports channel and duration", async () => {
        const fetchMock = stubDataApi()
        const normalized = await normalizeVideoResults(results, { country: "MY" })

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get("id")).toBe(
            "LpKmQ7hohRg,EMl0Z69Z3CA,yTqVn8QJHJk,Wr1px7OArBo,8Ls15b2iWvU"
        )
        expect(normalized[0].video).toEqual({
            id: "yTqVn8QJHJk",
            channel: "FC Barcelona",
            duration: "1:03:55"
        })
    })

    it("falls back to the keyless check when the API fails", async () => {
        vi.stubEnv("YOUTUBE_API_KEY", "yt-key")
        vi.stubGlobal(
            "fetch",
            vi.fn(async (input: string | URL | Request) =>
                String(input).includes("googleapis.com")
                    ? new Response("quota", { status: 403 })
                    : Response.json({ author_name: "FC Barcelona" })
            )
        )

        const normalized = await normalizeVideoResults([videoResult("yTqVn8QJHJk")], {
            country: "MY"
        })
        expect(normalized[0].video).toEqual({ id: "yTqVn8QJHJk", channel: "FC Barcelona" })
    })
})

describe("normalizeVideoResults without an API key", () => {
    // Answers YouTube's oEmbed lookup per video ID.
    const stubLookups = (answers: Record<string, () => Response | Promise<Response>>) => {
        const fetchMock = vi.fn((input: string | URL | Request) => {
            const target = new URL(String(input)).searchParams.get("url") ?? ""
            const id = new URL(target).searchParams.get("v") ?? ""
            return Promise.resolve(answers[id]?.() ?? new Response("Not Found", { status: 404 }))
        })
        vi.stubGlobal("fetch", fetchMock)
        return fetchMock
    }

    it("cleans video URLs, adds channel and duration, and drops repeats and dead videos", async () => {
        stubLookups({
            yTqVn8QJHJk: () => Response.json({ author_name: "FC Barcelona" }),
            "8Ls15b2iWvU": () => new Response("Not Found", { status: 404 }),
            Wr1px7OArBo: () => new Response("Unauthorized", { status: 401 })
        })

        const results = await normalizeVideoResults([
            {
                title: "HIGHLIGHTS | FC BARCELONA 7 vs 2 NEWCASTLE UNITED",
                url: "https://www.youtube.com/watch?v=yTqVn8QJHJk&vl=en",
                snippet: "## FC Barcelona\n##### Mar 19, 2026 (0:03:55)\nAn unforgettable night",
                date: "2026-03-19"
            },
            {
                title: "Same video, shared link",
                url: "https://youtu.be/yTqVn8QJHJk",
                snippet: ""
            },
            {
                title: "Removed re-upload",
                url: "https://www.youtube.com/watch?v=8Ls15b2iWvU",
                snippet: "## SportOzg\n##### Apr 02, 2026 (0:14:53)"
            },
            {
                title: "Embedding disabled",
                url: "https://www.youtube.com/watch?v=Wr1px7OArBo&xstg=CAMSBhUDze3xHw==",
                snippet: ""
            }
        ])

        expect(results).toEqual([
            {
                title: "HIGHLIGHTS | FC BARCELONA 7 vs 2 NEWCASTLE UNITED",
                url: "https://www.youtube.com/watch?v=yTqVn8QJHJk",
                snippet: "## FC Barcelona\n##### Mar 19, 2026 (0:03:55)\nAn unforgettable night",
                date: "2026-03-19",
                video: { id: "yTqVn8QJHJk", channel: "FC Barcelona", duration: "3:55" }
            }
        ])
    })

    it("keeps a video when the availability lookup fails, using the snippet's channel", async () => {
        stubLookups({
            yTqVn8QJHJk: () => Promise.reject(new Error("timed out")),
            aDJKx_orwL4: () => new Response("Server Error", { status: 500 })
        })

        const results = await normalizeVideoResults([
            {
                title: "Highlights",
                url: "https://www.youtube.com/watch?v=yTqVn8QJHJk",
                snippet: "##  PRO MATCHES UHD\n##### Aug 08, 2026 (0:18:20)"
            },
            { title: "More", url: "https://www.youtube.com/watch?v=aDJKx_orwL4", snippet: "" }
        ])

        expect(results.map((result) => result.video)).toEqual([
            { id: "yTqVn8QJHJk", channel: "PRO MATCHES UHD", duration: "18:20" },
            { id: "aDJKx_orwL4" }
        ])
    })

    it("passes other results through without a lookup", async () => {
        const fetchMock = stubLookups({})
        const results = [
            { title: "Match report", url: "https://example.com/report", snippet: "Barça won." },
            { title: "FC Barcelona", url: "https://www.youtube.com/@FCBarcelona", snippet: "" }
        ]

        expect(await normalizeVideoResults(results)).toEqual(results)
        expect(fetchMock).not.toHaveBeenCalled()
    })
})
