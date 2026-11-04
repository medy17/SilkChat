import { cn } from "@/lib/utils"
import { AnimatePresence, motion, useIsPresent } from "motion/react"
import { type ReactNode, useCallback, useState } from "react"

// One timing for every composer movement, taken from the touch composer's attach/model pill: the
// shape moves first, the old content clears out of the way, and the new content settles in once
// the shape is nearly there.
export const COMPOSER_EASE = [0.16, 1, 0.3, 1] as const
export const composerShapeTransition = { duration: 0.3, ease: COMPOSER_EASE } as const
const contentOutTransition = { duration: 0.15, ease: "easeOut" } as const
const contentInTransition = { duration: 0.2, delay: 0.1, ease: "easeOut" } as const

// CSS twins of the timing above, for shapes that transition in CSS. Full literals so Tailwind
// picks them up.
export const COMPOSER_SHAPE_CLASS = "duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
export const COMPOSER_CONTENT_OUT_CLASS = "opacity-0 duration-150 ease-out"
export const COMPOSER_CONTENT_IN_CLASS = "opacity-100 delay-100 duration-200 ease-out"

/**
 * Swaps content inside a slot whose width eases to fit, so a changed label never makes its
 * neighbours jump. The leaving content fades out of the flow while the new content sets the
 * target width; a null key empties the slot and eases it shut.
 *
 * Set `animateWidth` off when an outer shell already eases to this content's width; the swap then
 * only crossfades. `offset` slides content in from, and back out towards, the start.
 */
export function ComposerMorph({
    contentKey,
    children,
    animateWidth = true,
    offset = 0,
    className
}: {
    contentKey: string | null
    children?: ReactNode
    animateWidth?: boolean
    offset?: number
    className?: string
}) {
    const [width, setWidth] = useState<number | null>(null)
    const measure = useCallback((node: HTMLSpanElement | null) => {
        if (!node) return
        setWidth(node.offsetWidth)
        const observer = new ResizeObserver(() => setWidth(node.offsetWidth))
        observer.observe(node)
        return () => observer.disconnect()
    }, [])
    // Unset until measured, which lets the slot size itself to its first content.
    const slotWidth = animateWidth ? (contentKey === null ? 0 : (width ?? undefined)) : undefined

    return (
        <span
            className={cn(
                "relative inline-flex shrink-0 items-center",
                animateWidth &&
                    cn(
                        "overflow-hidden transition-[width] motion-reduce:transition-none",
                        COMPOSER_SHAPE_CLASS
                    ),
                className
            )}
            style={{ width: slotWidth }}
        >
            <AnimatePresence initial={false}>
                {contentKey !== null && (
                    <ComposerMorphLayer
                        key={contentKey}
                        measureRef={animateWidth ? measure : undefined}
                        offset={offset}
                    >
                        {children}
                    </ComposerMorphLayer>
                )}
            </AnimatePresence>
        </span>
    )
}

function ComposerMorphLayer({
    children,
    measureRef,
    offset
}: {
    children: ReactNode
    measureRef?: (node: HTMLSpanElement | null) => (() => void) | undefined
    offset: number
}) {
    const isPresent = useIsPresent()
    return (
        <motion.span
            initial={{ opacity: 0, x: -offset }}
            animate={{ opacity: 1, x: 0, transition: contentInTransition }}
            exit={{ opacity: 0, x: -offset, transition: contentOutTransition }}
            // Leaving content steps out of the flow so only the new content sets the width.
            className={cn(
                "flex shrink-0 items-center",
                !isPresent && "pointer-events-none absolute inset-y-0 left-0"
            )}
        >
            {/* Measured on a plain element: the callback ref's cleanup has to run. */}
            <span ref={isPresent ? measureRef : undefined} className="flex w-max items-center">
                {children}
            </span>
        </motion.span>
    )
}
