"use client"

import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react"
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist"
import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "./ui/button"
import { Loader } from "./ui/loader"

let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | undefined

const loadPdfJs = () => {
    pdfJsPromise ??= Promise.all([
        import("pdfjs-dist"),
        import("pdfjs-dist/build/pdf.worker.min.mjs?url")
    ])
        .then(([pdfJs, workerModule]) => {
            pdfJs.GlobalWorkerOptions.workerSrc = workerModule.default
            return pdfJs
        })
        .catch((error) => {
            pdfJsPromise = undefined
            throw error
        })
    return pdfJsPromise
}

export function PdfFilePreview({ url, filename }: { url: string; filename: string }) {
    const viewportRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [documentProxy, setDocumentProxy] = useState<PDFDocumentProxy | null>(null)
    const [pageNumber, setPageNumber] = useState(1)
    const [zoom, setZoom] = useState(1)
    const [viewportWidth, setViewportWidth] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [isRendering, setIsRendering] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [loadAttempt, setLoadAttempt] = useState(0)

    useEffect(() => {
        const viewport = viewportRef.current
        if (!viewport) return

        const updateWidth = () => setViewportWidth(viewport.clientWidth)
        updateWidth()

        const observer = new ResizeObserver(updateWidth)
        observer.observe(viewport)
        return () => observer.disconnect()
    }, [])

    // biome-ignore lint/correctness/useExhaustiveDependencies: loadAttempt intentionally retries the same URL.
    useEffect(() => {
        let cancelled = false
        let loadingTask: PDFDocumentLoadingTask | undefined

        setIsLoading(true)
        setError(null)
        setDocumentProxy(null)
        setPageNumber(1)
        setZoom(1)

        void loadPdfJs()
            .then((pdfJs) => {
                if (cancelled) return undefined
                loadingTask = pdfJs.getDocument({ url })
                return loadingTask.promise
            })
            .then((pdf) => {
                if (!pdf || cancelled) return
                setDocumentProxy(pdf)
            })
            .catch((loadError) => {
                if (cancelled) return
                console.error("Failed to load PDF preview", loadError)
                setError("This PDF could not be previewed.")
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false)
            })

        return () => {
            cancelled = true
            if (loadingTask) void loadingTask.destroy()
        }
    }, [loadAttempt, url])

    useEffect(() => {
        const canvas = canvasRef.current
        if (!documentProxy || !canvas || viewportWidth <= 0) return

        let cancelled = false
        let renderTask: RenderTask | undefined

        const renderPage = async () => {
            setIsRendering(true)
            try {
                const page = await documentProxy.getPage(pageNumber)
                if (cancelled) return

                const baseViewport = page.getViewport({ scale: 1 })
                const availableWidth = Math.max(1, viewportWidth - 16)
                const fitScale = availableWidth / baseViewport.width
                const viewport = page.getViewport({ scale: fitScale * zoom })
                const outputScale = Math.min(window.devicePixelRatio || 1, 2)
                const context = canvas.getContext("2d")
                if (!context) throw new Error("Canvas is unavailable")

                canvas.width = Math.max(1, Math.floor(viewport.width * outputScale))
                canvas.height = Math.max(1, Math.floor(viewport.height * outputScale))
                canvas.style.width = `${Math.floor(viewport.width)}px`
                canvas.style.height = `${Math.floor(viewport.height)}px`

                renderTask = page.render({
                    canvas,
                    canvasContext: context,
                    viewport,
                    transform:
                        outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0]
                })
                await renderTask.promise
                page.cleanup()
            } catch (renderError) {
                if (
                    !cancelled &&
                    (!(renderError instanceof Error) ||
                        renderError.name !== "RenderingCancelledException")
                ) {
                    console.error("Failed to render PDF preview", renderError)
                    setError("This PDF page could not be rendered.")
                }
            } finally {
                if (!cancelled) setIsRendering(false)
            }
        }

        void renderPage()

        return () => {
            cancelled = true
            renderTask?.cancel()
        }
    }, [documentProxy, pageNumber, viewportWidth, zoom])

    const pageCount = documentProxy?.numPages ?? 0

    return (
        <div className="flex h-[69dvh] min-h-0 flex-col overflow-hidden rounded-[var(--radius-md)] border bg-muted/20">
            <div className="flex min-h-11 shrink-0 items-center justify-center gap-1 border-b bg-background/90 px-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={!documentProxy || pageNumber <= 1}
                    onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
                    aria-label="Previous PDF page"
                >
                    <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-16 text-center text-sm tabular-nums">
                    {pageCount > 0 ? `${pageNumber} / ${pageCount}` : "—"}
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={!documentProxy || pageNumber >= pageCount}
                    onClick={() => setPageNumber((current) => Math.min(pageCount, current + 1))}
                    aria-label="Next PDF page"
                >
                    <ChevronRight className="size-4" />
                </Button>
                <div className="mx-1 h-5 w-px bg-border" />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={!documentProxy || zoom <= 0.75}
                    onClick={() => setZoom((current) => Math.max(0.75, current - 0.25))}
                    aria-label="Zoom out"
                >
                    <Minus className="size-4" />
                </Button>
                <span className="min-w-12 text-center text-xs tabular-nums">
                    {Math.round(zoom * 100)}%
                </span>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={!documentProxy || zoom >= 2}
                    onClick={() => setZoom((current) => Math.min(2, current + 0.25))}
                    aria-label="Zoom in"
                >
                    <Plus className="size-4" />
                </Button>
            </div>

            <div
                ref={viewportRef}
                className="relative min-h-0 flex-1 overflow-auto bg-muted/40 p-2"
                aria-label={`PDF preview: ${filename}`}
                role="region"
            >
                {isLoading ? (
                    <div className="flex h-full items-center justify-center gap-2 text-muted-foreground text-sm">
                        <Loader size="sm" />
                        Loading PDF…
                    </div>
                ) : error ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm">
                        <p className="text-muted-foreground">{error}</p>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setLoadAttempt((current) => current + 1)}
                        >
                            Try again
                        </Button>
                    </div>
                ) : (
                    <>
                        <canvas
                            ref={canvasRef}
                            className={cn(
                                "mx-auto block bg-white shadow-sm transition-opacity",
                                isRendering ? "opacity-50" : "opacity-100"
                            )}
                        />
                        {isRendering && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                <Loader size="sm" />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
