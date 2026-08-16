import { cn } from "@/lib/utils"
import type { UIToolInvocation } from "ai"
import { AlertCircle, BrainCircuit, ChevronDown, Loader2 } from "lucide-react"
import { memo, useEffect, useRef, useState } from "react"

type MemoryRetrievalInvocation = UIToolInvocation<{
    input: unknown
    output: unknown | undefined
}>

type MemorySearchOutput = {
    success?: boolean
    results?: Array<{ content?: string }>
    message?: string
    error?: string
}

type MemoryProfileOutput = {
    success?: boolean
    profile?: {
        stableFacts?: string[]
        recentContext?: string[]
    }
    message?: string
    error?: string
}

export const MemoryRetrievalToolRenderer = memo(
    ({
        toolInvocation,
        mode
    }: {
        toolInvocation: MemoryRetrievalInvocation
        mode: "search" | "profile"
    }) => {
        const [isExpanded, setIsExpanded] = useState(false)
        const contentRef = useRef<HTMLDivElement>(null)
        const innerRef = useRef<HTMLDivElement>(null)
        const isLoading =
            toolInvocation.state === "input-streaming" || toolInvocation.state === "input-available"
        const output =
            toolInvocation.state === "output-available" &&
            typeof toolInvocation.output === "object" &&
            toolInvocation.output !== null
                ? (toolInvocation.output as MemorySearchOutput | MemoryProfileOutput)
                : undefined
        const hasOutput = output !== undefined
        const failed = hasOutput && output.success === false
        const query =
            mode === "search" &&
            typeof toolInvocation.input === "object" &&
            toolInvocation.input !== null &&
            "query" in toolInvocation.input &&
            typeof toolInvocation.input.query === "string"
                ? toolInvocation.input.query
                : undefined
        const sections =
            mode === "search"
                ? [
                      {
                          label: "Relevant memories",
                          items:
                              (output as MemorySearchOutput | undefined)?.results
                                  ?.map((result) => result.content)
                                  .filter((content): content is string => Boolean(content)) ?? []
                      }
                  ]
                : [
                      {
                          label: "Stable facts",
                          items:
                              (output as MemoryProfileOutput | undefined)?.profile?.stableFacts ??
                              []
                      },
                      {
                          label: "Recent context",
                          items:
                              (output as MemoryProfileOutput | undefined)?.profile?.recentContext ??
                              []
                      }
                  ]
        const resultCount = sections.reduce((total, section) => total + section.items.length, 0)
        const title = mode === "search" ? "Memory search" : "What I remember"

        useEffect(() => {
            if (!contentRef.current || !innerRef.current) return

            const observer = new ResizeObserver(() => {
                if (contentRef.current && innerRef.current && isExpanded) {
                    contentRef.current.style.maxHeight = `${innerRef.current.scrollHeight}px`
                }
            })
            observer.observe(innerRef.current)

            if (isExpanded) {
                contentRef.current.style.maxHeight = `${innerRef.current.scrollHeight}px`
            }

            return () => observer.disconnect()
        }, [isExpanded])

        return (
            <div className="w-full">
                <button
                    type="button"
                    className="flex w-full cursor-pointer flex-col gap-2 text-left md:flex-row md:items-center"
                    onClick={() => setIsExpanded((expanded) => !expanded)}
                    disabled={isLoading || !hasOutput}
                >
                    <div className="flex flex-1 items-center gap-2">
                        {isLoading ? (
                            <Loader2 className="size-4 animate-spin text-primary" />
                        ) : failed ? (
                            <AlertCircle className="size-4 text-destructive" />
                        ) : (
                            <BrainCircuit className="size-4 text-primary" />
                        )}
                        <span
                            className={cn(
                                "font-medium",
                                failed ? "text-destructive" : "text-primary"
                            )}
                        >
                            {isLoading
                                ? mode === "search"
                                    ? "Searching memory"
                                    : "Checking what I remember"
                                : title}
                        </span>

                        <div className="flex-1 md:hidden" />
                        {hasOutput && (
                            <ChevronDown
                                className={cn(
                                    "size-4 transform text-foreground transition-transform md:hidden",
                                    isExpanded && "rotate-180"
                                )}
                            />
                        )}
                    </div>

                    {(query || hasOutput) && (
                        <div className="flex items-center gap-2 md:ml-auto">
                            <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-muted/50 px-2 py-1 text-muted-foreground text-sm">
                                {query && (
                                    <span className="max-w-32 truncate md:max-w-48">“{query}”</span>
                                )}
                                {hasOutput && (
                                    <span className={failed ? "text-destructive" : undefined}>
                                        {failed
                                            ? "Failed"
                                            : `${resultCount} ${resultCount === 1 ? "memory" : "memories"}`}
                                    </span>
                                )}
                            </div>
                            {hasOutput && (
                                <ChevronDown
                                    className={cn(
                                        "hidden size-4 transform text-foreground transition-transform md:block",
                                        isExpanded && "rotate-180"
                                    )}
                                />
                            )}
                        </div>
                    )}
                </button>

                <div
                    ref={contentRef}
                    className="my-4 overflow-hidden rounded-[var(--radius-lg)] border bg-muted/50 transition-[max-height] duration-150 ease-out"
                    style={{ maxHeight: isExpanded ? contentRef.current?.scrollHeight : "0px" }}
                >
                    <div ref={innerRef} className="space-y-4 p-4">
                        {failed ? (
                            <p className="text-destructive text-sm">
                                {output.error ?? "Could not retrieve memory."}
                            </p>
                        ) : resultCount === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                {output?.message ?? "No memory context was returned."}
                            </p>
                        ) : (
                            sections.map(
                                (section) =>
                                    section.items.length > 0 && (
                                        <section key={section.label}>
                                            <h4 className="mb-2 font-medium text-foreground text-sm">
                                                {section.label}
                                            </h4>
                                            <ul className="space-y-2">
                                                {section.items.map((item, index) => (
                                                    <li
                                                        key={`${section.label}-${index}`}
                                                        className="rounded-[var(--radius-md)] bg-card px-3 py-2 text-foreground text-sm"
                                                    >
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>
                                    )
                            )
                        )}
                    </div>
                </div>
            </div>
        )
    }
)

MemoryRetrievalToolRenderer.displayName = "MemoryRetrievalToolRenderer"
