import { applyThreadRangeSelection } from "@/components/threads/selection-range"
import { describe, expect, it } from "vitest"

const orderedThreadIds = ["a", "b", "c", "d", "e"]

describe("applyThreadRangeSelection", () => {
    it("selects every visible thread between the anchor and target in either direction", () => {
        expect(
            applyThreadRangeSelection({
                orderedThreadIds,
                selectedThreadIds: ["b"],
                anchorId: "b",
                targetId: "d"
            })
        ).toEqual(["b", "c", "d"])

        expect(
            applyThreadRangeSelection({
                orderedThreadIds,
                selectedThreadIds: ["d"],
                anchorId: "d",
                targetId: "a"
            })
        ).toEqual(["d", "a", "b", "c"])
    })

    it("keeps selections outside the range", () => {
        expect(
            applyThreadRangeSelection({
                orderedThreadIds,
                selectedThreadIds: ["e", "x"],
                anchorId: "a",
                targetId: "b"
            })
        ).toEqual(["e", "x", "a", "b"])
    })

    it("clears the range when the target is already selected", () => {
        expect(
            applyThreadRangeSelection({
                orderedThreadIds,
                selectedThreadIds: ["a", "b", "c", "d", "x"],
                anchorId: "b",
                targetId: "d"
            })
        ).toEqual(["a", "x"])
    })

    it("returns null when the anchor is no longer visible", () => {
        expect(
            applyThreadRangeSelection({
                orderedThreadIds,
                selectedThreadIds: ["x"],
                anchorId: "x",
                targetId: "c"
            })
        ).toBeNull()
    })
})
