"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle
} from "@/components/ui/dialog"
import { useResolvedThemeMode } from "@/hooks/use-resolved-theme-mode"
import { useThemeStore } from "@/lib/theme-store"
import { cn } from "@/lib/utils"
import {
    SandpackLayout,
    SandpackPreview,
    SandpackProvider,
    useSandpack
} from "@codesandbox/sandpack-react"
import { Maximize2, Minus, Plus, ScanSearch, X } from "lucide-react"
import { memo, useEffect, useState } from "react"
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch"
import { Streamdown } from "streamdown"
import type { ArtifactLanguage } from "./artifact-preview-shared"
import { prepareMermaidSvg } from "./mermaid-export"
import { streamdownComponents, streamdownPlugins } from "./streamdown-config"

interface ArtifactPreviewProps {
    code: string
    language: ArtifactLanguage
    className?: string
    onMermaidSvgChange?: (svg: string | null) => void
}

const mermaidCanvasSurfaceClassName =
    "relative w-full overflow-hidden bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-background [background-size:24px_24px]"

const mermaidInlineCanvasClassName =
    "relative h-[min(48rem,calc(100dvh-8rem))] min-h-64 w-full overflow-hidden bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-background [background-size:24px_24px]"

const MermaidCanvas = ({
    svg,
    expanded = false,
    onExpand
}: {
    svg: string
    expanded?: boolean
    onExpand?: () => void
}) => {
    const [zoomPercent, setZoomPercent] = useState(100)

    return (
        <div
            className={cn(
                mermaidCanvasSurfaceClassName,
                expanded ? "h-full min-h-0" : "h-[min(48rem,calc(100dvh-8rem))] min-h-64"
            )}
        >
            <TransformWrapper
                initialScale={1}
                minScale={0.2}
                maxScale={12}
                centerOnInit
                centerZoomedOut
                smooth={false}
                doubleClick={{ disabled: false, mode: "reset" }}
                wheel={{ step: 0.1 }}
                panning={{ velocityDisabled: true }}
                limitToBounds={false}
                onTransform={(_, state) => setZoomPercent(Math.round(state.scale * 100))}
            >
                {({ zoomIn, zoomOut, resetTransform }) => (
                    <>
                        <TransformComponent
                            wrapperClass="!h-full !w-full overflow-hidden"
                            contentClass="!h-full !w-full"
                        >
                            <div
                                className="h-full w-full select-none [&>svg]:h-full [&>svg]:w-full"
                                dangerouslySetInnerHTML={{ __html: svg }}
                            />
                        </TransformComponent>

                        <div className="absolute right-3 bottom-3 z-10 flex items-center overflow-hidden rounded-[var(--radius-md)] border border-border bg-background/90 shadow-sm backdrop-blur">
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-8 rounded-none"
                                aria-label="Zoom out Mermaid diagram"
                                onClick={() => zoomOut()}
                            >
                                <Minus className="size-4" />
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 min-w-16 rounded-none border-border border-x px-2 font-mono text-xs tabular-nums"
                                aria-label="Fit Mermaid diagram to view"
                                onClick={() => resetTransform(200)}
                            >
                                <ScanSearch className="size-3.5" />
                                {zoomPercent}%
                            </Button>
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-8 rounded-none"
                                aria-label="Zoom in Mermaid diagram"
                                onClick={() => zoomIn()}
                            >
                                <Plus className="size-4" />
                            </Button>
                            {onExpand && (
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="size-8 rounded-none border-border border-l"
                                    aria-label="Open Mermaid diagram in fullscreen"
                                    onClick={onExpand}
                                >
                                    <Maximize2 className="size-4" />
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </TransformWrapper>
        </div>
    )
}

const MermaidRenderer = memo(
    ({ code, onSvgChange }: { code: string; onSvgChange?: (svg: string | null) => void }) => {
        const [error, setError] = useState<string | null>(null)
        const [isLoading, setIsLoading] = useState(true)
        const { themeState } = useThemeStore()
        const isDark = useResolvedThemeMode(themeState.currentMode) === "dark"
        const [mermaidHTML, setMermaidHTML] = useState<string | null>(null)
        const [fullscreenOpen, setFullscreenOpen] = useState(false)

        useEffect(() => {
            onSvgChange?.(null)
            setError(null)
            setIsLoading(true)
            ;(async () => {
                try {
                    // Avoid Vite's dev prebundle for the package root. That optimized path
                    // can emit a broken `require_dist()` call for Mermaid's sanitize-url helper.
                    const mermaidModule = await import("mermaid/dist/mermaid.core.mjs")
                    const mermaid = mermaidModule.default ?? mermaidModule

                    mermaid.initialize({
                        startOnLoad: false,
                        securityLevel: "strict",
                        suppressErrorRendering: true,
                        htmlLabels: false,
                        flowchart: { htmlLabels: false },
                        theme: isDark ? "dark" : "default"
                    })
                    const { svg } = await mermaid.render(
                        `mermaid-${Date.now()}-${isDark ? "dark" : "light"}`,
                        code
                    )
                    const preparedSvg = prepareMermaidSvg(svg)
                    setMermaidHTML(preparedSvg)
                    onSvgChange?.(preparedSvg)
                } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to render diagram")
                } finally {
                    setIsLoading(false)
                }
            })()
        }, [code, isDark, onSvgChange])

        if (error) {
            return (
                <div
                    className={cn(
                        mermaidInlineCanvasClassName,
                        "flex items-center justify-center p-8 text-destructive"
                    )}
                >
                    <div className="text-center">
                        <p className="font-medium">Failed to render diagram</p>
                        <p className="text-muted-foreground text-sm">{error}</p>
                    </div>
                </div>
            )
        }

        if (isLoading) {
            return (
                <div
                    className={cn(
                        mermaidInlineCanvasClassName,
                        "flex items-center justify-center p-8"
                    )}
                >
                    <div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
                </div>
            )
        }

        return (
            <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
                {fullscreenOpen ? (
                    <div className={mermaidInlineCanvasClassName} aria-hidden="true" />
                ) : (
                    <MermaidCanvas
                        svg={mermaidHTML ?? ""}
                        onExpand={() => setFullscreenOpen(true)}
                    />
                )}

                <DialogContent
                    showCloseButton={false}
                    overlayClassName="backdrop-blur-md data-[state=open]:animate-none data-[state=closed]:animate-none"
                    className="flex max-w-none flex-col gap-0 overflow-hidden rounded-[var(--radius-lg)] bg-card p-0 text-card-foreground data-[state=closed]:animate-none data-[state=open]:animate-none"
                    style={{
                        width: "92vw",
                        height: "85vh",
                        maxWidth: "80rem",
                        maxHeight: "56rem"
                    }}
                >
                    <div className="flex h-14 shrink-0 items-center gap-3 border-border border-b px-4">
                        <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-sm">Mermaid diagram</h3>
                            <p className="text-muted-foreground text-xs">Pan and zoom to explore</p>
                        </div>
                        <DialogClose asChild>
                            <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="size-8 rounded-[var(--radius-sm)]"
                                aria-label="Close fullscreen Mermaid diagram"
                            >
                                <X className="size-4" />
                            </Button>
                        </DialogClose>
                    </div>
                    <DialogTitle className="sr-only">Mermaid diagram</DialogTitle>
                    <DialogDescription className="sr-only">
                        Fullscreen interactive Mermaid diagram with pan and zoom controls.
                    </DialogDescription>
                    <div className="relative min-h-0 flex-1 overflow-hidden">
                        <MermaidCanvas svg={mermaidHTML ?? ""} expanded />
                    </div>
                </DialogContent>
            </Dialog>
        )
    }
)

MermaidRenderer.displayName = "MermaidRenderer"

const HTMLRenderer = memo(({ code }: { code: string }) => {
    const [isDark, setIsDark] = useState(false)

    useEffect(() => {
        const checkDarkMode = () => {
            const isDarkMode =
                document.documentElement.classList.contains("dark") ||
                window.matchMedia("(prefers-color-scheme: dark)").matches
            setIsDark(isDarkMode)
        }

        checkDarkMode()

        const observer = new MutationObserver(checkDarkMode)
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })

        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
        mediaQuery.addEventListener("change", checkDarkMode)

        return () => {
            observer.disconnect()
            mediaQuery.removeEventListener("change", checkDarkMode)
        }
    }, [])

    // Hardcoded colors based on globals.css
    const colors = isDark
        ? {
              background: "#000000", // Dark background
              foreground: "#f9fafb", // Light text
              primary: "#10b981", // Green primary
              border: "#374151" // Dark border
          }
        : {
              background: "#fefefe", // Light background
              foreground: "#1f2937", // Dark text
              primary: "#10b981", // Green primary
              border: "#e5e7eb" // Light border
          }

    // Inject basic theme CSS variables into the HTML
    const themeCSS = `
        <style>
            :root {
                --background: ${colors.background};
                --foreground: ${colors.foreground};
                --primary: ${colors.primary};
                --border: ${colors.border};
            }
            
            body {
                background-color: var(--background);
                color: var(--foreground);
                margin: 0;
                padding: 1rem;
                font-family: system-ui, -apple-system, sans-serif;
            }
        </style>
    `

    // Inject the CSS into the HTML document
    const enhancedCode = code.includes("<head>")
        ? code.replace("<head>", `<head>${themeCSS}`)
        : code.includes("<html>")
          ? code.replace("<html>", `<html><head>${themeCSS}</head>`)
          : `<html><head>${themeCSS}</head><body>${code}</body></html>`

    return (
        <iframe
            srcDoc={enhancedCode}
            className="h-96 w-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title="HTML Preview"
        />
    )
})

HTMLRenderer.displayName = "HTMLRenderer"

const ReactRenderer = memo(({ code }: { code: string }) => {
    return (
        <div className="sandpack-container relative h-96 w-full">
            <SandpackProvider
                template="react"
                customSetup={{
                    dependencies: {
                        recharts: "2.15.0",
                        "lucide-react": "latest",
                        clsx: "latest",
                        "tailwind-merge": "latest"
                    }
                }}
                files={{
                    "/App.js": code
                }}
                options={{
                    externalResources: ["https://cdn.tailwindcss.com"]
                }}
                theme="auto"
            >
                <SandpackPreviewContainer />
            </SandpackProvider>
        </div>
    )
})

const SandpackPreviewContainer = memo(() => {
    const { sandpack } = useSandpack()

    return (
        <div className="relative h-full w-full">
            <SandpackLayout>
                <SandpackPreview
                    showRefreshButton={false}
                    showOpenInCodeSandbox={false}
                    style={{
                        height: "100%",
                        width: "100%"
                    }}
                />
            </SandpackLayout>
            {sandpack.error && (
                <div className="absolute bottom-4 left-4 z-10 rounded-md bg-destructive/90 p-3 text-destructive-foreground shadow-lg">
                    <div className="font-medium text-sm">Rendering Error</div>
                    <div className="text-xs opacity-90">{sandpack.error.message}</div>
                </div>
            )}
        </div>
    )
})

SandpackPreviewContainer.displayName = "SandpackPreviewContainer"

ReactRenderer.displayName = "ReactRenderer"

const MarkdownRenderer = memo(({ code }: { code: string }) => {
    return (
        <TransformWrapper
            initialScale={1}
            minScale={0.5}
            maxScale={2}
            doubleClick={{ disabled: false, mode: "reset" }}
            wheel={{ step: 0.1 }}
            panning={{ velocityDisabled: true }}
            limitToBounds={false}
        >
            <TransformComponent wrapperClass="prose prose-sm dark:prose-invert max-w-none p-4 overflow-hidden">
                <Streamdown
                    components={streamdownComponents}
                    controls={false}
                    linkSafety={{ enabled: false }}
                    mode="static"
                    plugins={streamdownPlugins}
                >
                    {code}
                </Streamdown>
            </TransformComponent>
        </TransformWrapper>
    )
})

MarkdownRenderer.displayName = "MarkdownRenderer"

export const ArtifactPreview = memo(
    ({ code, language, className, onMermaidSvgChange }: ArtifactPreviewProps) => {
        const renderPreview = () => {
            switch (language) {
                case "mermaid":
                    return <MermaidRenderer code={code} onSvgChange={onMermaidSvgChange} />
                case "html":
                    return <HTMLRenderer code={code} />
                case "react":
                case "jsx":
                case "tsx":
                    return <ReactRenderer code={code} />
                case "markdown":
                case "md":
                    return <MarkdownRenderer code={code} />
                default:
                    return (
                        <div className="p-4 text-center text-muted-foreground">
                            Preview not available for {language}
                        </div>
                    )
            }
        }

        return <div className={cn("min-h-[12.5rem] bg-card", className)}>{renderPreview()}</div>
    }
)

ArtifactPreview.displayName = "ArtifactPreview"
