import { describe, expect, it } from "vitest"
import {
    COMPUTER_KEY_PLACEHOLDER,
    describeComputerKeys,
    findComputerKeyHostConflict,
    getComputerKeyEnv,
    getComputerKeyExpiry,
    getComputerKeyHosts,
    getComputerKeyRoutes,
    normalizeComputerKeyHost,
    validateCustomComputerKey
} from "../../convex/lib/computer_keys"

const custom = {
    presetId: "custom",
    host: "api.example.com",
    headerName: "x-api-key",
    valuePrefix: "",
    envName: "EXAMPLE_KEY"
}

describe("computer key routes", () => {
    it("signs GitHub for both git and the API", () => {
        expect(getComputerKeyRoutes({ presetId: "github" }, "secret")).toEqual([
            {
                host: "github.com",
                headerName: "Authorization",
                headerValue: `Basic ${btoa("x-access-token:secret")}`
            },
            {
                host: "api.github.com",
                headerName: "Authorization",
                headerValue: "Bearer secret"
            }
        ])
    })

    it("sends a bare key to services that expect one", () => {
        expect(getComputerKeyRoutes({ presetId: "anthropic" }, "secret")).toEqual([
            { host: "api.anthropic.com", headerName: "x-api-key", headerValue: "secret" }
        ])
    })

    it("builds a custom key from its own settings", () => {
        expect(getComputerKeyRoutes(custom, "secret")).toEqual([
            { host: "api.example.com", headerName: "x-api-key", headerValue: "secret" }
        ])
        expect(
            getComputerKeyRoutes(
                { presetId: "custom", host: "api.example.com", valuePrefix: "Bearer " },
                "secret"
            )
        ).toEqual([
            {
                host: "api.example.com",
                headerName: "Authorization",
                headerValue: "Bearer secret"
            }
        ])
    })
})

describe("computer key conflicts", () => {
    it("stops two enabled keys claiming the same host", () => {
        expect(
            findComputerKeyHostConflict({ presetId: "custom", host: "api.github.com" }, [
                { presetId: "github" }
            ])
        ).toBe("api.github.com")
    })

    it("allows keys for different hosts", () => {
        expect(findComputerKeyHostConflict(custom, [{ presetId: "github" }])).toBeUndefined()
    })
})

describe("custom key validation", () => {
    it("accepts a normal API host, and cleans up a pasted URL", () => {
        expect(normalizeComputerKeyHost("https://API.Example.com/v1/users")).toBe("api.example.com")
        expect(validateCustomComputerKey({ host: "api.example.com" })).toBeNull()
    })

    it("refuses anything that would send a key somewhere loose", () => {
        for (const host of ["*", "*.example.com", "localhost", "127.0.0.1", "example", ""]) {
            expect(validateCustomComputerKey({ host })).not.toBeNull()
        }
    })

    it("refuses headers the proxy owns or that would change routing", () => {
        for (const headerName of ["Host", "cookie", "Content-Length", "bad header"]) {
            expect(
                validateCustomComputerKey({ host: "api.example.com", headerName })
            ).not.toBeNull()
        }
    })

    it("refuses variables that would change how the computer runs", () => {
        for (const envName of ["PATH", "LD_PRELOAD", "NODE_OPTIONS", "lower_case"]) {
            expect(validateCustomComputerKey({ host: "api.example.com", envName })).not.toBeNull()
        }
    })
})

describe("computer key expiry", () => {
    const NOW = 1_800_000_000_000
    const DAY_MS = 24 * 60 * 60_000

    it("has nothing to say about a key with no date", () => {
        expect(getComputerKeyExpiry(undefined, NOW)).toBeNull()
    })

    it("counts whole days, so a key ending tonight reads as today", () => {
        expect(getComputerKeyExpiry(NOW + 3_600_000, NOW)?.label).toBe("Expires today")
        expect(getComputerKeyExpiry(NOW + DAY_MS + 3_600_000, NOW)?.label).toBe("Expires tomorrow")
        expect(getComputerKeyExpiry(NOW + 5 * DAY_MS, NOW)?.label).toBe("Expires in 5 days")
    })

    it("starts warning 7 days out", () => {
        expect(getComputerKeyExpiry(NOW + 7 * DAY_MS, NOW)?.state).toBe("soon")
        expect(getComputerKeyExpiry(NOW + 8 * DAY_MS, NOW)?.state).toBe("ok")
    })

    it("treats the exact moment of expiry as expired", () => {
        expect(getComputerKeyExpiry(NOW, NOW)).toEqual({ state: "expired", label: "Expired" })
    })

    it("tells the model about expiring keys and asks it to mention them", () => {
        const description = describeComputerKeys(
            [{ presetId: "github", label: "GitHub", expiresAt: NOW + 3 * DAY_MS }],
            NOW
        )
        expect(description).toContain("Expires in 3 days.")
        expect(description).toContain("tell the user once")
    })

    it("keeps the description unchanged for keys that aren't close to expiring", () => {
        const withDate = describeComputerKeys(
            [{ presetId: "github", label: "GitHub", expiresAt: NOW + 60 * DAY_MS }],
            NOW
        )
        expect(withDate).toBe(describeComputerKeys([{ presetId: "github", label: "GitHub" }], NOW))
    })
})

describe("what the computer and model are given", () => {
    it("only ever puts a placeholder in the environment", () => {
        expect(getComputerKeyEnv([{ presetId: "github" }, custom])).toEqual({
            GH_TOKEN: COMPUTER_KEY_PLACEHOLDER,
            EXAMPLE_KEY: COMPUTER_KEY_PLACEHOLDER
        })
    })

    it("tells the model names and hosts, and never a value", () => {
        const description = describeComputerKeys([
            {
                presetId: "openai",
                label: "OpenAI",
                valueEncrypted: "encrypted-secret"
            } as never
        ])
        expect(description).toContain("OpenAI: api.openai.com (OPENAI_API_KEY is set)")
        expect(description).toContain("you may use them")
        expect(description).not.toContain("encrypted-secret")
    })

    it("still reads sensibly with no keys", () => {
        expect(describeComputerKeys([])).toContain("No keys are connected")
    })

    it("treats an empty custom key as covering no hosts", () => {
        expect(getComputerKeyHosts({ presetId: "custom" })).toEqual([])
    })
})
