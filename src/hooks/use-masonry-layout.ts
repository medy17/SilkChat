import { assignMasonryColumns, getMasonryColumnCount, layoutMasonry } from "@/lib/masonry-layout"
import { useCallback, useEffect, useLayoutEffect, useRef } from "react"

type MasonryItem = { id: string; aspectRatio: number }

const REFLOW_MS = 500

// Positions items absolutely from their aspect ratios. Positions are written to
// the DOM directly from a ResizeObserver, so resizing (window, sidebar) tracks
// every frame without re-rendering the items. When the column count or the item
// list changes, the container gets data-reflowing so items glide to their new
// places with real left/top/width transitions instead of scale transforms.
export function useMasonryLayout(items: MasonryItem[]) {
    const containerElementRef = useRef<HTMLDivElement | null>(null)
    const observerRef = useRef<ResizeObserver | null>(null)
    const elementsRef = useRef(new Map<string, HTMLElement>())
    const refCallbacksRef = useRef(new Map<string, (element: HTMLElement | null) => void>())
    const itemsRef = useRef(items)
    itemsRef.current = items
    const lastAppliedRef = useRef<{ signature: string; columnCount: number } | null>(null)
    const reflowTimeoutRef = useRef<number | null>(null)

    const applyLayout = useCallback(() => {
        const container = containerElementRef.current
        if (!container) return
        const width = container.clientWidth
        // A hidden pane (content-visibility) reports 0; keep the last layout.
        if (width < 1) return

        const currentItems = itemsRef.current
        const columnCount = getMasonryColumnCount(width)
        const gap = Number.parseFloat(getComputedStyle(container).columnGap) || 0
        const aspectRatios = currentItems.map((item) => item.aspectRatio)
        const columns = assignMasonryColumns(aspectRatios, columnCount)
        const { boxes, height } = layoutMasonry({
            aspectRatios,
            columns,
            columnCount,
            width,
            gap
        })

        const signature = currentItems.map((item) => item.id).join("|")
        const lastApplied = lastAppliedRef.current
        const shouldReflow =
            lastApplied !== null &&
            (lastApplied.columnCount !== columnCount || lastApplied.signature !== signature) &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        lastAppliedRef.current = { signature, columnCount }

        if (shouldReflow) {
            container.dataset.reflowing = "true"
            if (reflowTimeoutRef.current !== null) window.clearTimeout(reflowTimeoutRef.current)
            reflowTimeoutRef.current = window.setTimeout(() => {
                delete container.dataset.reflowing
                reflowTimeoutRef.current = null
            }, REFLOW_MS)
        }

        container.style.height = `${height}px`
        currentItems.forEach((item, index) => {
            const element = elementsRef.current.get(item.id)
            const box = boxes[index]
            if (!element || !box) return
            element.style.left = `${box.left}px`
            element.style.top = `${box.top}px`
            element.style.width = `${box.width}px`
        })
    }, [])

    // Stable per-id ref callbacks so React doesn't detach and reattach every render.
    const getItemRef = useCallback((id: string) => {
        let callback = refCallbacksRef.current.get(id)
        if (!callback) {
            callback = (element: HTMLElement | null) => {
                if (element) {
                    elementsRef.current.set(id, element)
                } else {
                    elementsRef.current.delete(id)
                    refCallbacksRef.current.delete(id)
                }
            }
            refCallbacksRef.current.set(id, callback)
        }
        return callback
    }, [])

    const itemsSignature = items.map((item) => `${item.id}:${item.aspectRatio}`).join("|")

    // Before paint, so new items never flash at the origin.
    useLayoutEffect(() => {
        void itemsSignature
        applyLayout()
    }, [applyLayout, itemsSignature])

    // The grid mounts only once there is something to show, so observe on attach.
    const containerRef = useCallback(
        (element: HTMLDivElement | null) => {
            observerRef.current?.disconnect()
            observerRef.current = null
            containerElementRef.current = element
            if (!element) return
            const observer = new ResizeObserver(() => applyLayout())
            observer.observe(element)
            observerRef.current = observer
            applyLayout()
        },
        [applyLayout]
    )

    useEffect(
        () => () => {
            observerRef.current?.disconnect()
            if (reflowTimeoutRef.current !== null) window.clearTimeout(reflowTimeoutRef.current)
        },
        []
    )

    return { containerRef, getItemRef }
}
