import { fitImageAspectRatioBox, getImageAspectRatioValue } from "@/lib/image-aspect-ratios"

// Layout of the image details lightbox. The image box is computed rather than
// measured, so the same math can pick an image size before the viewer opens.
export const LIGHTBOX_DESKTOP_BREAKPOINT = 1100
export const LIGHTBOX_DESKTOP_GAP = 24
// Must leave room on each side for the flyout close/nav buttons (4.5rem offset + margin).
const DESKTOP_HORIZONTAL_CHROME = 176
const DESKTOP_VERTICAL_CHROME = 96
export const LIGHTBOX_DESKTOP_INFO_PANEL_WIDTH = 420
const DESKTOP_MAX_IMAGE_HEIGHT = 920
export const LIGHTBOX_MOBILE_HORIZONTAL_CHROME = 32
const MOBILE_FULLSCREEN_IMAGE_CHROME = 136

// Long-edge candidates. A lightbox fits the whole image on screen, so its long
// edge is what has to be sharp: 1080 covers 1x desktops, 1600 retina laptops,
// 2400 phones at 3x and large 2x displays. fit=scale-down caps at the source.
export const LIGHTBOX_LONG_EDGES = [1080, 1600, 2400] as const

type Viewport = { width: number; height: number }

export const getLightboxImageBox = ({
    viewport,
    aspectRatioValue
}: {
    viewport: Viewport
    aspectRatioValue: number
}) => {
    if (viewport.width >= LIGHTBOX_DESKTOP_BREAKPOINT) {
        const maxImageHeight = Math.max(
            320,
            Math.min(DESKTOP_MAX_IMAGE_HEIGHT, viewport.height - DESKTOP_VERTICAL_CHROME)
        )
        const maxImageWidth = Math.max(
            320,
            viewport.width -
                LIGHTBOX_DESKTOP_INFO_PANEL_WIDTH -
                LIGHTBOX_DESKTOP_GAP -
                DESKTOP_HORIZONTAL_CHROME
        )
        const height = Math.min(maxImageHeight, maxImageWidth / aspectRatioValue)
        return {
            isDesktop: true as const,
            width: height * aspectRatioValue,
            height,
            maxImageHeight
        }
    }

    return {
        isDesktop: false as const,
        ...fitImageAspectRatioBox({
            aspectRatioValue,
            maxWidth: Math.max(280, viewport.width - LIGHTBOX_MOBILE_HORIZONTAL_CHROME),
            maxHeight: Math.max(240, viewport.height - MOBILE_FULLSCREEN_IMAGE_CHROME)
        })
    }
}

export const getLightboxLongEdge = ({
    viewport,
    aspectRatio,
    devicePixelRatio
}: {
    viewport: Viewport
    aspectRatio?: string
    devicePixelRatio: number
}) => {
    const box = getLightboxImageBox({
        viewport,
        aspectRatioValue: getImageAspectRatioValue(aspectRatio || "1:1")
    })
    const requiredLongEdge = Math.max(box.width, box.height) * devicePixelRatio
    return (
        LIGHTBOX_LONG_EDGES.find((longEdge) => longEdge >= requiredLongEdge) ??
        LIGHTBOX_LONG_EDGES[LIGHTBOX_LONG_EDGES.length - 1]
    )
}

export const getWindowLightboxViewport = () =>
    typeof window === "undefined"
        ? { viewport: { width: 1440, height: 900 }, devicePixelRatio: 1 }
        : {
              viewport: { width: window.innerWidth, height: window.innerHeight },
              devicePixelRatio: window.devicePixelRatio || 1
          }
