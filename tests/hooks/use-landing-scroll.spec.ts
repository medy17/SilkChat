// @vitest-environment jsdom

import { fireEvent, render, waitFor } from "@testing-library/react"
import type { MotionValue } from "motion/react"
import { createElement, type RefObject, StrictMode, useRef } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useLandingScroll } from "@/components/landing-page/use-landing-scroll"

describe("landing scroll startup", () => {
    beforeEach(() => {
        vi.stubGlobal(
            "ResizeObserver",
            class {
                observe() {}
                disconnect() {}
            }
        )
        vi.stubGlobal("matchMedia", () => ({
            matches: false,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {}
        }))
    })

    it.each([false, true])(
        "starts and tracks scrolling when the container ref belongs to a parent (StrictMode: %s)",
        async (strict) => {
            let top = 200
            let progress: MotionValue<number> | undefined

            function Section({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
                const sectionRef = useRef<HTMLElement>(null)
                progress = useLandingScroll(containerRef, sectionRef, "pass").progress
                return createElement("section", {
                    ref: (element: HTMLElement | null) => {
                        sectionRef.current = element
                        if (!element) return
                        Object.defineProperty(element, "offsetHeight", {
                            configurable: true,
                            value: 500
                        })
                        element.getBoundingClientRect = () => new DOMRect(0, top, 1200, 500)
                    }
                })
            }

            function Page() {
                const containerRef = useRef<HTMLDivElement>(null)
                return createElement(
                    "div",
                    {
                        ref: (element: HTMLDivElement | null) => {
                            containerRef.current = element
                            if (!element) return
                            Object.defineProperty(element, "clientHeight", {
                                configurable: true,
                                value: 900
                            })
                            element.getBoundingClientRect = () => new DOMRect(0, 0, 1200, 900)
                        }
                    },
                    createElement(Section, { containerRef })
                )
            }

            const page = createElement(Page)
            const { container } = render(strict ? createElement(StrictMode, null, page) : page)
            expect(progress?.get()).toBe(0.5)

            top = -500
            fireEvent.scroll(container.firstElementChild!)
            await waitFor(() => expect(progress?.get()).toBe(1))

            top = 900
            fireEvent.scroll(container.firstElementChild!)
            await waitFor(() => expect(progress?.get()).toBe(0))
        }
    )
})
