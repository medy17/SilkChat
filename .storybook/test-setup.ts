import { vi } from "vitest"

Object.defineProperty(window, "matchMedia", {
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
})
globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
}
globalThis.IntersectionObserver = class {
    root = null
    rootMargin = "0px"
    scrollMargin = "0px"
    thresholds = [0]
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
        return []
    }
}
Element.prototype.scrollIntoView = vi.fn()
Element.prototype.scrollTo = vi.fn()
window.scrollTo = vi.fn()
