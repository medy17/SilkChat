import { LineWaves } from "@/components/line-waves"
import { LogoSymbol } from "@/components/logo"
import { type OgContent, fitOgContent } from "@/lib/og-content"
import { toPng } from "html-to-image"
import { Download } from "lucide-react"
import { type CSSProperties, useRef, useState } from "react"

const FORMATS = [
    { name: "Open Graph", width: 1200, height: 630, variant: "wide" },
    { name: "X / landscape", width: 1200, height: 675, variant: "landscape" },
    { name: "Square share", width: 1200, height: 1200, variant: "square" }
] as const

type OgCaptureGalleryProps = {
    showLogo?: boolean
    heading: string
    description: string
    filenameLabel?: string
    examples?: readonly OgContent[]
    squareStressExamples?: readonly OgContent[]
}

function getRouteLabel(content: OgContent) {
    if (content.id) return content.id
    if (content.route === "/") return "home"
    return content.route
        .slice(1)
        .replaceAll(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
}

function OgArtboard({
    name,
    width,
    height,
    variant,
    showLogo,
    filenameLabel,
    content
}: (typeof FORMATS)[number] &
    Pick<OgCaptureGalleryProps, "showLogo" | "filenameLabel"> & {
        content?: OgContent
    }) {
    const artboardRef = useRef<HTMLDivElement>(null)
    const [isCapturing, setIsCapturing] = useState(false)
    const fittedContent = content ? fitOgContent(content, variant) : undefined
    const contentStyle = fittedContent
        ? ({
              "--og-title-size": `${fittedContent.titleSize / 12}cqw`,
              "--og-supporting-size": `${fittedContent.supportingSize / 12}cqw`
          } as CSSProperties)
        : undefined

    async function captureArtboard() {
        if (!artboardRef.current || isCapturing) return

        setIsCapturing(true)
        try {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
            const dataUrl = await toPng(artboardRef.current, {
                canvasWidth: width,
                canvasHeight: height,
                pixelRatio: 1,
                cacheBust: true
            })
            const download = document.createElement("a")
            download.href = dataUrl
            download.download = `silkchat-${filenameLabel ?? variant}-${width}x${height}.png`
            download.click()
        } finally {
            setIsCapturing(false)
        }
    }

    return (
        <figure className="og-demo__format">
            <div
                ref={artboardRef}
                className={`og-artboard og-artboard--${variant}`}
                style={{ aspectRatio: `${width} / ${height}` }}
                role="img"
                aria-label={`${name} preview, ${width} by ${height} pixels`}
            >
                <div className="og-artboard__ambient" aria-hidden="true" />
                <div className="og-artboard__silk" aria-hidden="true">
                    <LineWaves
                        speed={0.16}
                        innerLineCount={25}
                        outerLineCount={31}
                        warpIntensity={1.35}
                        rotation={-38}
                        edgeFadeWidth={0.24}
                        colorCycleSpeed={0.35}
                        brightness={0.18}
                        color1="#b7b7bd"
                        color2="#76767d"
                        color3="#d0d0d4"
                        preserveDrawingBuffer
                    />
                </div>
                <div className="og-artboard__fold" aria-hidden="true" />
                {showLogo ? (
                    <div className="og-artboard__logo-safe-zone">
                        <LogoSymbol className="og-artboard__logo" aria-hidden="true" />
                    </div>
                ) : null}
                {fittedContent ? (
                    <div className="og-artboard__content" style={contentStyle}>
                        <strong>{fittedContent.title}</strong>
                        <span>{fittedContent.supportingText}</span>
                    </div>
                ) : null}
                <span className="og-artboard__grain" aria-hidden="true" />
            </div>
            <figcaption>
                <span>{content ? `${content.studioLabel ?? content.route} · ${name}` : name}</span>
                <span className="og-demo__capture-meta">
                    <span>
                        {width} × {height}
                    </span>
                    <button type="button" onClick={captureArtboard} disabled={isCapturing}>
                        <Download size={14} aria-hidden="true" />
                        {isCapturing ? "Capturing…" : "Download PNG"}
                    </button>
                </span>
            </figcaption>
        </figure>
    )
}

export function OgCaptureGallery({
    showLogo = true,
    heading,
    description,
    filenameLabel,
    examples,
    squareStressExamples
}: OgCaptureGalleryProps) {
    return (
        <main className="og-demo-shell">
            <section className="og-demo">
                <header className="og-demo__intro">
                    <h1>{heading}</h1>
                    <p>{description}</p>
                </header>

                {examples ? (
                    <div className="og-demo__examples">
                        {examples.map((example) => {
                            const routeLabel = getRouteLabel(example)

                            return (
                                <div className="og-demo__grid" key={example.route}>
                                    {FORMATS.map((format) => (
                                        <OgArtboard
                                            key={format.name}
                                            {...format}
                                            showLogo={showLogo}
                                            content={example}
                                            filenameLabel={`${routeLabel}-${format.variant}`}
                                        />
                                    ))}
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="og-demo__grid">
                        {FORMATS.map((format) => (
                            <OgArtboard
                                key={format.name}
                                {...format}
                                showLogo={showLogo}
                                filenameLabel={
                                    filenameLabel ? `${filenameLabel}-${format.variant}` : undefined
                                }
                            />
                        ))}
                    </div>
                )}

                {squareStressExamples?.length ? (
                    <section className="og-demo__stress-tests">
                        <header>
                            <h2>Square stress tests</h2>
                            <p>
                                Deliberately difficult copy, fitted with the same deterministic
                                rules as the generated image route.
                            </p>
                        </header>
                        <div className="og-demo__stress-grid">
                            {squareStressExamples.map((example) => (
                                <OgArtboard
                                    key={example.id}
                                    {...FORMATS[2]}
                                    showLogo={showLogo}
                                    content={example}
                                    filenameLabel={`${getRouteLabel(example)}-square`}
                                />
                            ))}
                        </div>
                    </section>
                ) : null}
            </section>
        </main>
    )
}
