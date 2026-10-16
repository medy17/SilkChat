import { useImageViewerLoad } from "@/hooks/use-image-viewer-load"
import { useImageViewerActions } from "@/hooks/use-image-viewer-actions"
import { ImageLoadIndicator } from "@/components/library/image-load-indicator"
import {
    ImageMetadataPanel,
    ReferenceImageThumbnails
} from "@/components/library/image-metadata-panel"
import { usePrivateViewingStore } from "@/components/library/private-viewing-store"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog"
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
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import {
    getNextGeneratedImageRecoveryPhase,
    resolveGeneratedImageRenderSource
} from "@/lib/generated-image-recovery"
import {
    getExpandedImageUrl,
    getGeneratedImageDirectUrl,
    getGeneratedImageProxyUrl
} from "@/lib/generated-image-urls"
import { playExpandedImageDismissHaptic } from "@/lib/haptics"
import {
    type TransparentBackdrop,
    getTransparentBackdropClassName
} from "@/lib/transparent-backdrop"
import { fitImageAspectRatioBox, getImageAspectRatioValue } from "@/lib/image-aspect-ratios"
import { matchesNextImageShortcut, matchesPreviousImageShortcut } from "@/lib/keyboard-shortcuts"
import { getIsImageHidden } from "@/lib/private-viewing"
import { useSharedModels } from "@/lib/shared-models"
import { cn } from "@/lib/utils"
import { useAction, useConvex, useMutation } from "convex/react"
import {
    Archive,
    Check,
    ChevronLeft,
    ChevronRight,
    Clipboard,
    Download,
    ExternalLink,
    RotateCcw,
    Trash2,
    X
} from "lucide-react"
import {
    type CSSProperties,
    type TouchEvent as ReactTouchEvent,
    memo,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import { flushSync } from "react-dom"

interface ImageDetailsModalProps {
    image: Doc<"generatedImages"> | null
    isOpen: boolean
    onClose: () => void
    isArchivedView?: boolean
    onPrevious?: () => void
    onNext?: () => void
    canNavigatePrevious?: boolean
    canNavigateNext?: boolean
    prefetchImageUrls?: string[]
    onDeleteStart?: (id: Id<"generatedImages">) => void
    onArchiveStart?: (id: Id<"generatedImages">) => void
    onRestoreStart?: (id: Id<"generatedImages">) => void
}

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
const MOBILE_PREVIEW_TOP_GAP = 8
const MOBILE_PREVIEW_GAP_ABOVE_DRAWER = 24
const MOBILE_PREVIEW_MIN_HEIGHT = 180
const MOBILE_DRAWER_HANDLE_HEIGHT = 24
const MOBILE_DETAILS_DRAWER_MAX_HEIGHT = 420
// Vaul's drawer transition, so the image and the details drawer move as one.
const MOBILE_DRAWER_DURATION_MS = 500
const MOBILE_DRAWER_EASING = `${MOBILE_DRAWER_DURATION_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`
const MOBILE_IMAGE_TRANSITION = `transform ${MOBILE_DRAWER_EASING}, border-radius ${MOBILE_DRAWER_EASING}`
// Vaul's release rules: close past a quarter of the dragged element's height,
// or when the whole gesture averaged faster than 0.4px/ms.
const MOBILE_SWIPE_CLOSE_THRESHOLD_RATIO = 0.25
const MOBILE_SWIPE_VELOCITY_THRESHOLD = 0.4
const MOBILE_SWIPE_TAP_SLOP = 10

// Vaul's rubber band for dragging against the dismiss direction.
function dampenSwipeDistance(distance: number) {
    return 8 * (Math.log(distance + 1) - 2)
}
const DESKTOP_NAV_BUTTON_SPACE = 176
const loadedDetailImageUrls = new Set<string>()

export const ImageDetailsModal = memo(function ImageDetailsModal({
    image,
    isOpen,
    onClose,
    isArchivedView = false,
    onPrevious,
    onNext,
    canNavigatePrevious = false,
    canNavigateNext = false,
    prefetchImageUrls = [],
    onDeleteStart,
    onArchiveStart,
    onRestoreStart
}: ImageDetailsModalProps) {
    const { models } = useSharedModels()
    const convex = useConvex()
    const deleteImage = useAction(api.images_node.deleteGeneratedImage)
    const archiveImage = useMutation(api.images.archiveGeneratedImage)
    const restoreImage = useMutation(api.images.restoreGeneratedImage)
    const privateViewingEnabled = usePrivateViewingStore((state) => state.privateViewingEnabled)
    const imageOverrides = usePrivateViewingStore((state) => state.imageOverrides)
    const [localImage, setLocalImage] = useState(image)
    // View-only and keyed to the image, so navigating to another image resets to checker.
    const [backdropChoice, setBackdropChoice] = useState<{
        imageId?: string
        backdrop: TransparentBackdrop
    }>({ backdrop: "checker" })
    const transparentBackdrop =
        backdropChoice.imageId === image?._id ? backdropChoice.backdrop : "checker"
    const setTransparentBackdrop = (backdrop: TransparentBackdrop) =>
        setBackdropChoice({ imageId: image?._id, backdrop })
    const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null)
    const [isModalImageHidden, setIsModalImageHidden] = useState(false)
    useEffect(() => {
        if (image) {
            setLocalImage(image)
        }
    }, [image])

    useEffect(() => {
        let cancelled = false

        if (!localImage) {
            setMetadata(null)
            return
        }

        convex
            .query(api.attachments.getFileMetadata, { key: localImage.storageKey })
            .then((result) => {
                if (!cancelled) {
                    setMetadata(result)
                }
            })
            .catch((error) => {
                console.error("Failed to load image metadata:", error)
                if (!cancelled) {
                    setMetadata(null)
                }
            })

        return () => {
            cancelled = true
        }
    }, [convex, localImage])

    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [imageRecoveryPhase, setImageRecoveryPhase] = useState<"primary" | "fallback">("primary")
    const [viewportSize, setViewportSize] = useState(() =>
        typeof window === "undefined"
            ? { width: 1440, height: 900 }
            : { width: window.innerWidth, height: window.innerHeight }
    )
    // Single source of truth for the render path so it can never disagree with
    // the layout math below (768–1099px used to render desktop chrome with
    // mobile sizing).
    const isMobile = viewportSize.width < DESKTOP_BREAKPOINT
    const [mobileDismissOffset, setMobileDismissOffset] = useState(0)
    const [isSwipeDragging, setIsSwipeDragging] = useState(false)
    const [isSwipeDismissing, setIsSwipeDismissing] = useState(false)
    const swipeCloseTimeoutRef = useRef<number | null>(null)
    const mobileSwipeStartTimeRef = useRef(0)
    // Callback-ref elements: both live in portals that mount after this component commits.
    const [mobileStageElement, setMobileStageElement] = useState<HTMLDivElement | null>(null)
    const [mobileDrawerElement, setMobileDrawerElement] = useState<HTMLDivElement | null>(null)
    const [mobileStageRect, setMobileStageRect] = useState<{ top: number; height: number } | null>(
        null
    )
    const [mobileDrawerHeight, setMobileDrawerHeight] = useState<number | null>(null)
    const mobileImageRef = useRef<HTMLButtonElement | null>(null)
    const mobileSwipeStartYRef = useRef<number | null>(null)
    const mobileSwipeTrackingRef = useRef(false)
    const mobileSwipeUnlockHapticPlayedRef = useRef(false)
    const suppressImageClickRef = useRef(false)

    useEffect(() => {
        setImageRecoveryPhase("primary")
    }, [image?.storageKey])

    const aspectRatio = localImage?.aspectRatio || "1:1"
    const cssAspectRatio = useMemo(() => {
        if (aspectRatio.includes("x")) {
            const [width, height] = aspectRatio.split("x").map(Number)
            return `${width}/${height}`
        }
        if (aspectRatio.includes(":")) {
            const baseRatio = aspectRatio.replace("-hd", "")
            return baseRatio.replace(":", "/")
        }
        return "1/1"
    }, [aspectRatio])

    const aspectRatioValue = useMemo(() => getImageAspectRatioValue(aspectRatio), [aspectRatio])
    const optimizedImageUrl = localImage
        ? getExpandedImageUrl({
              storageKey: localImage.storageKey,
              aspectRatio: localImage.aspectRatio
          })
        : ""
    const directImageUrl = localImage ? getGeneratedImageDirectUrl(localImage.storageKey) : ""
    const renderedImageSource = resolveGeneratedImageRenderSource({
        phase: imageRecoveryPhase,
        primary: {
            src: optimizedImageUrl
        },
        fallback: {
            directSrc: directImageUrl
        }
    })
    const renderedImageUrl = renderedImageSource.src

    const { imageRef, loadState, handleImageLoad, handleImageFailure } = useImageViewerLoad({
        url: renderedImageUrl,
        enabled: isOpen && !!localImage,
        cache: loadedDetailImageUrls,
        revealMs: 240
    })
    const fullResolutionUrl =
        directImageUrl || (localImage ? getGeneratedImageProxyUrl(localImage.storageKey) : "")
    const { isPromptCopied, handleCopyPrompt, handleDownload } = useImageViewerActions({
        url: fullResolutionUrl,
        storageKey: localImage?.storageKey,
        prompt: localImage?.prompt,
        fallbackFileName: "silkchat-image",
        resetKey: localImage?._id,
        enabled: isOpen && !!localImage
    })

    useEffect(() => {
        if (!isOpen || typeof window === "undefined") return

        const updateViewportSize = () => {
            setViewportSize({
                width: window.innerWidth,
                height: window.innerHeight
            })
        }

        updateViewportSize()
        window.addEventListener("resize", updateViewportSize)

        return () => {
            window.removeEventListener("resize", updateViewportSize)
        }
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
                mobileDetailsMaxHeight: 0,
                infoWidth: DESKTOP_INFO_PANEL_WIDTH,
                shellWidth: imageWidth + DESKTOP_GAP + DESKTOP_INFO_PANEL_WIDTH
            }
        }

        const fullscreenImage = fitImageAspectRatioBox({
            aspectRatioValue,
            maxWidth: Math.max(280, viewportSize.width - MOBILE_HORIZONTAL_CHROME),
            maxHeight: Math.max(240, viewportSize.height - MOBILE_FULLSCREEN_IMAGE_CHROME)
        })
        const mobileDetailsMaxHeight = Math.min(
            MOBILE_DETAILS_DRAWER_MAX_HEIGHT,
            viewportSize.height * 0.54
        )

        return {
            isDesktop: false,
            imageWidth: fullscreenImage.width,
            imageHeight: fullscreenImage.height,
            infoHeight: fullscreenImage.height,
            mobileFullscreenImage: fullscreenImage,
            mobileDetailsMaxHeight,
            infoWidth: fullscreenImage.width,
            shellWidth: fullscreenImage.width
        }
    }, [aspectRatioValue, viewportSize.height, viewportSize.width])

    // With details open, the image shrinks into the space between the close
    // button and the drawer. It is expressed as a transform from the fullscreen
    // pose so it can ride the drawer's own easing instead of re-laying out.
    const mobileDetailsPose = useMemo(() => {
        if (!mobileStageRect) return { scale: 1, translateY: 0 }

        const drawerHeight =
            mobileDrawerHeight ?? layout.mobileDetailsMaxHeight + MOBILE_DRAWER_HANDLE_HEIGHT
        const regionTop = mobileStageRect.top + MOBILE_PREVIEW_TOP_GAP
        const regionBottom = viewportSize.height - drawerHeight - MOBILE_PREVIEW_GAP_ABOVE_DRAWER
        const previewImage = fitImageAspectRatioBox({
            aspectRatioValue,
            maxWidth: Math.max(220, viewportSize.width - MOBILE_HORIZONTAL_CHROME),
            maxHeight: Math.max(MOBILE_PREVIEW_MIN_HEIGHT, regionBottom - regionTop)
        })

        return {
            scale: Math.min(1, previewImage.width / layout.mobileFullscreenImage.width),
            translateY:
                (regionTop + regionBottom) / 2 - (mobileStageRect.top + mobileStageRect.height / 2)
        }
    }, [
        aspectRatioValue,
        layout.mobileDetailsMaxHeight,
        layout.mobileFullscreenImage.width,
        mobileDrawerHeight,
        mobileStageRect,
        viewportSize.height,
        viewportSize.width
    ])

    // progress: 0 = fullscreen, 1 = resting above the open drawer.
    const getMobileImagePose = (progress: number, dismissOffset = 0) => {
        const scale = 1 + (mobileDetailsPose.scale - 1) * progress
        return {
            transform: `translate3d(0, ${mobileDetailsPose.translateY * progress + dismissOffset}px, 0) scale(${scale})`,
            // Counter-scaled so the corners stay at the theme radius while shrunk.
            borderRadius: `calc(var(--radius-xl) / ${scale})`
        }
    }

    // Vaul drives its drag imperatively, so mirror it on the DOM node rather
    // than re-rendering the whole viewer on every pointer move.
    const handleDetailsDrawerDrag = (_event: unknown, percentageDragged: number) => {
        const element = mobileImageRef.current
        if (!element) return

        const pose = getMobileImagePose(1 - Math.min(1, Math.max(0, percentageDragged)))
        element.style.transition = "none"
        element.style.transform = pose.transform
        element.style.borderRadius = pose.borderRadius
    }

    const handleDetailsDrawerRelease = (_event: unknown, open: boolean) => {
        const element = mobileImageRef.current
        if (!element) return

        const pose = getMobileImagePose(open ? 1 : 0)
        element.style.transition = MOBILE_IMAGE_TRANSITION
        element.style.transform = pose.transform
        element.style.borderRadius = pose.borderRadius
    }

    const showDesktopNavButtons =
        layout.isDesktop &&
        viewportSize.width >= layout.shellWidth + DESKTOP_NAV_BUTTON_SPACE &&
        (canNavigatePrevious || canNavigateNext)

    const initialImageHidden = localImage
        ? getIsImageHidden({
              privateViewingEnabled,
              override: imageOverrides[localImage._id]
          })
        : false

    const handleImageError = () => {
        const nextPhase = getNextGeneratedImageRecoveryPhase(imageRecoveryPhase)
        handleImageFailure(nextPhase !== "error")
        if (nextPhase !== "error") setImageRecoveryPhase(nextPhase)
    }

    const handleViewFullResolution = () => {
        window.open(fullResolutionUrl, "_blank")
    }

    const handleToggleImageVisibility = () => {
        if (suppressImageClickRef.current) {
            suppressImageClickRef.current = false
            return
        }

        setIsModalImageHidden((current) => !current)
    }

    const closeMobileDetailsOrViewer = () => {
        if (isDetailsOpen) {
            setIsDetailsOpen(false)
            return
        }

        onClose()
    }

    // Swipe-to-dismiss mirrors vaul's drawer gesture: 1:1 tracking downward,
    // a log rubber band upward, and on release close if the whole gesture was
    // fast enough or dragged past a quarter of the image's height.
    const mobileSwipeCloseThreshold =
        layout.mobileFullscreenImage.height * MOBILE_SWIPE_CLOSE_THRESHOLD_RATIO

    const handleMobileImageTouchStart = (event: ReactTouchEvent<HTMLButtonElement>) => {
        if (isDetailsOpen || isSwipeDismissing || event.touches.length !== 1) {
            mobileSwipeStartYRef.current = null
            mobileSwipeTrackingRef.current = false
            mobileSwipeUnlockHapticPlayedRef.current = false
            return
        }

        mobileSwipeStartYRef.current = event.touches[0]?.clientY ?? null
        mobileSwipeStartTimeRef.current = performance.now()
        mobileSwipeTrackingRef.current = true
        mobileSwipeUnlockHapticPlayedRef.current = false
        suppressImageClickRef.current = false
    }

    const handleMobileImageTouchMove = (event: ReactTouchEvent<HTMLButtonElement>) => {
        if (!mobileSwipeTrackingRef.current || mobileSwipeStartYRef.current === null) {
            return
        }

        const currentY = event.touches[0]?.clientY
        if (currentY === undefined) {
            return
        }

        const draggedDistance = currentY - mobileSwipeStartYRef.current
        const offset =
            draggedDistance >= 0
                ? draggedDistance
                : Math.min(dampenSwipeDistance(-draggedDistance) * -1, 0)
        setIsSwipeDragging(true)
        setMobileDismissOffset(offset)

        // "Unlock" tick the moment letting go would close; re-arms if the
        // finger backs off above the threshold.
        const isPastCloseThreshold = offset >= mobileSwipeCloseThreshold
        if (isPastCloseThreshold && !mobileSwipeUnlockHapticPlayedRef.current) {
            playExpandedImageDismissHaptic()
        }
        mobileSwipeUnlockHapticPlayedRef.current = isPastCloseThreshold

        if (Math.abs(draggedDistance) > MOBILE_SWIPE_TAP_SLOP) {
            suppressImageClickRef.current = true
        }
    }

    const handleMobileImageTouchEnd = () => {
        if (!mobileSwipeTrackingRef.current) return

        const elapsed = performance.now() - mobileSwipeStartTimeRef.current
        mobileSwipeTrackingRef.current = false
        mobileSwipeStartYRef.current = null
        mobileSwipeUnlockHapticPlayedRef.current = false
        setIsSwipeDragging(false)

        const offset = mobileDismissOffset
        const velocity = offset / Math.max(1, elapsed)
        // The tap slop keeps a jittery tap (which toggles private viewing) from
        // reading as a fast flick.
        if (
            offset > MOBILE_SWIPE_TAP_SLOP &&
            (velocity > MOBILE_SWIPE_VELOCITY_THRESHOLD || offset >= mobileSwipeCloseThreshold)
        ) {
            // Slide out and fade the backdrop together on the drawer easing,
            // then close once the motion has finished.
            setIsSwipeDismissing(true)
            setMobileDismissOffset(viewportSize.height)
            swipeCloseTimeoutRef.current = window.setTimeout(onClose, MOBILE_DRAWER_DURATION_MS)
            return
        }

        setMobileDismissOffset(0)
    }

    useEffect(() => {
        if (!isOpen || !localImage) return

        setIsModalImageHidden(initialImageHidden)
    }, [initialImageHidden, isOpen, localImage])

    useEffect(() => {
        if (!isOpen) {
            setIsDetailsOpen(false)
            return
        }

        // Reset on open rather than close, so a swipe exit isn't yanked back mid-motion.
        setIsSwipeDismissing(false)
        setIsSwipeDragging(false)
        setMobileDismissOffset(0)
    }, [isOpen])

    useEffect(
        () => () => {
            if (swipeCloseTimeoutRef.current !== null) {
                window.clearTimeout(swipeCloseTimeoutRef.current)
            }
        },
        []
    )

    useEffect(() => {
        setIsDetailsOpen(false)
        setMobileDismissOffset(0)
    }, [localImage?._id])

    useEffect(() => {
        if (isDetailsOpen) {
            setMobileDismissOffset(0)
        }
    }, [isDetailsOpen])

    // offsetTop/offsetHeight ignore the dialog's zoom-in transform, unlike getBoundingClientRect.
    useEffect(() => {
        if (!mobileStageElement) return

        const update = () => {
            const top = mobileStageElement.offsetTop
            const height = mobileStageElement.offsetHeight
            setMobileStageRect((current) =>
                current?.top === top && current.height === height ? current : { top, height }
            )
        }

        update()
        const observer = new ResizeObserver(update)
        observer.observe(mobileStageElement)
        return () => observer.disconnect()
    }, [mobileStageElement])

    // The drawer's real height decides where the image settles. Flushed
    // synchronously so the image's target is corrected before the first frame
    // paints, rather than retargeting mid-animation.
    useEffect(() => {
        if (!mobileDrawerElement) return

        const observer = new ResizeObserver(() => {
            const height = mobileDrawerElement.offsetHeight
            if (height > 0) flushSync(() => setMobileDrawerHeight(height))
        })
        observer.observe(mobileDrawerElement)
        return () => observer.disconnect()
    }, [mobileDrawerElement])

    useEffect(() => {
        if (!isOpen || isMobile) return

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
                return
            }

            const target = event.target
            if (
                target instanceof HTMLElement &&
                (target.isContentEditable ||
                    target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.tagName === "SELECT")
            ) {
                return
            }

            if (matchesPreviousImageShortcut(event) && canNavigatePrevious && onPrevious) {
                event.preventDefault()
                onPrevious()
            }

            if (matchesNextImageShortcut(event) && canNavigateNext && onNext) {
                event.preventDefault()
                onNext()
            }
        }

        window.addEventListener("keydown", handleKeyDown)

        return () => {
            window.removeEventListener("keydown", handleKeyDown)
        }
    }, [canNavigateNext, canNavigatePrevious, isMobile, isOpen, onNext, onPrevious])

    if (!localImage) return null

    const isImageHidden = isModalImageHidden
    const model = models.find((m) => m.id === localImage.modelId)
    const formattedDate = new Date(localImage.createdAt).toLocaleDateString()
    const resolutionLabel = localImage.resolution || "1K"

    const handleDelete = () => {
        const imageId = localImage._id as Id<"generatedImages">
        setShowDeleteDialog(false)
        onClose()
        if (onDeleteStart) {
            onDeleteStart(imageId)
        }

        // Fire and forget deletion
        deleteImage({ id: imageId }).catch((error) => {
            console.error("Failed to delete image", error)
        })
    }

    const handleArchiveStateChange = () => {
        const imageId = localImage._id as Id<"generatedImages">
        onClose()

        if (isArchivedView) {
            onRestoreStart?.(imageId)
            restoreImage({ id: imageId }).catch((error) => {
                console.error("Failed to restore image", error)
            })
            return
        }

        onArchiveStart?.(imageId)
        archiveImage({ id: imageId }).catch((error) => {
            console.error("Failed to archive image", error)
        })
    }
    const sharedAlertDialog = (
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Image</AlertDialogTitle>
                    <AlertDialogDescription>
                        Delete this generated image from your library? This will remove the stored
                        file and cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )

    if (isMobile) {
        const mobileImagePose = getMobileImagePose(isDetailsOpen ? 1 : 0, mobileDismissOffset)
        // Everything riding the swipe tracks the finger 1:1 while dragging, then
        // settles (back or out) on the drawer easing, like vaul.
        const swipeTransformTransition = isSwipeDragging
            ? "transform 0s"
            : `transform ${MOBILE_DRAWER_EASING}`
        // Backdrop fades with drag progress, as vaul's overlay does.
        const swipeBackdropOpacity = isSwipeDismissing
            ? 0
            : 1 -
              Math.min(1, Math.max(0, mobileDismissOffset / layout.mobileFullscreenImage.height))
        const swipeBackdropStyle: CSSProperties = {
            opacity: swipeBackdropOpacity,
            transition: isSwipeDragging ? "none" : `opacity ${MOBILE_DRAWER_EASING}`
        }

        return (
            <Dialog open={isOpen} onOpenChange={(open) => !open && closeMobileDetailsOrViewer()}>
                <DialogContent
                    showCloseButton={false}
                    // A swipe close has already animated everything out by the time
                    // the dialog closes, so skip the dialog's own exit.
                    overlayClassName={cn(
                        "bg-black/92 backdrop-blur-md",
                        isSwipeDismissing && "data-[state=closed]:animate-none"
                    )}
                    overlayStyle={swipeBackdropStyle}
                    className={cn(
                        "pointer-events-none inset-0 z-[70] h-[100dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none",
                        isSwipeDismissing
                            ? "data-[state=closed]:animate-none"
                            : "data-[state=closed]:duration-100"
                    )}
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
                    <div className="pointer-events-none relative h-full w-full">
                        <div
                            className="absolute top-[calc(env(safe-area-inset-top)+1rem)] right-4 left-4 z-20 flex items-center justify-end"
                            style={swipeBackdropStyle}
                        >
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="glass-raised pointer-events-auto h-8 w-8 border text-foreground transition-all hover:bg-background"
                                onClick={onClose}
                            >
                                <span className="sr-only">Close</span>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        <div
                            ref={setMobileStageElement}
                            className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+4rem)] bottom-[calc(env(safe-area-inset-bottom)+4.5rem)]"
                        >
                            <div className="flex h-full w-full items-center justify-center px-4">
                                <button
                                    ref={mobileImageRef}
                                    type="button"
                                    className="pointer-events-auto relative flex items-center justify-center overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    style={{
                                        width: layout.mobileFullscreenImage.width,
                                        height: layout.mobileFullscreenImage.height,
                                        maxWidth: "100%",
                                        maxHeight: "100%",
                                        willChange: "transform",
                                        // Follow the finger directly during swipe-to-dismiss.
                                        transition: `${swipeTransformTransition}, border-radius ${MOBILE_DRAWER_EASING}`,
                                        transform: mobileImagePose.transform,
                                        borderRadius: mobileImagePose.borderRadius
                                    }}
                                    onClick={handleToggleImageVisibility}
                                    onTouchStart={handleMobileImageTouchStart}
                                    onTouchMove={handleMobileImageTouchMove}
                                    onTouchEnd={handleMobileImageTouchEnd}
                                    onTouchCancel={handleMobileImageTouchEnd}
                                >
                                    <span className="sr-only">
                                        {isImageHidden ? "Unhide image" : "Hide image"}
                                    </span>
                                    {loadState !== "ready" && (
                                        <div className="absolute inset-0 z-10 bg-gradient-to-br from-muted/85 via-muted/65 to-accent/20" />
                                    )}
                                    {loadState !== "ready" && (
                                        <ImageLoadIndicator complete={loadState === "revealing"} />
                                    )}
                                    <img
                                        ref={imageRef}
                                        src={renderedImageUrl}
                                        alt={localImage.prompt || "Generated Image"}
                                        className={cn(
                                            "h-full w-full rounded-[inherit] object-contain shadow-2xl transition-all duration-500",
                                            getTransparentBackdropClassName(
                                                localImage,
                                                transparentBackdrop
                                            ),
                                            loadState === "loading" &&
                                                "scale-[1.02] opacity-0 blur-xl",
                                            loadState === "revealing" &&
                                                "scale-[1.01] opacity-100 blur-md",
                                            loadState === "ready" && "scale-100 opacity-100 blur-0",
                                            isImageHidden && "brightness-75 saturate-50"
                                        )}
                                        style={{ aspectRatio: cssAspectRatio }}
                                        onLoad={handleImageLoad}
                                        onError={handleImageError}
                                    />
                                    {isImageHidden && (
                                        <>
                                            <div className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] bg-black/20 backdrop-blur-xl" />
                                            <div className="glass-raised pointer-events-none absolute inset-x-6 bottom-6 z-30 rounded-[var(--radius)] border px-4 py-2 text-center text-foreground text-sm">
                                                Private viewing enabled
                                            </div>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div
                            className="pointer-events-none absolute right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-4 z-20 flex justify-center"
                            style={{
                                opacity: isDetailsOpen ? 0 : 1,
                                transform: `translate3d(0, ${mobileDismissOffset}px, 0)`,
                                transition: `opacity 200ms ease, ${swipeTransformTransition}`
                            }}
                        >
                            <Button
                                type="button"
                                variant="ghost"
                                className={cn(
                                    "glass-raised h-9 rounded-[var(--radius-xl)] border px-4 text-foreground text-sm transition-all hover:bg-background",
                                    !isDetailsOpen && "pointer-events-auto"
                                )}
                                tabIndex={isDetailsOpen ? -1 : undefined}
                                aria-hidden={isDetailsOpen || undefined}
                                onClick={() => setIsDetailsOpen(true)}
                            >
                                View Details
                            </Button>
                        </div>

                        <Drawer
                            open={isDetailsOpen}
                            onOpenChange={setIsDetailsOpen}
                            onDrag={handleDetailsDrawerDrag}
                            onRelease={handleDetailsDrawerRelease}
                            nested
                            modal={false}
                        >
                            <DrawerContent
                                ref={setMobileDrawerElement}
                                className="z-[80] max-h-[80dvh] min-h-0 overflow-hidden border-border/60 bg-background"
                                overlayClassName="z-[79] bg-transparent backdrop-filter-none"
                                onInteractOutside={(event) => {
                                    event.preventDefault()
                                    setIsDetailsOpen(false)
                                }}
                                style={{
                                    maxHeight: `${layout.mobileDetailsMaxHeight}px`
                                }}
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
                                            {localImage.prompt || "No prompt available."}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-border/60 border-t pt-2">
                                        <div>
                                            <h4 className="mb-1 font-medium text-[0.625rem] text-muted-foreground uppercase tracking-[0.18em]">
                                                Model
                                            </h4>
                                            <p className="font-medium text-xs">
                                                {model?.name || localImage.modelId || "Unknown"}
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="mb-1 font-medium text-[0.625rem] text-muted-foreground uppercase tracking-[0.18em]">
                                                Aspect Ratio
                                            </h4>
                                            <p className="font-medium text-xs">
                                                {localImage.aspectRatio || "Unknown"}
                                            </p>
                                        </div>
                                        <div>
                                            <h4 className="mb-1 font-medium text-[0.625rem] text-muted-foreground uppercase tracking-[0.18em]">
                                                Resolution
                                            </h4>
                                            <p className="font-medium text-xs">{resolutionLabel}</p>
                                        </div>
                                        <div>
                                            <h4 className="mb-1 font-medium text-[0.625rem] text-muted-foreground uppercase tracking-[0.18em]">
                                                Date
                                            </h4>
                                            <p className="font-medium text-xs">{formattedDate}</p>
                                        </div>
                                    </div>
                                    <ReferenceImageThumbnails
                                        referenceImageKeys={localImage.referenceImageKeys}
                                    />
                                </div>
                                <div className="border-border/60 border-t bg-background px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
                                    <div className="flex flex-nowrap items-center gap-2">
                                        <Button
                                            variant="outline"
                                            className="h-10 min-w-0 flex-1 text-xs"
                                            onClick={handleViewFullResolution}
                                        >
                                            <ExternalLink className="mr-1.5 h-4 w-4" />
                                            Full Res
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
                                            aria-label={
                                                isPromptCopied ? "Prompt copied" : "Copy prompt"
                                            }
                                        >
                                            {isPromptCopied ? (
                                                <Check className="h-4 w-4" />
                                            ) : (
                                                <Clipboard className="h-4 w-4" />
                                            )}
                                            <span className="sr-only">
                                                {isPromptCopied ? "Copied" : "Copy Prompt"}
                                            </span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-10 w-10 shrink-0"
                                            onClick={handleArchiveStateChange}
                                            aria-label={
                                                isArchivedView ? "Restore image" : "Archive image"
                                            }
                                        >
                                            {isArchivedView ? (
                                                <RotateCcw className="h-4 w-4" />
                                            ) : (
                                                <Archive className="h-4 w-4" />
                                            )}
                                            <span className="sr-only">
                                                {isArchivedView ? "Restore" : "Archive"}
                                            </span>
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="h-10 w-10 shrink-0"
                                            onClick={() => setShowDeleteDialog(true)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </DrawerContent>
                        </Drawer>
                    </div>
                    {sharedAlertDialog}
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="w-fit max-w-none border-0 bg-transparent p-0 shadow-none data-[state=closed]:duration-100 sm:max-w-none"
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
                                variant="ghost"
                                size="icon"
                                className="glass-raised absolute top-1/2 -left-[4.5rem] z-20 h-11 w-11 -translate-y-1/2 rounded-[var(--radius-lg)] border text-foreground hover:bg-accent/80 disabled:pointer-events-none disabled:opacity-35"
                                onClick={onPrevious}
                                disabled={!canNavigatePrevious}
                            >
                                <span className="sr-only">Previous image</span>
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="glass-raised absolute top-1/2 -right-[4.5rem] z-20 h-11 w-11 -translate-y-1/2 rounded-[var(--radius-lg)] border text-foreground hover:bg-accent/80 disabled:pointer-events-none disabled:opacity-35"
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
                        className="glass-raised absolute -top-14 right-0 z-20 h-11 w-11 rounded-[var(--radius-lg)] border text-foreground hover:bg-accent lg:top-0 lg:-right-[4.5rem]"
                        onClick={onClose}
                    >
                        <span className="sr-only">Close</span>
                        <X className="h-4 w-4" />
                    </Button>

                    <div
                        className="relative shrink-0 overflow-hidden rounded-xl border border-border/60 bg-muted/35 shadow-2xl"
                        style={{
                            width: layout.imageWidth,
                            height: layout.imageHeight
                        }}
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
                        <button
                            type="button"
                            className="flex h-full w-full items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            onClick={handleToggleImageVisibility}
                        >
                            <span className="sr-only">
                                {isImageHidden ? "Unhide image" : "Hide image"}
                            </span>
                            <img
                                ref={imageRef}
                                src={renderedImageUrl}
                                alt={localImage.prompt || "Generated Image"}
                                className={cn(
                                    "h-full w-full object-contain transition-all duration-500",
                                    getTransparentBackdropClassName(
                                        localImage,
                                        transparentBackdrop
                                    ),
                                    loadState === "loading" && "scale-[1.02] opacity-0 blur-xl",
                                    loadState === "revealing" && "scale-[1.01] opacity-100 blur-md",
                                    loadState === "ready" && "scale-100 opacity-100 blur-0",
                                    isImageHidden && "brightness-75 saturate-50"
                                )}
                                style={{ aspectRatio: cssAspectRatio }}
                                onLoad={handleImageLoad}
                                onError={handleImageError}
                            />
                        </button>
                        {isImageHidden && (
                            <>
                                <div className="pointer-events-none absolute inset-0 z-20 bg-black/20 backdrop-blur-xl" />
                                <div className="glass-raised pointer-events-none absolute inset-x-6 bottom-6 z-30 rounded-[var(--radius)] border px-4 py-2 text-center text-sm">
                                    Private viewing enabled
                                </div>
                            </>
                        )}
                    </div>

                    <ImageMetadataPanel
                        image={localImage}
                        transparentBackdrop={transparentBackdrop}
                        onTransparentBackdropChange={setTransparentBackdrop}
                        modelName={model?.name || localImage.modelId || "Unknown"}
                        style={{
                            width: layout.infoWidth,
                            height: layout.isDesktop ? layout.infoHeight : undefined,
                            minHeight: layout.isDesktop ? layout.infoHeight : undefined
                        }}
                        footer={
                            <div className="flex flex-nowrap items-center gap-3">
                                <Button
                                    variant="outline"
                                    className="min-w-0 flex-1"
                                    onClick={handleViewFullResolution}
                                >
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
                                    {isPromptCopied ? (
                                        <Check className="h-4 w-4" />
                                    ) : (
                                        <Clipboard className="h-4 w-4" />
                                    )}
                                    <span className="sr-only">
                                        {isPromptCopied ? "Copied" : "Copy Prompt"}
                                    </span>
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-10 w-10 shrink-0"
                                    onClick={handleArchiveStateChange}
                                    aria-label={isArchivedView ? "Restore image" : "Archive image"}
                                >
                                    {isArchivedView ? (
                                        <RotateCcw className="h-4 w-4" />
                                    ) : (
                                        <Archive className="h-4 w-4" />
                                    )}
                                    <span className="sr-only">
                                        {isArchivedView ? "Restore" : "Archive"}
                                    </span>
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => setShowDeleteDialog(true)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        }
                    />
                </div>
            </DialogContent>
            {sharedAlertDialog}
        </Dialog>
    )
})
