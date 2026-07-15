"use client"

import {
    Check,
    ChevronLeft,
    ChevronRight,
    Clipboard,
    Download,
    ExternalLink,
    X
} from "lucide-react"
import { type TouchEvent as ReactTouchEvent, useEffect, useMemo, useRef, useState } from "react"

import type { GalleryImage } from "@/components/landing-page/content"
import { ImageLoadIndicator } from "@/components/library/image-load-indicator"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle
} from "@/components/ui/drawer"
import { cn, downloadUrl } from "@/lib/utils"
import { toast } from "sonner"

const DESKTOP_BREAKPOINT = 1100
const DESKTOP_GAP = 24
// Must leave room on each side for the flyout close/nav buttons (4.5rem offset + margin).
const DESKTOP_HORIZONTAL_CHROME = 176
const DESKTOP_VERTICAL_CHROME = 96
const DESKTOP_INFO_PANEL_WIDTH = 420
// Keeps the info panel usable when an ultra-wide image renders very short.
const DESKTOP_INFO_PANEL_MIN_HEIGHT = 480
const DESKTOP_MAX_IMAGE_HEIGHT = 920
const MOBILE_HORIZONTAL_CHROME = 32
const MOBILE_FULLSCREEN_IMAGE_CHROME = 136
const MOBILE_PREVIEW_TOP_OFFSET = 88
const MOBILE_PREVIEW_GAP_ABOVE_DRAWER = 24
const MOBILE_PREVIEW_MIN_HEIGHT = 180
const MOBILE_BOTTOM_ACTION_SAFE_SPACE = 16
const MOBILE_DRAWER_HANDLE_HEIGHT = 24
const MOBILE_DETAILS_DRAWER_MAX_HEIGHT = 420
const MOBILE_DETAILS_TRANSITION_MS = 280
const MOBILE_SWIPE_CLOSE_THRESHOLD = 110
const MOBILE_SWIPE_TAP_SLOP = 10
const MOBILE_SWIPE_MAX_OFFSET = 220
const DESKTOP_NAV_BUTTON_SPACE = 176
const loadedDetailImageUrls = new Set<string>()

function getAspectRatioValue(aspectRatio: string) {
    if (aspectRatio.includes("x")) {
        const [width, height] = aspectRatio.split("x").map(Number)
        return width > 0 && height > 0 ? width / height : 1
    }

    if (aspectRatio.includes(":")) {
        const [width, height] = aspectRatio.replace("-hd", "").split(":").map(Number)
        return width > 0 && height > 0 ? width / height : 1
    }

    return 1
}

function fitAspectRatioBox({
    aspectRatioValue,
    maxWidth,
    maxHeight,
    minWidth = 0,
    minHeight = 0
}: {
    aspectRatioValue: number
    maxWidth: number
    maxHeight: number
    minWidth?: number
    minHeight?: number
}) {
    let width = maxWidth
    let height = width / aspectRatioValue

    if (height > maxHeight) {
        height = maxHeight
        width = height * aspectRatioValue
    }

    if (width < minWidth) {
        width = minWidth
        height = width / aspectRatioValue
    }

    if (height < minHeight) {
        height = minHeight
        width = height * aspectRatioValue
    }

    return { width, height }
}

type LibraryLightboxProps = {
    images: GalleryImage[]
    index: number | null
    onClose: () => void
    onNavigate: (index: number) => void
}

export function LibraryLightbox({ images, index, onClose, onNavigate }: LibraryLightboxProps) {
    const isOpen = index !== null
    const [localImage, setLocalImage] = useState<GalleryImage | null>(null)

    const canNavigatePrevious = index !== null && index > 0
    const canNavigateNext = index !== null && index < images.length - 1

    const onPrevious = () => {
        if (index !== null && canNavigatePrevious) {
            onNavigate(index - 1)
        }
    }
    const onNext = () => {
        if (index !== null && canNavigateNext) {
            onNavigate(index + 1)
        }
    }

    useEffect(() => {
        if (index !== null) {
            setLocalImage(images[index] ?? null)
        }

        // Reset transient view state whenever the active image changes (incl. close).
        setIsDetailsOpen(false)
        setIsDetailsPreviewVisible(false)
        setMobileDrawerTop(null)
        setMobileDismissOffset(0)
        setIsPromptCopied(false)
    }, [index, images])

    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [isDetailsPreviewVisible, setIsDetailsPreviewVisible] = useState(false)
    const [isPromptCopied, setIsPromptCopied] = useState(false)
    const [loadState, setLoadState] = useState<"loading" | "revealing" | "ready">("loading")
    const [viewportSize, setViewportSize] = useState(() =>
        typeof window === "undefined"
            ? { width: 1440, height: 900 }
            : { width: window.innerWidth, height: window.innerHeight }
    )
    // Single source of truth for the render path so it can never disagree with
    // the layout math below (768–1099px used to render desktop chrome with
    // mobile sizing).
    const isMobile = viewportSize.width < DESKTOP_BREAKPOINT
    const [mobileDrawerTop, setMobileDrawerTop] = useState<number | null>(null)
    const [mobileDismissOffset, setMobileDismissOffset] = useState(0)
    const revealTimeoutRef = useRef<number | null>(null)
    const copyPromptTimeoutRef = useRef<number | null>(null)
    const imageRef = useRef<HTMLImageElement | null>(null)
    const mobileDrawerRef = useRef<HTMLDivElement | null>(null)
    const mobileSwipeStartYRef = useRef<number | null>(null)
    const mobileSwipeTrackingRef = useRef(false)
    const suppressImageClickRef = useRef(false)

    // Geometry is driven by the real pixel dimensions so arbitrary real images never
    // letterbox; the `aspectRatio` string is only used as a display label.
    const cssAspectRatio = useMemo(() => {
        if (localImage && localImage.width > 0 && localImage.height > 0) {
            return `${localImage.width}/${localImage.height}`
        }
        return "1/1"
    }, [localImage])

    const aspectRatioValue = useMemo(() => {
        if (localImage && localImage.width > 0 && localImage.height > 0) {
            return localImage.width / localImage.height
        }
        return getAspectRatioValue(localImage?.aspectRatio || "1:1")
    }, [localImage])
    const renderedImageUrl = localImage ? (localImage.fullImg ?? localImage.img) : ""

    const prefetchImageUrls = useMemo(() => {
        if (index === null) {
            return []
        }

        return [images[index - 1], images[index + 1]]
            .filter((item): item is GalleryImage => Boolean(item))
            .map((item) => item.fullImg ?? item.img)
    }, [images, index])

    useEffect(() => {
        if (!localImage || !isOpen) return

        if (revealTimeoutRef.current !== null) {
            window.clearTimeout(revealTimeoutRef.current)
            revealTimeoutRef.current = null
        }

        if (loadedDetailImageUrls.has(renderedImageUrl)) {
            setLoadState("ready")
            return
        }

        setLoadState("loading")

        const syncCachedImageState = window.requestAnimationFrame(() => {
            const imageElement = imageRef.current
            if (!imageElement?.complete || imageElement.naturalWidth <= 0) {
                return
            }

            loadedDetailImageUrls.add(renderedImageUrl)
            setLoadState("ready")
        })

        return () => {
            window.cancelAnimationFrame(syncCachedImageState)
            if (revealTimeoutRef.current !== null) {
                window.clearTimeout(revealTimeoutRef.current)
                revealTimeoutRef.current = null
            }
            if (copyPromptTimeoutRef.current !== null) {
                window.clearTimeout(copyPromptTimeoutRef.current)
                copyPromptTimeoutRef.current = null
            }
        }
    }, [isOpen, localImage, renderedImageUrl])

    useEffect(() => {
        if (!isOpen || typeof window === "undefined") return

        const updateViewportSize = () => {
            setViewportSize({ width: window.innerWidth, height: window.innerHeight })
        }

        updateViewportSize()
        window.addEventListener("resize", updateViewportSize)

        return () => window.removeEventListener("resize", updateViewportSize)
    }, [isOpen])

    useEffect(() => {
        if (!isOpen || typeof window === "undefined" || prefetchImageUrls.length === 0) {
            return
        }

        const prefetchedImages = prefetchImageUrls
            .filter((url) => url && !loadedDetailImageUrls.has(url))
            .map((url) => {
                const image = new window.Image()
                image.decoding = "async"
                image.onload = () => {
                    loadedDetailImageUrls.add(url)
                }
                image.src = url
                return image
            })

        return () => {
            for (const image of prefetchedImages) {
                image.onload = null
                image.onerror = null
            }
        }
    }, [isOpen, prefetchImageUrls])

    const layout = useMemo(() => {
        const isDesktop = viewportSize.width >= DESKTOP_BREAKPOINT

        if (isDesktop) {
            const maxImageHeight = Math.max(
                320,
                Math.min(DESKTOP_MAX_IMAGE_HEIGHT, viewportSize.height - DESKTOP_VERTICAL_CHROME)
            )
            const maxImageWidth = Math.max(
                320,
                viewportSize.width -
                    DESKTOP_INFO_PANEL_WIDTH -
                    DESKTOP_GAP -
                    DESKTOP_HORIZONTAL_CHROME
            )
            const imageHeight = Math.min(maxImageHeight, maxImageWidth / aspectRatioValue)
            const imageWidth = imageHeight * aspectRatioValue
            const infoHeight = Math.max(
                imageHeight,
                Math.min(maxImageHeight, DESKTOP_INFO_PANEL_MIN_HEIGHT)
            )

            return {
                isDesktop: true,
                imageWidth,
                imageHeight,
                infoHeight,
                mobileFullscreenImage: { width: imageWidth, height: imageHeight },
                mobilePreviewImage: { width: imageWidth, height: imageHeight },
                mobileDetailsMaxHeight: 0,
                infoWidth: DESKTOP_INFO_PANEL_WIDTH,
                shellWidth: imageWidth + DESKTOP_GAP + DESKTOP_INFO_PANEL_WIDTH
            }
        }

        const fullscreenImage = fitAspectRatioBox({
            aspectRatioValue,
            maxWidth: Math.max(280, viewportSize.width - MOBILE_HORIZONTAL_CHROME),
            maxHeight: Math.max(240, viewportSize.height - MOBILE_FULLSCREEN_IMAGE_CHROME)
        })
        const mobileDetailsMaxHeight = Math.min(
            MOBILE_DETAILS_DRAWER_MAX_HEIGHT,
            viewportSize.height * 0.54
        )
        const fallbackDrawerTop =
            viewportSize.height - mobileDetailsMaxHeight - MOBILE_DRAWER_HANDLE_HEIGHT
        const resolvedDrawerTop =
            mobileDrawerTop === null
                ? fallbackDrawerTop
                : Math.min(mobileDrawerTop, fallbackDrawerTop)
        const mobilePreviewMaxHeight = Math.max(
            MOBILE_PREVIEW_MIN_HEIGHT,
            resolvedDrawerTop -
                MOBILE_PREVIEW_TOP_OFFSET -
                MOBILE_PREVIEW_GAP_ABOVE_DRAWER -
                MOBILE_BOTTOM_ACTION_SAFE_SPACE
        )
        const previewImage = fitAspectRatioBox({
            aspectRatioValue,
            maxWidth: Math.max(220, viewportSize.width - MOBILE_HORIZONTAL_CHROME),
            maxHeight: mobilePreviewMaxHeight
        })

        return {
            isDesktop: false,
            imageWidth: fullscreenImage.width,
            imageHeight: fullscreenImage.height,
            infoHeight: fullscreenImage.height,
            mobileFullscreenImage: fullscreenImage,
            mobilePreviewImage: previewImage,
            mobileDetailsMaxHeight,
            mobileDrawerTop: resolvedDrawerTop,
            infoWidth: fullscreenImage.width,
            shellWidth: fullscreenImage.width
        }
    }, [aspectRatioValue, mobileDrawerTop, viewportSize.height, viewportSize.width])

    const showDesktopNavButtons =
        layout.isDesktop &&
        viewportSize.width >= layout.shellWidth + DESKTOP_NAV_BUTTON_SPACE &&
        (canNavigatePrevious || canNavigateNext)

    const handleImageLoad = () => {
        if (loadedDetailImageUrls.has(renderedImageUrl)) {
            setLoadState("ready")
            return
        }

        loadedDetailImageUrls.add(renderedImageUrl)
        setLoadState("revealing")

        if (revealTimeoutRef.current !== null) {
            window.clearTimeout(revealTimeoutRef.current)
        }

        revealTimeoutRef.current = window.setTimeout(() => {
            setLoadState("ready")
            revealTimeoutRef.current = null
        }, 240)
    }

    const handleViewFullResolution = () => {
        if (renderedImageUrl) {
            window.open(renderedImageUrl, "_blank", "noopener")
        }
    }

    const handleDownload = async () => {
        if (!renderedImageUrl || !localImage) return

        try {
            await downloadUrl({
                url: renderedImageUrl,
                fileName:
                    new URL(renderedImageUrl, window.location.href).pathname.split("/").pop() ||
                    `${localImage.id}.webp`
            })
        } catch (error) {
            console.error("Failed to download image:", error)
            toast.error("Failed to download image")
        }
    }

    const handleCopyPrompt = () => {
        const prompt = localImage?.prompt?.trim()
        if (!prompt) return

        navigator.clipboard.writeText(prompt)
        setIsPromptCopied(true)
        if (copyPromptTimeoutRef.current !== null) {
            window.clearTimeout(copyPromptTimeoutRef.current)
        }
        copyPromptTimeoutRef.current = window.setTimeout(() => {
            setIsPromptCopied(false)
            copyPromptTimeoutRef.current = null
        }, 1500)
    }

    const closeMobileDetailsOrViewer = () => {
        if (isDetailsOpen) {
            setIsDetailsOpen(false)
            return
        }

        onClose()
    }

    const openDetailsDrawer = () => {
        setIsDetailsPreviewVisible(true)
        setMobileDrawerTop(layout.mobileDrawerTop ?? null)
        window.requestAnimationFrame(() => setIsDetailsOpen(true))
    }

    const handleMobileImageTouchStart = (event: ReactTouchEvent<HTMLButtonElement>) => {
        if (isDetailsOpen || isDetailsPreviewVisible || event.touches.length !== 1) {
            mobileSwipeStartYRef.current = null
            mobileSwipeTrackingRef.current = false
            return
        }

        mobileSwipeStartYRef.current = event.touches[0]?.clientY ?? null
        mobileSwipeTrackingRef.current = true
        suppressImageClickRef.current = false
    }

    const handleMobileImageTouchMove = (event: ReactTouchEvent<HTMLButtonElement>) => {
        if (!mobileSwipeTrackingRef.current || mobileSwipeStartYRef.current === null) {
            return
        }

        const currentY = event.touches[0]?.clientY
        if (currentY === undefined) return

        const offset = Math.max(
            0,
            Math.min(MOBILE_SWIPE_MAX_OFFSET, currentY - mobileSwipeStartYRef.current)
        )
        setMobileDismissOffset(offset)

        if (offset > MOBILE_SWIPE_TAP_SLOP) {
            suppressImageClickRef.current = true
        }
    }

    const handleMobileImageTouchEnd = () => {
        mobileSwipeTrackingRef.current = false
        mobileSwipeStartYRef.current = null

        if (mobileDismissOffset >= MOBILE_SWIPE_CLOSE_THRESHOLD) {
            setMobileDismissOffset(0)
            onClose()
            return
        }

        setMobileDismissOffset(0)
    }

    useEffect(() => {
        if (isDetailsPreviewVisible || isDetailsOpen) {
            setMobileDismissOffset(0)
        }
    }, [isDetailsOpen, isDetailsPreviewVisible])

    useEffect(() => {
        if (isDetailsOpen || !isDetailsPreviewVisible) return

        const timeoutId = window.setTimeout(() => {
            setIsDetailsPreviewVisible(false)
            setMobileDrawerTop(null)
        }, MOBILE_DETAILS_TRANSITION_MS)

        return () => window.clearTimeout(timeoutId)
    }, [isDetailsOpen, isDetailsPreviewVisible])

    useEffect(() => {
        if (!isMobile || !isOpen || !isDetailsOpen || typeof window === "undefined") {
            setMobileDrawerTop(null)
            return
        }

        let frameId = 0
        let previousTop = -1

        const updateDrawerTop = () => {
            const nextTop = mobileDrawerRef.current?.getBoundingClientRect().top ?? null
            if (nextTop !== null && Math.abs(nextTop - previousTop) > 0.5) {
                previousTop = nextTop
                setMobileDrawerTop(nextTop)
            }

            frameId = window.requestAnimationFrame(updateDrawerTop)
        }

        frameId = window.requestAnimationFrame(updateDrawerTop)

        return () => window.cancelAnimationFrame(frameId)
    }, [isDetailsOpen, isMobile, isOpen])

    useEffect(() => {
        if (!isOpen || isMobile || index === null) return

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
                return
            }

            if (event.key === "ArrowLeft" && canNavigatePrevious) {
                event.preventDefault()
                onNavigate(index - 1)
            }

            if (event.key === "ArrowRight" && canNavigateNext) {
                event.preventDefault()
                onNavigate(index + 1)
            }
        }

        window.addEventListener("keydown", handleKeyDown)

        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [canNavigateNext, canNavigatePrevious, isMobile, isOpen, index, onNavigate])

    if (!localImage) return null

    const formattedDate = new Date(localImage.createdAt).toLocaleDateString()

    const metadataGrid = (
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-border/60 border-t pt-6">
            <div>
                <h4 className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
                    Model
                </h4>
                <p className="text-sm">{localImage.model}</p>
            </div>
            <div>
                <h4 className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
                    Aspect Ratio
                </h4>
                <p className="text-sm">{localImage.aspectRatio}</p>
            </div>
            <div>
                <h4 className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
                    Resolution
                </h4>
                <p className="text-sm">{localImage.resolution}</p>
            </div>
            <div>
                <h4 className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-[0.18em]">
                    Date
                </h4>
                <p className="text-sm">{formattedDate}</p>
            </div>
        </div>
    )

    const actionBar = (
        <div className="flex flex-nowrap items-center gap-3">
            <Button variant="outline" className="min-w-0 flex-1" onClick={handleViewFullResolution}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Full Resolution
            </Button>
            <Button
                variant="secondary"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={handleDownload}
                aria-label="Download image"
            >
                <Download className="h-4 w-4" />
                <span className="sr-only">Download</span>
            </Button>
            <Button
                variant={isPromptCopied ? "secondary" : "outline"}
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={handleCopyPrompt}
                aria-label={isPromptCopied ? "Prompt copied" : "Copy prompt"}
            >
                {isPromptCopied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                <span className="sr-only">{isPromptCopied ? "Copied" : "Copy Prompt"}</span>
            </Button>
        </div>
    )

    if (isMobile) {
        const isDetailsExpanded = isDetailsPreviewVisible || isDetailsOpen

        return (
            <Dialog open={isOpen} onOpenChange={(open) => !open && closeMobileDetailsOrViewer()}>
                <DialogContent
                    showCloseButton={false}
                    overlayClassName="bg-black/92 backdrop-blur-md"
                    className="pointer-events-none inset-0 z-[70] h-[100dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none"
                    onInteractOutside={(event) => {
                        event.preventDefault()
                        closeMobileDetailsOrViewer()
                    }}
                    onEscapeKeyDown={(event) => {
                        if (isDetailsOpen) {
                            event.preventDefault()
                            setIsDetailsOpen(false)
                        }
                    }}
                >
                    <DialogHeader className="sr-only">
                        <DialogTitle>Image preview</DialogTitle>
                        <DialogDescription>Viewing a generated image.</DialogDescription>
                    </DialogHeader>
                    <div
                        className="pointer-events-none relative h-full w-full transition-opacity duration-200 ease-out"
                        style={{ opacity: Math.max(0.6, 1 - mobileDismissOffset / 260) }}
                    >
                        <div className="absolute top-[calc(env(safe-area-inset-top)+1rem)] right-4 left-4 z-20 flex items-center justify-end">
                            <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                className="pointer-events-auto h-8 w-8 border border-border/70 bg-background/80 text-foreground shadow-lg backdrop-blur-md transition-all hover:bg-background"
                                onClick={onClose}
                            >
                                <span className="sr-only">Close</span>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div
                            className={cn(
                                "absolute inset-x-0 transition-[top,bottom] duration-300 ease-out",
                                isDetailsExpanded
                                    ? "top-[calc(env(safe-area-inset-top)+4.5rem)]"
                                    : "top-[calc(env(safe-area-inset-top)+4rem)] bottom-[calc(env(safe-area-inset-bottom)+4.5rem)]"
                            )}
                        >
                            <div
                                className={cn(
                                    "flex h-full w-full justify-center px-4 transition-[align-items] duration-300 ease-out",
                                    isDetailsExpanded ? "items-start" : "items-center"
                                )}
                            >
                                <button
                                    type="button"
                                    className="pointer-events-auto relative flex items-center justify-center overflow-hidden rounded-[var(--radius-xl)] outline-none transition-[width,height,transform] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-primary"
                                    style={{
                                        width: isDetailsExpanded
                                            ? layout.mobilePreviewImage.width
                                            : layout.mobileFullscreenImage.width,
                                        height: isDetailsExpanded
                                            ? layout.mobilePreviewImage.height
                                            : layout.mobileFullscreenImage.height,
                                        maxWidth: "100%",
                                        maxHeight: "100%",
                                        willChange: "width, height, transform",
                                        transform: `translateY(${mobileDismissOffset}px)`
                                    }}
                                    onTouchStart={handleMobileImageTouchStart}
                                    onTouchMove={handleMobileImageTouchMove}
                                    onTouchEnd={handleMobileImageTouchEnd}
                                    onTouchCancel={handleMobileImageTouchEnd}
                                >
                                    <span className="sr-only">Generated image</span>
                                    {loadState !== "ready" && (
                                        <div className="absolute inset-0 z-10 bg-gradient-to-br from-muted/85 via-muted/65 to-accent/20" />
                                    )}
                                    {loadState !== "ready" && (
                                        <ImageLoadIndicator complete={loadState === "revealing"} />
                                    )}
                                    <img
                                        ref={imageRef}
                                        src={renderedImageUrl}
                                        alt={localImage.prompt}
                                        className={cn(
                                            "h-full w-full rounded-[var(--radius-xl)] object-contain shadow-2xl transition-all duration-500",
                                            loadState === "loading" &&
                                                "scale-[1.02] opacity-0 blur-xl",
                                            loadState === "revealing" &&
                                                "scale-[1.01] opacity-100 blur-md",
                                            loadState === "ready" && "scale-100 opacity-100 blur-0"
                                        )}
                                        style={{ aspectRatio: cssAspectRatio }}
                                        onLoad={handleImageLoad}
                                    />
                                </button>
                            </div>
                        </div>

                        {!isDetailsExpanded && (
                            <div className="pointer-events-none absolute right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-4 z-20 flex justify-center">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="pointer-events-auto h-9 rounded-[var(--radius-xl)] border border-border/70 bg-background/80 px-4 text-foreground text-sm shadow-lg backdrop-blur-md transition-all hover:bg-background"
                                    onClick={openDetailsDrawer}
                                >
                                    View Details
                                </Button>
                            </div>
                        )}

                        <Drawer
                            open={isDetailsOpen}
                            onOpenChange={setIsDetailsOpen}
                            nested
                            modal={false}
                        >
                            <DrawerContent
                                ref={mobileDrawerRef}
                                className="z-[80] max-h-[80dvh] min-h-0 overflow-hidden border-border/60 bg-background/98 backdrop-blur-xl"
                                overlayClassName="z-[79] bg-transparent"
                                onInteractOutside={(event) => {
                                    event.preventDefault()
                                    setIsDetailsOpen(false)
                                }}
                                style={{ maxHeight: `${layout.mobileDetailsMaxHeight}px` }}
                            >
                                <DrawerHeader className="shrink-0 text-left">
                                    <DrawerTitle>Image Details</DrawerTitle>
                                    <DrawerDescription>Metadata for this image.</DrawerDescription>
                                </DrawerHeader>
                                <div
                                    data-vaul-no-drag
                                    className="min-h-0 flex-1 touch-pan-y space-y-6 overflow-y-auto overscroll-contain px-5 pb-4"
                                    onTouchMoveCapture={(event) => event.stopPropagation()}
                                >
                                    <div>
                                        <h3 className="mb-2 font-semibold text-xl">Prompt</h3>
                                        <p className="whitespace-pre-wrap text-muted-foreground text-sm leading-relaxed">
                                            {localImage.prompt}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-border/60 border-t pt-2">
                                        <div>
                                            <h4 className="mb-1 font-medium text-[0.625rem] text-muted-foreground uppercase tracking-[0.18em]">
                                                Model
                                            </h4>
                                            <p className="font-medium text-xs">
                                                {localImage.model}
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="mb-1 font-medium text-[0.625rem] text-muted-foreground uppercase tracking-[0.18em]">
                                                Aspect Ratio
                                            </h4>
                                            <p className="font-medium text-xs">
                                                {localImage.aspectRatio}
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="mb-1 font-medium text-[0.625rem] text-muted-foreground uppercase tracking-[0.18em]">
                                                Resolution
                                            </h4>
                                            <p className="font-medium text-xs">
                                                {localImage.resolution}
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="mb-1 font-medium text-[0.625rem] text-muted-foreground uppercase tracking-[0.18em]">
                                                Date
                                            </h4>
                                            <p className="font-medium text-xs">{formattedDate}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="border-border/60 border-t bg-background px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                                    {actionBar}
                                </div>
                            </DrawerContent>
                        </Drawer>
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={false}
                overlayClassName="backdrop-blur-md"
                className="w-fit max-w-none border-0 bg-transparent p-0 shadow-none sm:max-w-none"
            >
                <DialogHeader className="sr-only">
                    <DialogTitle>Image Details</DialogTitle>
                    <DialogDescription>Viewing details of a generated image.</DialogDescription>
                </DialogHeader>
                <div
                    className={cn(
                        "relative mx-auto flex items-center",
                        layout.isDesktop ? "flex-row gap-6" : "flex-col gap-4"
                    )}
                    style={{ width: layout.shellWidth }}
                >
                    {showDesktopNavButtons && (
                        <>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="-left-[4.5rem] -translate-y-1/2 absolute top-1/2 z-20 h-11 w-11 rounded-lg border-border/70 bg-background/85 text-foreground shadow-lg backdrop-blur-md hover:bg-accent/80 disabled:pointer-events-none disabled:opacity-35"
                                onClick={onPrevious}
                                disabled={!canNavigatePrevious}
                            >
                                <span className="sr-only">Previous image</span>
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="-right-[4.5rem] -translate-y-1/2 absolute top-1/2 z-20 h-11 w-11 rounded-lg border-border/70 bg-background/85 text-foreground shadow-lg backdrop-blur-md hover:bg-accent/80 disabled:pointer-events-none disabled:opacity-35"
                                onClick={onNext}
                                disabled={!canNavigateNext}
                            >
                                <span className="sr-only">Next image</span>
                                <ChevronRight className="h-5 w-5" />
                            </Button>
                        </>
                    )}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="-top-14 lg:-right-[4.5rem] absolute right-0 z-20 h-11 w-11 rounded-lg border border-border/70 bg-background/85 text-foreground shadow-lg backdrop-blur-sm hover:bg-accent lg:top-0"
                        onClick={onClose}
                    >
                        <span className="sr-only">Close</span>
                        <X className="h-4 w-4" />
                    </Button>

                    <div
                        className="relative shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/35 shadow-2xl"
                        style={{ width: layout.imageWidth, height: layout.imageHeight }}
                    >
                        {loadState !== "ready" && (
                            <div className="absolute inset-0 z-10 bg-gradient-to-br from-muted/85 via-muted/65 to-accent/20" />
                        )}
                        {loadState !== "ready" && (
                            <div className="absolute inset-x-0 bottom-4 z-10 mx-4 space-y-2 rounded-lg border border-border/50 bg-background/55 p-3 backdrop-blur-sm">
                                <div className="h-3 w-32 rounded bg-background/70" />
                                <div className="h-3 w-24 rounded bg-background/45" />
                            </div>
                        )}
                        {loadState !== "ready" && (
                            <ImageLoadIndicator complete={loadState === "revealing"} />
                        )}
                        <img
                            ref={imageRef}
                            src={renderedImageUrl}
                            alt={localImage.prompt}
                            className={cn(
                                "h-full w-full object-contain transition-all duration-500",
                                loadState === "loading" && "scale-[1.02] opacity-0 blur-xl",
                                loadState === "revealing" && "scale-[1.01] opacity-100 blur-md",
                                loadState === "ready" && "scale-100 opacity-100 blur-0"
                            )}
                            style={{ aspectRatio: cssAspectRatio }}
                            onLoad={handleImageLoad}
                        />
                    </div>

                    <div
                        className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur-md"
                        style={{
                            width: layout.infoWidth,
                            height: layout.isDesktop ? layout.infoHeight : undefined,
                            minHeight: layout.isDesktop ? layout.infoHeight : undefined
                        }}
                    >
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="mb-6">
                                <h3 className="mb-3 font-semibold text-2xl">Prompt</h3>
                                <p className="whitespace-pre-wrap text-base text-muted-foreground leading-7">
                                    {localImage.prompt}
                                </p>
                            </div>
                            {metadataGrid}
                        </div>
                        <div className="border-border/60 border-t p-4">{actionBar}</div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
