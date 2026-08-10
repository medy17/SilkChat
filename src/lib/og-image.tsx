import { readFile } from "node:fs/promises"
import { join } from "node:path"
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

const LOGO_ASPECT_RATIO = 1507.45 / 1499.99

const logoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1507.45 1499.99">
  <path fill="#f4f4f5" d="M1127,347.91v-172.9C1127,87.61,1021.2-3.69,934.7.11H190.4C86.7,6.31,4.5,85.81,0,190.51v701.4c1.9,12.8,2.1,25.7,4.6,38.4,15.9,83.5,91.3,146.4,175,154.1l.4,139.2c8.5,47.3,62.4,68.6,101.2,39.1l185.1-178.2,482.1-.3c78.8,0,178.6-89.6,178.6-169V377.11h-233.4l-118.2,125h223.6c5.4,8.1,1.1,21.7.9,32.3-1.6,84.1,1.8,169.6,2.1,253.7.3,67,19,166.2-73.2,173l-489.8.4c-10.2,1.9-19.7,6.9-27.8,13.2-34.1,26.7-67,68-99.6,97.7-5.2,4.8-11.4,8.8-16.7,13.6v-77.2c0-4.5-10.2-23-13.7-27.3-27.7-33.2-64.6-14.3-100-23.1-28.4-7-49.7-30.5-54-59.2l-.2-712.7c-.9-23.8,35.1-61.5,57.6-61.5h700.2l-235.7,250.1c-41.7,5.5-84.5-2.9-126,6.3-84.2,18.7-142.7,94.6-146.1,180.1v368.2h126.9v-211.9L999,195.41c4.4-.8,2.7,1.9,2.9,4.8,2.4,32.6-1,69.3,0,103.5.4,13.9.3,28.3-1.2,42.1l126.1,1.9h0l.2.2ZM1335,377.21h-167v125c7.1,1.3,13.8-1.8,20.4-2,34.6-1.2,77.2-1.9,111.5,0,48.7,2.7,75.7,25.2,79.1,75.2-2,190.4,3.7,381.5-2.9,571.5-6.4,20.8-21.8,38-42.1,45.8-38,14.6-87.1-8.9-121.1,23.4-6,5.7-17.5,25.4-17.5,33.3v75.2c-4.9-1.3-10.6-6.5-14.6-9.8-37.2-31-83.5-79-122.2-104.3-13.6-8.9-27.6-11.9-43.7-12.9h-453c-37.5-7.9-62.6-40.5-57.8-79l-2.9-4.1-23.5,3.1-85,85.1c22.4,61.7,82,106.3,146.1,117.6l475.2,3.3c63.5,47.9,121.9,105,184.5,153.4,47.6,36.8,101.2,31.3,119.9-30.4l.2-123.8c99.6-4.3,181.8-84.3,185.6-184.5-7.9-188.4,10.3-385,0-572.4-5.2-94.2-71.8-179-169-188.4h0l-.2-.3ZM741.8,657.01c-130.8,13.3-95.1,219.2,36.4,182.9,106.7-29.4,78.1-194.5-36.4-182.9h0Z" />
</svg>`

const logoDataUri = `data:image/svg+xml,${encodeURIComponent(logoSvg)}`
const fontCache = new Map<500 | 700, Promise<ArrayBuffer>>()

function loadGeistFont(weight: 500 | 700) {
    const cached = fontCache.get(weight)
    if (cached) return cached

    const fontPromise = readFile(join(process.cwd(), "public", "og", `geist-${weight}.ttf`))
        .then(
            (font) =>
                font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength) as ArrayBuffer
        )
        .catch((error) => {
            fontCache.delete(weight)
            throw error
        })

    fontCache.set(weight, fontPromise)
    return fontPromise
}

export function isOgFormat(value: string | null): value is OgFormat {
    return value === "wide" || value === "landscape" || value === "square"
}

export async function renderOgImage(format: OgFormat, content?: OgContent) {
    const config = FORMAT_CONFIG[format]
    const fittedContent = content ? fitOgContent(content, format) : undefined
    const [background, geistMedium, geistBold] = await Promise.all([
        readFile(join(process.cwd(), "public", "og", config.background)),
        content ? loadGeistFont(500) : Promise.resolve(null),
        content ? loadGeistFont(700) : Promise.resolve(null)
    ])
    const backgroundDataUri = `data:image/png;base64,${background.toString("base64")}`
    const logoHeight = Math.round(config.logoWidth / LOGO_ASPECT_RATIO)

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
