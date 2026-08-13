"use client"

import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog"
import { Maximize2, X } from "lucide-react"
import { type ReactNode, useLayoutEffect, useRef, useState } from "react"

export type NativeVisualizationSize = {
    width: number
    height: number
}

type NativeVisualizationShellProps = {
    kind: "chart" | "network" | "schematic" | "electrical plot"
    title: string
    description?: string
    icon: ReactNode
    dataAttribute:
        | "data-native-chart"
        | "data-native-network"
        | "data-electrical-schematic"
        | "data-electrical-plot"
    renderVisualization: (expanded: boolean, size?: NativeVisualizationSize) => ReactNode
}

function ExpandedVisualizationSurface({
    renderVisualization
}: {
    renderVisualization: NativeVisualizationShellProps["renderVisualization"]
}) {
    const surfaceRef = useRef<HTMLDivElement>(null)
    const [size, setSize] = useState<NativeVisualizationSize>({ width: 0, height: 0 })

    useLayoutEffect(() => {
        const surface = surfaceRef.current
        if (!surface) return

        const updateSize = () => {
            const bounds = surface.getBoundingClientRect()
            const width = Math.max(0, Math.floor(bounds.width))
            const height = Math.max(0, Math.floor(bounds.height))
            setSize((current) =>
                current.width === width && current.height === height ? current : { width, height }
            )
        }

        updateSize()
        const observer =
            typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updateSize)
        observer?.observe(surface)
        return () => observer?.disconnect()
    }, [])

    return (
        <div ref={surfaceRef} className="relative min-h-0 flex-1 overflow-hidden">
            {size.width > 0 && size.height > 0 ? renderVisualization(true, size) : null}
        </div>
    )
}

const VisualizationHeader = ({
    title,
    description,
    icon,
    action
}: {
    title: string
    description?: string
    icon: ReactNode
    action: ReactNode
}) => (
    <div className="flex items-start gap-2.5 border-border border-b px-4 py-3">
        <div className="mt-0.5 shrink-0 text-primary">{icon}</div>
        <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm">{title}</h3>
            {description && <p className="mt-1 text-muted-foreground text-xs">{description}</p>}
        </div>
        {action}
    </div>
)

export function NativeVisualizationShell({
    kind,
    title,
    description,
    icon,
    dataAttribute,
    renderVisualization
}: NativeVisualizationShellProps) {
    const [open, setOpen] = useState(false)
    const dataAttributes = { [dataAttribute]: "" }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <figure
                {...dataAttributes}
                className="not-prose my-5 w-full overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card text-card-foreground shadow-sm"
            >
                <figcaption>
                    <VisualizationHeader
                        title={title}
                        description={description}
                        icon={icon}
                        action={
                            <DialogTrigger asChild>
                                <button
                                    type="button"
                                    aria-label={`Expand ${kind}`}
                                    title={`Expand ${kind}`}
                                    className="hidden size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex"
                                >
                                    <Maximize2 className="size-4" />
                                </button>
                            </DialogTrigger>
                        }
                    />
                </figcaption>
                {renderVisualization(false)}
            </figure>

            <DialogContent
                showCloseButton={false}
                overlayClassName="backdrop-blur-md"
                className="flex max-w-none flex-col gap-0 overflow-hidden rounded-[var(--radius-lg)] bg-card p-0 text-card-foreground"
                style={{
                    width: "92vw",
                    height: "85vh",
                    maxWidth: "80rem",
                    maxHeight: "56rem"
                }}
            >
                <VisualizationHeader
                    title={title}
                    description={description}
                    icon={icon}
                    action={
                        <DialogClose asChild>
                            <button
                                type="button"
                                aria-label={`Close expanded ${kind}`}
                                title="Close"
                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <X className="size-4" />
                            </button>
                        </DialogClose>
                    }
                />
                <DialogTitle className="sr-only">{title}</DialogTitle>
                <DialogDescription className="sr-only">
                    {description || `Expanded interactive ${kind}`}
                </DialogDescription>
                <ExpandedVisualizationSurface renderVisualization={renderVisualization} />
            </DialogContent>
        </Dialog>
    )
}
