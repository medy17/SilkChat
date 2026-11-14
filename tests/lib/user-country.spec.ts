import { countryForTimeZone } from "@/lib/user-country"
import { describe, expect, it } from "vitest"

describe("countryForTimeZone", () => {
    it.each([
        ["Asia/Kuala_Lumpur", "MY"],
        ["Asia/Kuching", "MY"],
        ["Europe/London", "GB"],
        ["America/Los_Angeles", "US"],
        // The same zone under the name each engine generation prefers.
        ["Asia/Kolkata", "IN"],
        ["Asia/Calcutta", "IN"]
    ])("maps %s to %s", (timeZone, country) => {
        expect(countryForTimeZone(timeZone)).toBe(country)
    })

    it.each(["UTC", "Etc/GMT+8", "Not/AZone"])("finds no country for %s", (timeZone) => {
        expect(countryForTimeZone(timeZone)).toBeUndefined()
    })
})
