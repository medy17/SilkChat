import { describe, expect, it } from "vitest"

import { buildLemonSqueezyCheckoutUrl } from "@/lib/billing"

describe("billing", () => {
    it("adds user identity to Lemon Squeezy checkout links", () => {
        expect(
            buildLemonSqueezyCheckoutUrl({
                checkoutUrl: "https://store.lemonsqueezy.com/checkout/buy/123?embed=1",
                userId: "user-1",
                email: "user@example.com",
                name: "User One"
            })
        ).toBe(
            "https://store.lemonsqueezy.com/checkout/buy/123?embed=1&checkout%5Bcustom%5D%5Buser_id%5D=user-1&checkout%5Bemail%5D=user%40example.com&checkout%5Bname%5D=User+One"
        )
    })
})
