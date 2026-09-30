import { collectLinkDefinitions } from "@/lib/markdown-scan"
import { describe, expect, it } from "vitest"

describe("markdown scanning", () => {
    it("collects link definitions outside code, leaving footnotes alone", () => {
        expect(
            collectLinkDefinitions(
                "See [a][ref].\n\n[ref]: https://example.com/a\n[^1]: A footnote.\n```md\n[fenced]: https://example.com/b\n```"
            )
        ).toEqual(["[ref]: https://example.com/a"])
    })
})
