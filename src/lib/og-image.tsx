import shurikenSvg from "@/logo.svg?raw"
import { type OgContent, fitOgContent } from "@/lib/og-content"
import { ImageResponse } from "@vercel/og"

export type OgFormat = "wide" | "landscape" | "square"

const FORMAT_CONFIG = {
    wide: {
        width: 1200,
        height: 630,
        background: "background-wide.png",
        logoLeft: 111,
        logoWidth: 210,
        logoTop: null,
        contentLeft: 360,
        contentWidth: 710,
        contentTop: 0,
        contentBottom: 0,
        contentJustify: "center"
    },
    landscape: {
        width: 1200,
        height: 675,
        background: "background-landscape.png",
        logoLeft: 111,
        logoWidth: 210,
        logoTop: null,
        contentLeft: 360,
        contentWidth: 710,
        contentTop: 0,
        contentBottom: 0,
        contentJustify: "center"
    },
    square: {
        width: 1200,
        height: 1200,
        background: "background-square.png",
        logoLeft: 110,
        logoWidth: 150,
        logoTop: 110,
        contentLeft: 110,
        contentWidth: 920,
        contentTop: 340,
        contentBottom: 80,
        contentJustify: "flex-start"
    }
} satisfies Record<
    OgFormat,
    {
        width: number
        height: number
        background: string
        logoLeft: number
        logoWidth: number
        logoTop: number | null
        contentLeft: number
        contentWidth: number
        contentTop: number
        contentBottom: number
        contentJustify: "center" | "flex-start"
    }
>

// Use the same vector as the UI; SVG images need an explicit fill color.
const logoDataUri = `data:image/svg+xml,${encodeURIComponent(shurikenSvg.replaceAll("currentColor", "#f4f4f5"))}`
const fontCache = new Map<500 | 700, Promise<ArrayBuffer>>()
const backgroundCache = new Map<OgFormat, Promise<ArrayBuffer>>()

function fetchOgAsset(assetOrigin: string, filename: string) {
    return fetch(new URL(`/og/${filename}`, assetOrigin)).then((response) => {
        if (!response.ok) {
            throw new Error(`Failed to load OG asset ${filename}: ${response.status}`)
        }
        return response.arrayBuffer()
    })
}

function loadGeistFont(assetOrigin: string, weight: 500 | 700) {
    const cached = fontCache.get(weight)
    if (cached) return cached

    const fontPromise = fetchOgAsset(assetOrigin, `geist-${weight}.ttf`).catch((error) => {
        fontCache.delete(weight)
        throw error
    })

    fontCache.set(weight, fontPromise)
    return fontPromise
}

function loadBackground(assetOrigin: string, format: OgFormat) {
    const cached = backgroundCache.get(format)
    if (cached) return cached

    const backgroundPromise = fetchOgAsset(assetOrigin, FORMAT_CONFIG[format].background).catch(
        (error) => {
            backgroundCache.delete(format)
            throw error
        }
    )

    backgroundCache.set(format, backgroundPromise)
    return backgroundPromise
}

export function isOgFormat(value: string | null): value is OgFormat {
    return value === "wide" || value === "landscape" || value === "square"
}

export async function renderOgImage(
    format: OgFormat,
    content: OgContent | undefined,
    assetOrigin: string
) {
    const config = FORMAT_CONFIG[format]
    const fittedContent = content ? fitOgContent(content, format) : undefined
    const [background, geistMedium, geistBold] = await Promise.all([
        loadBackground(assetOrigin, format),
        content ? loadGeistFont(assetOrigin, 500) : Promise.resolve(null),
        content ? loadGeistFont(assetOrigin, 700) : Promise.resolve(null)
    ])
    const backgroundDataUri = `data:image/png;base64,${Buffer.from(background).toString("base64")}`
    const logoHeight = config.logoWidth

    return new ImageResponse(
        <div
            style={{
                position: "relative",
                display: "flex",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                background: "#09090b",
                fontFamily: "Geist, sans-serif"
            }}
        >
            <img
                src={backgroundDataUri}
                width={config.width}
                height={config.height}
                alt=""
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            />
            <img
                src={logoDataUri}
                width={config.logoWidth}
                height={logoHeight}
                alt=""
                style={{
                    position: "absolute",
                    left: config.logoLeft,
                    top: config.logoTop ?? (config.height - logoHeight) / 2
                }}
            />
            {fittedContent ? (
                <div
                    style={{
                        position: "absolute",
                        top: config.contentTop,
                        bottom: config.contentBottom,
                        left: config.contentLeft,
                        display: "flex",
                        width: config.contentWidth,
                        flexDirection: "column",
                        justifyContent: config.contentJustify
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            color: "#f4f4f5",
                            fontSize: fittedContent.titleSize,
                            fontWeight: 700,
                            letterSpacing: "-2.8px",
                            lineHeight: 1.04
                        }}
                    >
                        {fittedContent.title}
                    </div>
                    <div
                        style={{
                            display: "flex",
                            marginTop: 18,
                            color: "#aaaab0",
                            fontSize: fittedContent.supportingSize,
                            fontWeight: 500,
                            letterSpacing: "-0.35px",
                            lineHeight: 1.25
                        }}
                    >
                        {fittedContent.supportingText}
                    </div>
                </div>
            ) : null}
        </div>,
        {
            width: config.width,
            height: config.height,
            fonts:
                geistMedium && geistBold
                    ? [
                          { name: "Geist", data: geistMedium, style: "normal", weight: 500 },
                          { name: "Geist", data: geistBold, style: "normal", weight: 700 }
                      ]
                    : undefined
        }
    )
}
