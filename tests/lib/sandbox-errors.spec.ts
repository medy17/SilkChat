import { describe, expect, it } from "vitest"
import { isMissingSandboxError, isSandboxHttpError } from "../../convex/lib/sandbox_errors"

describe("sandbox provider errors", () => {
    it("treats SDK 404 responses as an already-missing sandbox", () => {
        expect(isMissingSandboxError(new Error("Status code 404 is not ok"))).toBe(true)
        expect(
            isMissingSandboxError({
                response: { status: 404 },
                message: "provider request failed"
            })
        ).toBe(true)
        expect(isMissingSandboxError(new Error("sandbox_not_found"))).toBe(true)
    })

    it("distinguishes provider validation failures from missing sandboxes", () => {
        const error = { response: { status: 400 }, message: "Status code 400 is not ok" }
        expect(isSandboxHttpError(error, 400)).toBe(true)
        expect(isMissingSandboxError(error)).toBe(false)
    })
})
