// @vitest-environment jsdom

import { describe, expect, it } from "vitest"
import { sweepLegacyLibraryCache } from "@/hooks/use-library-image-page"

describe("sweepLegacyLibraryCache", () => {
    it("drops retired library cache formats and keeps live caches", () => {
        localStorage.clear()
        localStorage.setItem("CVX_DISK_CACHE:library-page:{}", "v1")
        localStorage.setItem('CVX_DISK_CACHE:library-cursor-page:v2:{}:["a"]', "v2")
        localStorage.setItem("CVX_DISK_CACHE:library-count:user", "count")
        localStorage.setItem('CVX_DISK_CACHE:library-cursor-page:v3:{}:["a"]', "v3")
        localStorage.setItem("CVX_DISK_CACHE:library-filter-options:user:active", "filters")
        localStorage.setItem("CVX_DISK_CACHE:threads", "threads")

        sweepLegacyLibraryCache()

        expect(Object.keys(localStorage).sort()).toEqual([
            'CVX_DISK_CACHE:library-cursor-page:v3:{}:["a"]',
            "CVX_DISK_CACHE:library-filter-options:user:active",
            "CVX_DISK_CACHE:threads"
        ])
    })
})
