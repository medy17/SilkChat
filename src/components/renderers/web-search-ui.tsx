import { AnimatedCollapsible } from "@/components/ui/animated-collapsible"
import type { MessageWebSearch, WebSearchResult } from "@/lib/message-web-searches"
import { cn } from "@/lib/utils"
import { Check, ChevronDown, CircleAlert, ExternalLink, Globe, Loader2 } from "lucide-react"
import { memo, useEffect, useMemo, useState } from "react"

function getFaviconUrl(url: string): string {
    try {
        const domain = new URL(url).hostname
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    } catch {
        return ""
    }
}

function getOpenGraphImage(url: string): string {
    try {
        const domain = new URL(url).hostname
        return `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`
    } catch {
        return ""
    }
}

const FaviconWithLoader = memo(({ url }: { url: string }) => {
    const [imageLoaded, setImageLoaded] = useState(false)

    return (
        <div className="relative flex aspect-square size-4 items-center justify-center rounded-full">
            {!imageLoaded && (
                <div className="absolute inset-0 animate-pulse rounded-full bg-muted-foreground/10" />
            )}
            <img
                src={getFaviconUrl(url)}
                alt=""
                className={cn("size-4 rounded-full object-contain", !imageLoaded && "opacity-0")}
                onLoad={() => setImageLoaded(true)}
                onError={(event) => {
                    setImageLoaded(true)
                    const target = event.currentTarget
                    target.src =
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cline x1='12' y1='8' x2='12' y2='16'/%3E%3Cline x1='8' y1='12' x2='16'/%3E%3C/svg%3E"
                }}
            />
        </div>
    )
})

FaviconWithLoader.displayName = "FaviconWithLoader"

const SearchResultCard = memo(({ result }: { result: WebSearchResult }) => {
    const label = result.title ?? result.url ?? "search result"

    return (
        <button
            type="button"
            className="group relative w-64 min-w-64 shrink-0 overflow-hidden rounded-[var(--radius-lg)] border bg-card text-left transition-all duration-200 hover:border-primary/20 hover:bg-accent/50 hover:shadow-lg"
            onClick={() => result.url && window.open(result.url, "_blank", "noopener,noreferrer")}
            disabled={!result.url}
            aria-label={`Open ${label} in new tab`}
        >
            {result.url && (
                <div className="relative h-32 overflow-hidden bg-muted/30">
                    <img
                        src={getOpenGraphImage(result.url)}
                        alt=""
                        className="mx-auto aspect-video h-full max-h-full w-full object-cover"
                        onError={(event) => {
                            const target = event.currentTarget
                            target.style.display = "none"
                            const fallback = target.nextElementSibling as HTMLDivElement | null
                            if (fallback) fallback.style.display = "flex"
                        }}
                    />
                    <div className="absolute inset-0 hidden items-center justify-center bg-muted/50">
                        <Globe className="size-8 text-muted-foreground/50" />
                    </div>
                </div>
            )}

            <div className="space-y-2 p-4">
                <div className="flex items-center gap-2">
                    {result.url && <FaviconWithLoader url={result.url} />}
                    <h4 className="m-0 truncate font-semibold text-base text-foreground">
                        {result.title ?? result.url ?? "Untitled result"}
                    </h4>
                </div>
                {(result.description || result.snippet) && (
                    <p className="m-0 line-clamp-3 text-muted-foreground text-sm leading-relaxed">
                        {result.description || result.snippet}
                    </p>
                )}

                {result.url && (
                    <div className="flex items-center gap-1.5 border-border/50 border-t pt-2">
                        <span className="flex-1 truncate text-muted-foreground/70 text-xs">
                            {result.url.replace(/^(https?:\/\/)/, "").split("/")[0]}
                        </span>
                        <ExternalLink className="size-3 shrink-0 text-muted-foreground/50" />
                    </div>
                )}
            </div>
        </button>
    )
})

SearchResultCard.displayName = "SearchResultCard"

const WebSearchStep = memo(({ search }: { search: MessageWebSearch }) => {
    const [isOpen, setIsOpen] = useState(search.status === "running")

    useEffect(() => {
        if (search.status === "running") setIsOpen(true)
    }, [search.status])

    return (
        <section className="border-border/70 border-t first:border-t-0">
            <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-3 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
                onClick={() => setIsOpen((open) => !open)}
                aria-expanded={isOpen}
            >
                {search.status === "running" ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                ) : search.status === "failed" ? (
                    <CircleAlert className="size-3.5 shrink-0 text-destructive" />
                ) : (
                    <Check className="size-3.5 shrink-0 text-primary" />
                )}
                <span className="min-w-0 flex-1 truncate font-medium text-sm">{search.query}</span>
                {search.status !== "running" && (
                    <span className="shrink-0 text-muted-foreground text-xs">
                        {search.results.length} {search.results.length === 1 ? "result" : "results"}
                    </span>
                )}
                <ChevronDown
                    className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180"
                    )}
                />
            </button>

            <AnimatedCollapsible open={isOpen}>
                <div className="border-border/70 border-t bg-background/35">
                    {search.status === "running" ? (
                        <p className="m-0 px-4 py-4 text-muted-foreground text-sm">Searching…</p>
                    ) : search.error ? (
                        <p className="m-4 rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
                            {search.error}
                        </p>
                    ) : search.results.length > 0 ? (
                        <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border flex gap-4 overflow-x-auto p-4">
                            {search.results.map((result, index) => (
                                <SearchResultCard
                                    key={`${result.url ?? result.title ?? "result"}-${index}`}
                                    result={result}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="m-0 px-4 py-4 text-muted-foreground text-sm">
                            No results returned.
                        </p>
                    )}
                </div>
            </AnimatedCollapsible>
        </section>
    )
})

WebSearchStep.displayName = "WebSearchStep"

export const WebSearchGroupRenderer = memo(({ searches }: { searches: MessageWebSearch[] }) => {
    const [isOpen, setIsOpen] = useState(false)
    const summary = useMemo(() => {
        const running = searches.filter((search) => search.status === "running").length
        const failed = searches.filter((search) => search.status === "failed").length
        const results = searches.reduce((total, search) => total + search.results.length, 0)
        return { running, failed, results }
    }, [searches])

    if (searches.length === 0) return null

    return (
        <div className="not-prose mb-6 w-full">
            <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 text-left"
                onClick={() => setIsOpen((open) => !open)}
                aria-expanded={isOpen}
            >
                <Globe className="size-4 shrink-0 text-primary" />
                <span className="font-medium text-primary">Web Search</span>
                {summary.running > 0 && (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                )}
                <span className="ml-auto text-muted-foreground text-xs">
                    {searches.length} {searches.length === 1 ? "search" : "searches"}
                    {summary.running === 0 && summary.results > 0
                        ? ` · ${summary.results} results`
                        : ""}
                    {summary.failed > 0 ? ` · ${summary.failed} failed` : ""}
                </span>
                <ChevronDown
                    className={cn(
                        "size-4 shrink-0 text-foreground transition-transform",
                        isOpen && "rotate-180"
                    )}
                />
            </button>

            <AnimatedCollapsible open={isOpen}>
                <div className="mt-4 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-muted/25">
                    {searches.map((search) => (
                        <WebSearchStep key={search.toolCallId} search={search} />
                    ))}
                </div>
            </AnimatedCollapsible>
        </div>
    )
})

WebSearchGroupRenderer.displayName = "WebSearchGroupRenderer"
