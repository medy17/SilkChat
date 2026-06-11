"use client"

import { Masonry } from "@/components/react-bits/masonry"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { ChevronLeft, ChevronRight } from "lucide-react"
import type { CSSProperties, FocusEvent } from "react"
import { useCallback, useRef, useState } from "react"

gsap.registerPlugin(ScrollTrigger)

type ShowcaseScreen = {
    id: string
    label: string
    desktopFrameClassName: string
    mobileFrameClassName: string
    desktopLightSrc: string
    desktopDarkSrc: string
    mobileLightSrc: string
    mobileDarkSrc: string
}

type ShowcaseGallery = {
    title: string
    screens: ShowcaseScreen[]
}

const showcaseGalleries: ShowcaseGallery[] = [
    {
        title: "Chat Experience",
        screens: [
            {
                id: "chat-main",
                label: "Conversation Workspace",
                desktopFrameClassName: "md:aspect-[2879/1619]",
                mobileFrameClassName: "aspect-[650/1406]",
                desktopLightSrc: "/screenshots/desktop/chat/chat-desktop-light.png",
                desktopDarkSrc: "/screenshots/desktop/chat/chat-desktop-dark.png",
                mobileLightSrc: "/screenshots/mobile/chat/chat-mobile-light.png",
                mobileDarkSrc: "/screenshots/mobile/chat/chat-mobile-dark.png"
            },
            {
                id: "model-selector",
                label: "Model Selector",
                desktopFrameClassName: "md:aspect-[1400/989]",
                mobileFrameClassName: "aspect-[650/1406]",
                desktopLightSrc: "/screenshots/desktop/chat/model-selector-desktop-light.png",
                desktopDarkSrc: "/screenshots/desktop/chat/model-selector-desktop-dark.png",
                mobileLightSrc: "/screenshots/mobile/chat/model-selector-mobile-light.png",
                mobileDarkSrc: "/screenshots/mobile/chat/model-selector-mobile-dark.png"
            }
        ]
    },
    {
        title: "Library & Artifacts",
        screens: [
            {
                id: "library-main",
                label: "Generated Image Library",
                desktopFrameClassName: "md:aspect-[2879/1619]",
                mobileFrameClassName: "aspect-[659/1469]",
                desktopLightSrc: "/screenshots/desktop/library/library-desktop-light.png",
                desktopDarkSrc: "/screenshots/desktop/library/library-desktop-dark.png",
                mobileLightSrc: "/screenshots/mobile/library/library-mobile-light.png",
                mobileDarkSrc: "/screenshots/mobile/library/library-mobile-dark.png"
            }
        ]
    }
]

const showcaseMasonryItems = showcaseGalleries.flatMap((gallery) =>
    gallery.screens.flatMap((screen) => [
        {
            id: `${screen.id}-desktop`,
            img: screen.desktopLightSrc,
            url: screen.desktopLightSrc,
            width: screen.id === "model-selector" ? 1400 : 2879,
            height: screen.id === "model-selector" ? 989 : 1619,
            columns: 2
        },
        {
            id: `${screen.id}-mobile`,
            img: screen.mobileLightSrc,
            url: screen.mobileLightSrc,
            width: screen.id === "library-main" ? 659 : 650,
            height: screen.id === "library-main" ? 1469 : 1406
        }
    ])
)

const getSlideOffset = (index: number, activeIndex: number, total: number) => {
    let offset = index - activeIndex

    if (offset > total / 2) offset -= total
    if (offset < -total / 2) offset += total

    return offset
}

function ShowcaseGalleryCard({ title, screens }: ShowcaseGallery) {
    const [activeIndex, setActiveIndex] = useState(0)
    const [expanded, setExpanded] = useState(false)
    const activeScreen = screens[activeIndex]
    const hasMultipleScreens = screens.length > 1

    const showPrevious = useCallback(() => {
        setActiveIndex((current) => (current - 1 + screens.length) % screens.length)
    }, [screens.length])

    const showNext = useCallback(() => {
        setActiveIndex((current) => (current + 1) % screens.length)
    }, [screens.length])

    const handleBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
        const nextTarget = event.relatedTarget as Node | null

        if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
            setExpanded(false)
        }
    }, [])

    return (
        <div
            className="showcase-item flex flex-col gap-4 md:gap-5"
            style={{ willChange: "transform, opacity" }}
        >
            <div className="flex items-center justify-between gap-4 px-2">
                <h3 className="font-semibold text-xl md:text-2xl">{title}</h3>
                {hasMultipleScreens ? (
                    <p className="min-w-24 text-right text-muted-foreground text-sm">
                        {activeScreen.label}
                    </p>
                ) : null}
            </div>

            <div
                className="group relative h-[min(54dvh,31rem)] w-full overflow-hidden rounded-xl border border-border/50 bg-muted/30 shadow-2xl md:aspect-[4/3] md:h-auto"
                onMouseEnter={() => setExpanded(true)}
                onMouseLeave={() => setExpanded(false)}
                onFocusCapture={() => setExpanded(true)}
                onBlurCapture={handleBlur}
            >
                {screens.map((screen, index) => {
                    const offset = getSlideOffset(index, activeIndex, screens.length)
                    const isActive = index === activeIndex
                    const distance = Math.abs(offset)
                    const horizontalSpread = expanded
                        ? "clamp(2rem, 8vw, 5rem)"
                        : "clamp(0.35rem, 1.5vw, 1rem)"
                    const verticalSpread = expanded
                        ? "clamp(0.65rem, 2.5vw, 1.35rem)"
                        : "clamp(0.15rem, 0.8vw, 0.45rem)"
                    const rotation = offset * (expanded ? 6 : 2.5)
                    const scale = isActive ? (expanded ? 1 : 0.98) : expanded ? 0.86 : 0.78
                    const slideStyle: CSSProperties = {
                        zIndex: isActive ? screens.length + 2 : screens.length - distance,
                        opacity: isActive ? 1 : expanded ? 0.92 : 0.62,
                        transform: `translate(-50%, -50%) translateX(calc(${offset} * ${horizontalSpread})) translateY(calc(${distance} * ${verticalSpread})) rotate(${rotation}deg) scale(${scale})`,
                        filter: isActive || expanded ? undefined : "saturate(0.82)"
                    }

                    const slideClassName = cn(
                        "absolute top-1/2 left-1/2 overflow-hidden rounded-lg border bg-background transition-all duration-500 ease-out",
                        hasMultipleScreens
                            ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            : "",
                        isActive
                            ? cn(
                                  screen.mobileFrameClassName,
                                  screen.desktopFrameClassName,
                                  "h-[86%] md:h-auto md:w-[90%]"
                              )
                            : cn(
                                  screen.mobileFrameClassName,
                                  screen.desktopFrameClassName,
                                  "h-[74%] md:h-auto md:w-[76%]"
                              ),
                        isActive ? "border-border/70 shadow-2xl" : "border-border/40 shadow-xl"
                    )

                    const slideImages = (
                        <>
                            <img
                                src={screen.desktopLightSrc}
                                alt={`${title} ${screen.label} in desktop light mode`}
                                draggable={false}
                                className="hidden h-full w-full bg-background object-contain md:block dark:md:hidden"
                            />
                            <img
                                src={screen.desktopDarkSrc}
                                alt={`${title} ${screen.label} in desktop dark mode`}
                                draggable={false}
                                className="hidden h-full w-full bg-background object-contain md:dark:block"
                            />
                            <img
                                src={screen.mobileLightSrc}
                                alt={`${title} ${screen.label} in mobile light mode`}
                                draggable={false}
                                className="block h-full w-full bg-background object-contain md:hidden dark:hidden"
                            />
                            <img
                                src={screen.mobileDarkSrc}
                                alt={`${title} ${screen.label} in mobile dark mode`}
                                draggable={false}
                                className="hidden h-full w-full bg-background object-contain dark:block dark:md:hidden"
                            />
                        </>
                    )

                    if (!hasMultipleScreens) {
                        return (
                            <div key={screen.id} className={slideClassName} style={slideStyle}>
                                {slideImages}
                            </div>
                        )
                    }

                    return (
                        <button
                            key={screen.id}
                            type="button"
                            aria-label={`Show ${title} ${screen.label}`}
                            aria-pressed={isActive}
                            className={slideClassName}
                            style={slideStyle}
                            onClick={() => setActiveIndex(index)}
                        >
                            {slideImages}
                        </button>
                    )
                })}

                {hasMultipleScreens ? (
                    <div className="-translate-x-1/2 absolute bottom-3 left-1/2 z-30 flex items-center gap-2 rounded-full border border-border/70 bg-background/85 p-1 shadow-lg backdrop-blur-md">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-full"
                            aria-label={`Previous ${title} screen`}
                            onClick={showPrevious}
                        >
                            <ChevronLeft className="size-4" />
                        </Button>

                        <div
                            className="flex items-center gap-2 px-1"
                            aria-label={`${title} screens`}
                        >
                            {screens.map((screen, index) => {
                                const isActive = index === activeIndex

                                return (
                                    <button
                                        key={screen.id}
                                        type="button"
                                        aria-label={`Show ${title} ${screen.label}`}
                                        aria-current={isActive ? "true" : undefined}
                                        className={cn(
                                            "h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                            isActive
                                                ? "w-7 bg-foreground"
                                                : "w-2.5 bg-foreground/25 hover:bg-foreground/50"
                                        )}
                                        onClick={() => setActiveIndex(index)}
                                    />
                                )
                            })}
                        </div>

                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-full"
                            aria-label={`Next ${title} screen`}
                            onClick={showNext}
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                ) : null}
            </div>
        </div>
    )
}

export function ShowcaseSection() {
    const sectionRef = useRef<HTMLElement>(null)

    useGSAP(
        () => {
            const scroller = document.querySelector("main")?.parentElement

            gsap.fromTo(
                ".showcase-header",
                { y: 40, opacity: 0, filter: "blur(10px)" },
                {
                    y: 0,
                    opacity: 1,
                    filter: "blur(0px)",
                    duration: 1,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: sectionRef.current,
                        scroller: scroller || undefined,
                        start: "top 75%"
                    },
                    clearProps: "willChange"
                }
            )
            gsap.fromTo(
                ".showcase-item",
                { y: 50, opacity: 0, scale: 0.98 },
                {
                    y: 0,
                    opacity: 1,
                    scale: 1,
                    duration: 1.2,
                    stagger: 0.2,
                    ease: "power3.out",
                    scrollTrigger: {
                        trigger: sectionRef.current,
                        scroller: scroller || undefined,
                        start: "top 65%"
                    },
                    clearProps: "willChange"
                }
            )
        },
        { scope: sectionRef }
    )

    return (
        <section
            id="showcase"
            ref={sectionRef}
            className="flex min-h-screen snap-start flex-col items-center justify-start bg-muted/10 px-4 pt-20 pb-10 md:min-h-screen md:justify-center md:px-8 md:py-20 lg:min-h-[120vh]"
        >
            <div className="mx-auto w-full max-w-[1400px]">
                <div
                    className="showcase-header mb-8 text-center md:mb-12"
                    style={{ willChange: "transform, opacity, filter" }}
                >
                    <h2 className="mb-4 font-bold text-3xl md:text-5xl">
                        Experience the Interface
                    </h2>
                    <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                        A beautifully crafted workspace for all your AI interactions.
                    </p>
                </div>

                <div className="-mx-[50vw] relative right-1/2 left-1/2 flex w-screen snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-10 [scroll-padding-inline:1rem] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
                    {showcaseGalleries.map((gallery) => (
                        <div
                            key={gallery.title}
                            className="w-[calc(100vw-2rem)] shrink-0 snap-start"
                        >
                            <ShowcaseGalleryCard {...gallery} />
                        </div>
                    ))}
                </div>

                <div
                    className="showcase-item hidden h-[58rem] pb-10 md:block"
                    style={{ willChange: "transform, opacity" }}
                >
                    <Masonry
                        items={showcaseMasonryItems}
                        animateFrom="bottom"
                        blurToFocus={true}
                        colorShiftOnHover={false}
                        duration={0.6}
                        ease="power3.out"
                        hoverScale={0.97}
                        scaleOnHover={true}
                        stagger={0.05}
                    />
                </div>
            </div>
        </section>
    )
}
