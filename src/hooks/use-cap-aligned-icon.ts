import { useLayoutEffect, useRef, useState } from "react"

/** Lucide draws on a 24-unit grid with a 2-unit stroke. */
const LUCIDE_GRID = 24
const LUCIDE_STROKE = 2

/**
 * How far below the top of its line box an element's capitals start. The font's ascent and
 * cap height come from the browser, so this follows the real typeface and size.
 */
function measureCapTop(element: Element) {
    const style = getComputedStyle(element)
    const lineHeight = Number.parseFloat(style.lineHeight)
    const context = document.createElement("canvas").getContext("2d")
    if (!context || Number.isNaN(lineHeight)) return undefined
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const metrics = context.measureText("H")
    const halfLeading =
        (lineHeight - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2
    return halfLeading + metrics.fontBoundingBoxAscent - metrics.actualBoundingBoxAscent
}

/**
 * Hangs a leading Lucide icon's drawn top from its text's cap height. Centring the icon box on
 * the line leaves it riding high beside ProximaVara's tall lowercase, and Lucide pads each
 * glyph differently inside its box, so the glyph's own bounds are used. Pass the returned
 * margin as the icon's `marginTop` in a top-aligned row.
 */
export function useCapAlignedIcon<TText extends HTMLElement>(glyphKey?: unknown) {
    const iconRef = useRef<SVGSVGElement>(null)
    const textRef = useRef<TText>(null)
    const [marginTop, setMarginTop] = useState<number>()

    // biome-ignore lint/correctness/useExhaustiveDependencies: a new glyph has new bounds to measure.
    useLayoutEffect(() => {
        let cancelled = false
        const align = () => {
            const icon = iconRef.current
            const text = textRef.current
            if (cancelled || !icon || !text) return
            const capTop = measureCapTop(text)
            if (capTop === undefined) return
            const scale = icon.getBoundingClientRect().height / LUCIDE_GRID
            const glyphTop = (icon.getBBox().y - LUCIDE_STROKE / 2) * scale
            setMarginTop(capTop - glyphTop)
        }
        align()
        // The first pass can measure the fallback font; settle once ProximaVara loads.
        void document.fonts?.ready.then(align)
        return () => {
            cancelled = true
        }
    }, [glyphKey])

    return { iconRef, textRef, marginTop }
}
