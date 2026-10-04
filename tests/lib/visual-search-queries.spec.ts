import { expect, it } from "vitest"
import { getVisualSearchQueries } from "@/lib/visual-selections"

it("uses the quick-look query independently of the returned images", () => {
    expect(getVisualSearchQueries({ cue: "winter leopard" }, [{ searchQuery: "leopard" }])).toEqual(
        ["winter leopard"]
    )
    expect(getVisualSearchQueries({ cue: "winter leopard" }, [])).toEqual(["winter leopard"])
})

it("lists distinct originating queries in selected order, ignoring missing provenance", () => {
    expect(
        getVisualSearchQueries({ cue: "ignored caption", refs: ["a", "b", "c", "d"] }, [
            { searchQuery: "winter leopard" },
            { searchQuery: "summer leopard" },
            { searchQuery: "winter leopard" },
            {}
        ])
    ).toEqual(["winter leopard", "summer leopard"])
    expect(getVisualSearchQueries({ cue: "", refs: [] }, [])).toEqual([])
})
