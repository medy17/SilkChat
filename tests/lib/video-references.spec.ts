import { collectKnownVideos, splitVideoContent } from "@/lib/video-references"
import { parseVideoSnippetHeader, parseYouTubeVideoUrl } from "@/lib/youtube-video"
import { describe, expect, it } from "vitest"

describe("parseYouTubeVideoUrl", () => {
    it.each([
        ["https://www.youtube.com/watch?v=yTqVn8QJHJk&vl=en", { id: "yTqVn8QJHJk" }],
        [
            "https://www.youtube.com/watch?v=Wr1px7OArBo&xstg=CAMSBhUDze3xHw==",
            { id: "Wr1px7OArBo" }
        ],
        ["https://youtu.be/yTqVn8QJHJk?t=8m52s", { id: "yTqVn8QJHJk", start: 532 }],
        ["https://m.youtube.com/shorts/aDJKx_orwL4", { id: "aDJKx_orwL4" }],
        ["https://www.youtube.com/watch?v=yTqVn8QJHJk&t=95", { id: "yTqVn8QJHJk", start: 95 }]
    ])("reads the video from %s", (url, expected) => {
        expect(parseYouTubeVideoUrl(url)).toEqual(expected)
    })

    it.each([
        "https://www.youtube.com/@FCBarcelona",
        "https://www.youtube.com/playlist?list=PL1234567890",
        "https://www.youtube.com/watch?v=short",
        "https://notyoutube.com/watch?v=yTqVn8QJHJk",
        "yTqVn8QJHJk"
    ])("rejects %s", (url) => {
        expect(parseYouTubeVideoUrl(url)).toBeUndefined()
    })
})

describe("parseVideoSnippetHeader", () => {
    it("reads the channel and duration that open a video snippet", () => {
        expect(
            parseVideoSnippetHeader(
                "## FC Barcelona\n##### Mar 19, 2026 (0:03:55)\nAn unforgettable European night"
            )
        ).toEqual({ channel: "FC Barcelona", duration: "3:55" })
    })

    it("accepts a snippet with no channel line", () => {
        expect(parseVideoSnippetHeader("##### Aug 28, 2026 (1:24:43)\nFull match replay")).toEqual({
            duration: "1:24:43"
        })
    })

    it("finds nothing in a snippet that opens with prose", () => {
        expect(parseVideoSnippetHeader("Watch the extended highlights (2026)")).toEqual({})
    })
})

describe("splitVideoContent", () => {
    it("turns a standalone video tag into a card between the prose around it", () => {
        expect(
            splitVideoContent(
                [
                    "Here is the second goal.",
                    "",
                    '<video url="https://www.youtube.com/watch?v=yTqVn8QJHJk" start="532" title="Lewandowski\'s brace"></video>',
                    "",
                    "He scored again five minutes later."
                ].join("\n")
            )
        ).toEqual([
            { type: "markdown", content: "Here is the second goal.\n\n" },
            { type: "video", id: "yTqVn8QJHJk", start: 532, title: "Lewandowski's brace" },
            { type: "markdown", content: "\n\nHe scored again five minutes later." }
        ])
    })

    it("leaves other video tags, inline tags, and fenced examples as Markdown", () => {
        const content = [
            '<video src="https://cdn.example.com/clip.mp4" controls></video>',
            'Write <video url="https://youtu.be/yTqVn8QJHJk"></video> on its own line.',
            "```html",
            '<video url="https://youtu.be/yTqVn8QJHJk"></video>',
            "```"
        ].join("\n")

        expect(splitVideoContent(content)).toEqual([{ type: "markdown", content }])
    })

    it("holds a tag that is still streaming and shows it once it closes", () => {
        const prose = "The full highlights:\n\n"
        const tag = '<video url="https://youtu.be/yTqVn8QJHJk"></video>'

        for (const length of [3, 20, tag.length - 1]) {
            expect(splitVideoContent(prose + tag.slice(0, length), true)).toEqual([
                { type: "markdown", content: prose }
            ])
        }
        expect(splitVideoContent(prose + tag, true)).toEqual([
            { type: "markdown", content: prose },
            { type: "video", id: "yTqVn8QJHJk" }
        ])
    })
})

describe("collectKnownVideos", () => {
    it("collects the videos web searches returned, across the conversation", () => {
        const videos = collectKnownVideos([
            {
                role: "user",
                parts: [{ type: "text", text: "https://www.youtube.com/watch?v=4h81dWg_LOg" }]
            },
            {
                role: "assistant",
                parts: [
                    {
                        type: "tool-web_search",
                        toolCallId: "search-1",
                        state: "output-available",
                        input: { query: "highlights", domains: ["youtube.com"] },
                        output: {
                            success: true,
                            results: [
                                {
                                    title: "HIGHLIGHTS | FC BARCELONA 7 vs 2 NEWCASTLE UNITED",
                                    url: "https://www.youtube.com/watch?v=yTqVn8QJHJk",
                                    snippet: "",
                                    video: {
                                        id: "yTqVn8QJHJk",
                                        channel: "FC Barcelona",
                                        duration: "3:55"
                                    }
                                },
                                {
                                    title: "FC Barcelona",
                                    url: "https://www.youtube.com/@FCBarcelona",
                                    snippet: ""
                                }
                            ]
                        }
                    },
                    {
                        type: "tool-web_search",
                        toolCallId: "search-2",
                        state: "input-available",
                        input: { query: "more highlights" }
                    }
                ]
            }
        ] as never)

        expect([...videos]).toEqual([
            [
                "yTqVn8QJHJk",
                {
                    title: "HIGHLIGHTS | FC BARCELONA 7 vs 2 NEWCASTLE UNITED",
                    channel: "FC Barcelona",
                    duration: "3:55"
                }
            ]
        ])
    })
})
