import { getExpandedComposerHeight } from "@/lib/composer-expand"
import { describe, expect, it } from "vitest"

const viewport = { viewportHeight: 1000, headerHeight: 64 }

describe("getExpandedComposerHeight", () => {
    it("grows a docked composer up to just below the header, keeping its bottom edge", () => {
        expect(
            getExpandedComposerHeight({ anchor: "bottom", top: 780, bottom: 900, ...viewport })
        ).toBe(820)
    })

    it("grows a top-anchored composer down to just above the viewport bottom", () => {
        expect(
            getExpandedComposerHeight({ anchor: "top", top: 300, bottom: 420, ...viewport })
        ).toBe(684)
    })

    it("fills a centered composer's column with equal gaps", () => {
        expect(
            getExpandedComposerHeight({ anchor: "center", top: 480, bottom: 600, ...viewport })
        ).toBe(904)
    })
})
