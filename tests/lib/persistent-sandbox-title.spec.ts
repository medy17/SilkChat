import { getPersistentSandboxTitle } from "@/lib/persistent-sandbox-title"
import { describe, expect, it } from "vitest"

describe("persistent sandbox title", () => {
    it("uses the model's title", () => {
        expect(getPersistentSandboxTitle("  Drug deaths by year ", "python")).toBe(
            "Drug deaths by year"
        )
    })

    it("falls back to the runtime when the title is missing or blank", () => {
        expect(getPersistentSandboxTitle(undefined, "python")).toBe("Python workspace")
        expect(getPersistentSandboxTitle("   ", "node")).toBe("Node.js workspace")
        expect(getPersistentSandboxTitle(undefined, undefined)).toBe("Workspace")
    })
})
