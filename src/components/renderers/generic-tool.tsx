import { cn } from "@/lib/utils"
import type { UIToolInvocation } from "ai"
import { ChevronDown, Loader2, Wrench } from "lucide-react"
import type { ComponentType } from "react"
import { memo, useEffect, useRef, useState } from "react"
import { Codeblock } from "../codeblock"

type GenericToolInvocation = UIToolInvocation<{
    input: unknown
    output: unknown
}>

export const GenericToolRenderer = memo(
    ({
        toolInvocation,
        toolName,
        icon: ToolIcon = Wrench
    }: {
        toolInvocation: GenericToolInvocation
        toolName: string
        icon?: ComponentType<{ className?: string }>
    }) => {
        const [isExpanded, setIsExpanded] = useState(false)
        const contentRef = useRef<HTMLDivElement>(null)
        const innerRef = useRef<HTMLDivElement>(null)

        const isLoading =
            toolInvocation.state === "input-streaming" || toolInvocation.state === "input-available"
        const hasResults =
            toolInvocation.state === "output-available" && toolInvocation.output !== undefined

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
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex w-full cursor-pointer items-center gap-2 text-left"
                    disabled={isLoading}
                >
                    <div className="flex flex-1 items-center gap-2">
                        <ToolIcon className="size-4 text-primary" />
                        <span className="font-medium text-primary">{toolName}</span>

                        {isLoading ? (
                            <Loader2 className="ml-auto size-4 animate-spin text-primary" />
                        ) : (
                            hasResults && (
                                <div
                                    className={cn(
                                        "ml-auto transform transition-transform",
                                        isExpanded ? "rotate-180" : ""
                                    )}
                                >
                                    <ChevronDown className="size-4 text-foreground" />
                                </div>
                            )
                        )}
                    </div>
                </button>

                <div
                    ref={contentRef}
                    className={cn(
                        "overflow-hidden transition-[max-height] duration-150 ease-out",
                        "my-4 rounded-lg border bg-muted/50"
                    )}
                    style={{
                        maxHeight: isExpanded ? contentRef.current?.scrollHeight : "0px"
                    }}
                >
                    <div ref={innerRef} className="text-muted-foreground">
                        {hasResults && (
                            <div className="scrollbar-thin max-h-full overflow-y-auto px-3 pt-3 pb-3">
                                <span className="font-medium text-foreground text-sm">
                                    Arguments
                                </span>
                                <div className="mt-2 mb-3">
                                    <Codeblock
                                        className="language-json"
                                        disable={{ expand: true }}
                                        default={{ wrap: true }}
                                    >
                                        {JSON.stringify(toolInvocation.input, null, 2) ??
                                            "undefined"}
                                    </Codeblock>
                                </div>

                                {toolInvocation.state === "output-available" &&
                                    toolInvocation.output !== undefined && (
                                        <>
                                            <span className="font-medium text-foreground text-sm">
                                                Result
                                            </span>
                                            <div className="mt-2 mb-3">
                                                <Codeblock
                                                    className="language-json"
                                                    disable={{ expand: true }}
                                                    default={{ wrap: true }}
                                                >
                                                    {JSON.stringify(
                                                        toolInvocation.output,
                                                        null,
                                                        2
                                                    ) ?? "undefined"}
                                                </Codeblock>
                                            </div>
                                        </>
                                    )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }
)

GenericToolRenderer.displayName = "GenericToolRenderer"
