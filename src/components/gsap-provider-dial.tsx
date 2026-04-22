import { cn } from "@/lib/utils"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { Draggable } from "gsap/Draggable"
import * as React from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

gsap.registerPlugin(Draggable)

export function GSAPProviderDial({
    sections,
    activeSectionId,
    onSelect,
    className
}: {
    sections: { id: string; icon: React.ReactNode; [key: string]: unknown }[]
    activeSectionId: string
    onSelect: (id: string) => void
    className?: string
}) {
    const containerRef = React.useRef<HTMLDivElement>(null)
    const cardsRef = React.useRef<HTMLUListElement>(null)
    const proxyRef = React.useRef<HTMLDivElement>(null)

    // We will use standard GSAP continuous vertical loop
    const [isClient, setIsClient] = React.useState(false)
    React.useEffect(() => setIsClient(true), [])

    useGSAP(() => {
        if (!isClient || !containerRef.current || !cardsRef.current || !proxyRef.current) return

        const spacing = 0.15 // spacing between cards
        const snapTime = gsap.utils.snap(spacing)
        const cards = gsap.utils.toArray(cardsRef.current.children) as HTMLElement[]

        if (cards.length === 0) return

        gsap.set(cards, { yPercent: 400, opacity: 0, scale: 0.5 })

        const animateFunc = (element: HTMLElement) => {
            const tl = gsap.timeline()
            tl.fromTo(
                element,
                { scale: 0.6, opacity: 0 },
                {
                    scale: 1.1,
                    opacity: 1,
                    zIndex: 100,
                    duration: 0.5,
                    yoyo: true,
                    repeat: 1,
                    ease: "power1.in",
                    immediateRender: false
                }
            ).fromTo(
                element,
                { yPercent: 400 },
                { yPercent: -400, duration: 1, ease: "none", immediateRender: false },
                0
            )
            return tl
        }

        const buildSeamlessLoop = (items: HTMLElement[], spacing: number) => {
            const overlap = Math.ceil(1 / spacing)
            const startTime = items.length * spacing + 0.5
            const loopTime = (items.length + overlap) * spacing + 1
            const rawSequence = gsap.timeline({ paused: true })
            const seamlessLoop = gsap.timeline({ paused: true, repeat: -1 })

            const l = items.length + overlap * 2
            for (let i = 0; i < l; i++) {
                const index = i % items.length
                const time = i * spacing
                rawSequence.add(animateFunc(items[index]), time)
            }

            rawSequence.time(startTime)
            seamlessLoop
                .to(rawSequence, {
                    time: loopTime,
                    duration: loopTime - startTime,
                    ease: "none"
                })
                .fromTo(
                    rawSequence,
                    { time: overlap * spacing + 1 },
                    {
                        time: startTime,
                        duration: startTime - (overlap * spacing + 1),
                        immediateRender: false,
                        ease: "none"
                    }
                )
            return seamlessLoop
        }

        const seamlessLoop = buildSeamlessLoop(cards, spacing)
        const wrapTime = gsap.utils.wrap(0, seamlessLoop.duration())
        const playhead = { offset: 0 }

        const scrub = gsap.to(playhead, {
            offset: 0,
            onUpdate() {
                seamlessLoop.time(wrapTime(playhead.offset))
            },
            duration: 0.5,
            ease: "power3",
            paused: true
        })

        const scrollToOffset = (offset: number) => {
            const snappedTime = snapTime(offset)
            gsap.to(playhead, {
                offset: snappedTime,
                duration: 0.3,
                ease: "power2.out",
                onUpdate() {
                    seamlessLoop.time(wrapTime(playhead.offset))
                }
            })
            scrub.vars.offset = snappedTime
        }

        // Find initial active section and scroll to it
        const activeIndex = Math.max(
            0,
            sections.findIndex((s) => s.id === activeSectionId)
        )
        const initialOffset = activeIndex * spacing
        scrub.vars.offset = initialOffset
        scrollToOffset(initialOffset)

        let snapTimeout: ReturnType<typeof setTimeout>
        // Wheel event
        const onWheel = (e: WheelEvent) => {
            e.preventDefault()
            scrub.vars.offset += e.deltaY * 0.0005
            scrub.invalidate().restart()
            clearTimeout(snapTimeout)
            snapTimeout = setTimeout(() => scrollToOffset(scrub.vars.offset), 150)
        }
        containerRef.current.addEventListener("wheel", onWheel, { passive: false })

        // Draggable
        Draggable.create(proxyRef.current, {
            type: "y",
            trigger: containerRef.current,
            onPress() {
                this.startOffset = scrub.vars.offset
            },
            onDrag() {
                scrub.vars.offset = this.startOffset + (this.startY - this.y) * 0.001
                scrub.invalidate().restart()
            },
            onDragEnd() {
                scrollToOffset(scrub.vars.offset)
            }
        })

        return () => {
            containerRef.current?.removeEventListener("wheel", onWheel)
        }
    }, [isClient, sections.length])

    if (!isClient) return null

    return (
        <div ref={containerRef} className={cn("relative w-[80px] overflow-hidden", className)}>
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-popover to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-12 bg-gradient-to-t from-popover to-transparent" />
            <ul
                ref={cardsRef}
                className="absolute inset-0 m-0 flex items-center justify-center p-0"
            >
                {sections.map((section, idx) => {
                    const isActive = section.id === activeSectionId
                    return (
                        <li
                            key={`${section.id}-${idx}`}
                            className="absolute flex cursor-pointer list-none items-center justify-center"
                            onClick={() => onSelect(section.id as string)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    onSelect(section.id as string)
                                }
                            }}
                            style={{ width: "60px", height: "60px" }}
                        >
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div
                                        className={cn(
                                            "flex size-10 items-center justify-center rounded-xl shadow-sm transition-colors duration-200",
                                            isActive
                                                ? "border border-border bg-accent text-accent-foreground"
                                                : "bg-transparent text-muted-foreground hover:bg-muted/50"
                                        )}
                                    >
                                        {section.icon}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="right">{section.label}</TooltipContent>
                            </Tooltip>
                        </li>
                    )
                })}
            </ul>
            <div ref={proxyRef} className="visibility-hidden absolute" />
        </div>
    )
}
