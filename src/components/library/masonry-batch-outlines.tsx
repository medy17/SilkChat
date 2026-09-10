import { getLibraryBatchColor } from "@/lib/library-batch"
import { getBatchLabelPlacement, getMasonryBatchOutlines } from "@/lib/masonry-batch-outline"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Copy } from "lucide-react"
import { toast } from "sonner"
import {
    type CSSProperties,
    type ReactNode,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState
} from "react"
import "./masonry-batch-outlines.css"

type Outline = ReturnType<typeof getMasonryBatchOutlines>[number] & {
    bounds: { left: number; top: number; width: number; height: number }
    label?: ReturnType<typeof getBatchLabelPlacement>
}

function BatchLight({
    outline,
    active,
    hovered
}: {
    outline: Outline
    active: boolean
    hovered: boolean
}) {
    const id = useId().replaceAll(":", "")
    const wasActive = useRef(active)
    const [settling, setSettling] = useState(false)
    useEffect(() => {
        const finished = wasActive.current && !active
        wasActive.current = active
        if (active) setSettling(false)
        if (!finished) return
        setSettling(true)
        const timeout = window.setTimeout(() => setSettling(false), 1800)
        return () => window.clearTimeout(timeout)
    }, [active])
    const { batchId, path, bounds } = outline
    const state = active ? "active" : settling ? "settling" : hovered ? "hovered" : "idle"
    const area = {
        x: bounds.left - 12,
        y: bounds.top - 12,
        width: bounds.width + 24,
        height: bounds.height + 24
    }
    const gradient = (layer: string) => (
        <foreignObject {...area} className={layer}>
            <div className="library-batch-light-gradient" />
        </foreignObject>
    )
    return (
        <g
            className="library-batch-light"
            data-state={state}
            style={{ "--batch-colour": getLibraryBatchColor(batchId) } as CSSProperties}
        >
            <defs>
                <mask
                    id={`${id}-edge`}
                    maskUnits="userSpaceOnUse"
                    {...area}
                    style={{ maskType: "alpha" }}
                >
                    <path d={path} stroke="white" strokeWidth={2} fill="none" />
                </mask>
                <mask
                    id={`${id}-halo`}
                    maskUnits="userSpaceOnUse"
                    {...area}
                    style={{ maskType: "alpha" }}
                >
                    <path d={path} stroke="white" strokeWidth={5} fill="none" />
                </mask>
                <mask id={`${id}-outside`} maskUnits="userSpaceOnUse" {...area}>
                    <rect {...area} fill="white" />
                    <path d={path} fill="black" fillRule="evenodd" stroke="black" strokeWidth={2} />
                </mask>
                <filter id={`${id}-blur`} filterUnits="userSpaceOnUse" {...area}>
                    <feGaussianBlur stdDeviation={2.5} />
                </filter>
            </defs>
            <path d={path} className="library-batch-light-base" strokeWidth={2} />
            <g mask={`url(#${id}-outside)`}>
                <g filter={`url(#${id}-blur)`}>
                    <g mask={`url(#${id}-halo)`}>{gradient("library-batch-light-halo")}</g>
                </g>
            </g>
            <g mask={`url(#${id}-edge)`}>{gradient("library-batch-light-edge")}</g>
        </g>
    )
}

export function MasonryBatchOutlines({
    children,
    activeBatchIds
}: {
    children: ReactNode
    activeBatchIds: Set<string>
}) {
    const ref = useRef<HTMLDivElement>(null)
    const gutterRef = useRef<HTMLSpanElement>(null)
    const [outlines, setOutlines] = useState<Outline[]>([])
    const [hoveredBatch, setHoveredBatch] = useState<string>()
    const [focusedBatch, setFocusedBatch] = useState<string>()

    useLayoutEffect(() => {
        const container = ref.current
        if (!container) return
        let frame = 0
        const measure = () => {
            frame = 0
            const gallery = container.firstElementChild as HTMLElement | null
            if (!gallery) return
            const halfGap = (Number.parseFloat(getComputedStyle(gallery).columnGap) || 0) / 2
            const frameStyle = getComputedStyle(container)
            const borderWidth =
                Number.parseFloat(frameStyle.getPropertyValue("--library-batch-border-width")) || 2
            // Resolve the theme length through layout (the token may use rem or
            // calc), independently of the gallery's own padding.
            const innerGutter = gutterRef.current?.getBoundingClientRect().width ?? 0
            const contourOffset = innerGutter + borderWidth / 2
            const tileRadius = Number.parseFloat(frameStyle.borderTopLeftRadius) || 0
            // offset coordinates ignore Motion's temporary scale/translation,
            // so the boundary describes the settled masonry rather than wobbling.
            const tiles = [...gallery.querySelectorAll<HTMLElement>("[data-batch-tile]")]
            const halfRowGap = tiles.length
                ? Number.parseFloat(getComputedStyle(tiles[0]).marginBottom) / 2
                : halfGap
            const round = (value: number) => Math.round(value * 2) / 2
            const next = getMasonryBatchOutlines(
                tiles.map((tile) => ({
                    batchId: tile.dataset.batchId,
                    left: round(tile.offsetLeft - halfGap),
                    right: round(tile.offsetLeft + tile.offsetWidth + halfGap),
                    top: round(tile.offsetTop - halfRowGap),
                    bottom: round(tile.offsetTop + tile.offsetHeight + halfRowGap)
                })),
                // Merge before insetting to preserve the continuous masonry
                // contour; the remaining space is the independent outer gutter.
                Math.max(0, halfGap - contourOffset),
                tileRadius > 0 ? tileRadius + contourOffset : 0,
                Math.max(0, halfRowGap - contourOffset)
            )
            const measured = next.map((outline) => {
                const members = tiles.filter((tile) => tile.dataset.batchId === outline.batchId)
                const left = Math.min(...members.map((tile) => tile.offsetLeft))
                const top = Math.min(...members.map((tile) => tile.offsetTop))
                return {
                    ...outline,
                    label: getBatchLabelPlacement(
                        members.map((tile) => ({
                            left: tile.offsetLeft,
                            top: tile.offsetTop,
                            right: tile.offsetLeft + tile.offsetWidth,
                            bottom: tile.offsetTop + tile.offsetHeight
                        })),
                        halfGap * 2,
                        tileRadius,
                        contourOffset
                    ),
                    bounds: {
                        left,
                        top,
                        width:
                            Math.max(...members.map((tile) => tile.offsetLeft + tile.offsetWidth)) -
                            left,
                        height:
                            Math.max(...members.map((tile) => tile.offsetTop + tile.offsetHeight)) -
                            top
                    }
                }
            })
            setOutlines((previous) =>
                JSON.stringify(previous) === JSON.stringify(measured) ? previous : measured
            )
        }
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(measure)
        }
        const resize = new ResizeObserver(schedule)
        const observeTiles = () => {
            resize.disconnect()
            resize.observe(container)
            if (gutterRef.current) resize.observe(gutterRef.current)
            container
                .querySelectorAll<HTMLElement>("[data-batch-tile]")
                .forEach((tile) => resize.observe(tile))
            schedule()
        }
        const mutations = new MutationObserver(observeTiles)
        mutations.observe(container.firstElementChild!, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["data-batch-id"]
        })
        const themeChanges = new MutationObserver(schedule)
        for (
            let ancestor: HTMLElement | null = container;
            ancestor;
            ancestor = ancestor.parentElement
        ) {
            themeChanges.observe(ancestor, {
                attributes: true,
                attributeFilter: ["class", "style"]
            })
        }
        observeTiles()
        cancelAnimationFrame(frame)
        measure()
        return () => {
            cancelAnimationFrame(frame)
            resize.disconnect()
            mutations.disconnect()
            themeChanges.disconnect()
        }
    }, [])

    return (
        <div
            ref={ref}
            className="library-batch-frame relative rounded-[var(--radius-xl)]"
            onPointerOver={(event) => {
                if (event.pointerType === "touch") return
                const tile = (event.target as Element).closest<HTMLElement>(
                    "[data-batch-tile], [data-batch-label]"
                )
                setHoveredBatch(tile?.dataset.batchId)
            }}
            onPointerLeave={() => setHoveredBatch(undefined)}
            onFocusCapture={(event) =>
                setFocusedBatch(
                    event.target.closest<HTMLElement>("[data-batch-tile], [data-batch-label]")
                        ?.dataset.batchId
                )
            }
            onBlurCapture={(event) => {
                const target = event.relatedTarget
                setFocusedBatch(
                    target instanceof Element && event.currentTarget.contains(target)
                        ? target.closest<HTMLElement>("[data-batch-tile], [data-batch-label]")
                              ?.dataset.batchId
                        : undefined
                )
            }}
        >
            {children}
            <span
                ref={gutterRef}
                aria-hidden="true"
                className="pointer-events-none invisible absolute h-0"
                style={{ width: "var(--library-batch-inner-gutter)" }}
            />
            <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
                fill="none"
            >
                {outlines.map((outline) => (
                    <BatchLight
                        key={outline.batchId}
                        outline={outline}
                        active={activeBatchIds.has(outline.batchId)}
                        hovered={
                            hoveredBatch === outline.batchId || focusedBatch === outline.batchId
                        }
                    />
                ))}
            </svg>
            {outlines.map(
                ({ batchId, label }) =>
                    label &&
                    label.maxWidth > 0 && (
                        <Popover key={batchId}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    data-batch-label=""
                                    data-batch-id={batchId}
                                    className="library-batch-label absolute z-20 block truncate rounded-[var(--radius-xl)] border bg-background px-2 font-mono text-[10px] text-muted-foreground leading-none transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    style={
                                        {
                                            left: label.x,
                                            top: label.y,
                                            maxWidth: label.maxWidth,
                                            "--batch-colour": getLibraryBatchColor(batchId)
                                        } as CSSProperties
                                    }
                                    aria-label={`Batch ID: ${batchId}. View and copy`}
                                    onPointerEnter={() => setHoveredBatch(batchId)}
                                    onFocus={() => setFocusedBatch(batchId)}
                                >
                                    {batchId}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                side="top"
                                className="max-w-[calc(100vw-2rem)] rounded-[var(--radius-lg)]"
                            >
                                <p className="mb-2 font-medium text-sm">Batch ID</p>
                                <p className="select-text break-all font-mono text-muted-foreground text-xs">
                                    {batchId}
                                </p>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="mt-3"
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(batchId)
                                            toast.success("Batch ID copied")
                                        } catch {
                                            toast.error(
                                                "Couldn't copy. Select the batch ID to copy it manually."
                                            )
                                        }
                                    }}
                                >
                                    <Copy className="mr-2 size-3.5" />
                                    Copy ID
                                </Button>
                            </PopoverContent>
                        </Popover>
                    )
            )}
        </div>
    )
}
