import { Button } from "@/components/ui/button"
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger
} from "@/components/ui/context-menu"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { copyToClipboard } from "@/lib/utils"
import {
    AlignLeft,
    CheckIcon,
    ChevronDown,
    ChevronUp,
    Code,
    CopyIcon,
    Download,
    FileCode2,
    FileImage,
    Image,
    WrapText
} from "lucide-react"
import { Suspense, lazy, memo, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { CodeBlock as StreamdownCodeBlock, useIsCodeFenceIncomplete } from "streamdown"
import { type ArtifactLanguage, isArtifactSupported } from "./artifact-preview-shared"
import { downloadBlob, mermaidSvgBlob, mermaidSvgToPng } from "./mermaid-export"

const ArtifactPreview = lazy(async () => {
    const mod = await import("./artifact-preview")
    return { default: mod.ArtifactPreview }
})

const isStringChild = (value: React.ReactNode): value is string => typeof value === "string"

const MermaidActions = ({ code, svg }: { code: string; svg: string | null }) => {
    const copyImage = async () => {
        if (!svg) return
        try {
            await navigator.clipboard.write([
                new ClipboardItem({ "image/png": mermaidSvgToPng(svg) })
            ])
            toast.success("Copied Mermaid diagram")
        } catch {
            toast.error("Failed to copy Mermaid diagram")
        }
    }

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(code.trim())
            toast.success("Copied Mermaid code")
        } catch {
            toast.error("Failed to copy Mermaid code")
        }
    }

    const download = async (format: "mmd" | "svg" | "png") => {
        try {
            if (format === "mmd") {
                downloadBlob(new Blob([code], { type: "text/plain;charset=utf-8" }), "diagram.mmd")
            } else if (format === "svg" && svg) {
                downloadBlob(mermaidSvgBlob(svg), "diagram.svg")
            } else if (format === "png" && svg) {
                downloadBlob(await mermaidSvgToPng(svg), "diagram.png")
            }
        } catch {
            toast.error(`Failed to download Mermaid ${format.toUpperCase()}`)
        }
    }

    return (
        <>
            <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                            <Button
                                aria-label="Download Mermaid diagram"
                                className="size-7 rounded-[var(--radius-md)] text-muted-foreground hover:text-foreground"
                                size="icon"
                                type="button"
                                variant="ghost"
                            >
                                <Download className="size-4" />
                            </Button>
                        </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Download Mermaid diagram</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => void download("mmd")}>
                        <FileCode2 className="size-4" />
                        Mermaid code (.mmd)
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={!svg} onSelect={() => void download("svg")}>
                        <Image className="size-4" />
                        SVG
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={!svg} onSelect={() => void download("png")}>
                        <FileImage className="size-4" />
                        PNG
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <ContextMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <ContextMenuTrigger asChild>
                            <Button
                                aria-label="Copy Mermaid diagram as an image"
                                className="size-7 rounded-[var(--radius-md)] text-muted-foreground hover:text-foreground"
                                disabled={!svg}
                                onClick={() => void copyImage()}
                                size="icon"
                                type="button"
                                variant="ghost"
                            >
                                <CopyIcon className="size-4" />
                            </Button>
                        </ContextMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                        Copy image. Right-click or hold for more options.
                    </TooltipContent>
                </Tooltip>
                <ContextMenuContent>
                    <ContextMenuItem disabled={!svg} onSelect={() => void copyImage()}>
                        <Image className="size-4" />
                        Copy image
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => void copyCode()}>
                        <Code className="size-4" />
                        Copy code
                    </ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        </>
    )
}

export const Codeblock = memo(
    ({
        inline,
        className,
        children,
        disable,
        default: defaultProps,
        "data-block": dataBlock,
        ...props
    }: {
        inline?: boolean
        className?: string
        children?: React.ReactNode
        disable?: {
            copy?: boolean
            expand?: boolean
            wrap?: boolean
        }
        default?: {
            expand?: boolean
            wrap?: boolean
        }
        "data-block"?: string
    }) => {
        const match = /language-(\w+)/.exec(className || "")
        const language = match ? match[1] : "plaintext"

        const [isMultiLine, lineNumber] = useMemo(() => {
            const lines =
                [...(Array.isArray(children) ? children : [children])]
                    .filter(isStringChild)
                    .join("")
                    .match(/\n/g)?.length ?? 0
            return [lines > 1, lines]
        }, [children])

        const [didRecentlyCopied, setDidRecentlyCopied] = useState(false)
        const [expanded, setExpanded] = useState(defaultProps?.expand ?? false)
        const [wrapped, setWrapped] = useState(defaultProps?.wrap ?? false)
        const isCodeFenceIncomplete = useIsCodeFenceIncomplete()
        const canPreviewMermaid = !isCodeFenceIncomplete
        const [activeTab, setActiveTab] = useState<"code" | "preview">(() =>
            language === "mermaid" && canPreviewMermaid ? "preview" : "code"
        )
        const wasCodeFenceIncomplete = useRef(isCodeFenceIncomplete)
        const [mermaidSvg, setMermaidSvg] = useState<string | null>(null)

        useEffect(() => {
            const mermaidFenceJustClosed =
                language === "mermaid" && wasCodeFenceIncomplete.current && !isCodeFenceIncomplete

            if (language === "mermaid" && !canPreviewMermaid) setActiveTab("code")
            else if (mermaidFenceJustClosed) setActiveTab("preview")

            wasCodeFenceIncomplete.current = isCodeFenceIncomplete
        }, [canPreviewMermaid, isCodeFenceIncomplete, language])

        const codeString = useMemo(() => {
            return [...(Array.isArray(children) ? children : [children])]
                .filter(isStringChild)
                .join("")
        }, [children])

        const supportsArtifact = useMemo(() => {
            return isArtifactSupported(language)
        }, [language])
        const isBlockCode = dataBlock !== undefined || (!inline && (Boolean(match) || isMultiLine))
        const codeRendererClassName = cn(
            "[&_[data-streamdown=code-block]]:my-0 [&_[data-streamdown=code-block]]:gap-0 [&_[data-streamdown=code-block]]:rounded-none [&_[data-streamdown=code-block]]:border-0 [&_[data-streamdown=code-block]]:bg-transparent [&_[data-streamdown=code-block]]:p-0",
            "[&_[data-streamdown=code-block-header]]:hidden",
            "[&_[data-streamdown=code-block-body]]:rounded-none [&_[data-streamdown=code-block-body]]:border-0 [&_[data-streamdown=code-block-body]]:bg-transparent [&_[data-streamdown=code-block-body]]:p-3",
            "[&_[data-streamdown=code-block-body]_pre]:bg-transparent",
            "[&_[data-streamdown=code-block-body]_code>span]:block [&_[data-streamdown=code-block-body]_code>span]:before:hidden",
            "[&_[data-streamdown=code-block-body]]:overflow-auto",
            !expanded && "[&_[data-streamdown=code-block-body]]:max-h-72",
            wrapped
                ? "[&_[data-streamdown=code-block-body]_code]:whitespace-pre-wrap [&_[data-streamdown=code-block-body]_code]:break-words"
                : "[&_[data-streamdown=code-block-body]_code]:whitespace-pre [&_[data-streamdown=code-block-body]_code]:break-keep"
        )

        if (!children) return null

        return isBlockCode ? (
            <div className="relative mt-1 mb-1 flex flex-col overflow-hidden rounded-lg border border-border bg-code-background text-code-foreground">
                {supportsArtifact ? (
                    <Tabs
                        value={activeTab}
                        onValueChange={(value) => setActiveTab(value as "code" | "preview")}
                        className="gap-0"
                    >
                        <div className="flex items-center gap-2 rounded-t-md border-border border-b bg-code-background px-2 py-1">
                            <span className="pl-2 font-mono text-muted-foreground text-xs">
                                {language}
                            </span>
                            {lineNumber >= 16 && (
                                <span className="pt-0.5 pl-2 font-mono text-muted-foreground/50 text-xs">
                                    {lineNumber + 1} lines
                                </span>
                            )}

                            <TabsList className="h-7 p-0.5">
                                <TabsTrigger value="code" className="h-6 px-2 text-xs shadow-none">
                                    Code
                                </TabsTrigger>
                                <TabsTrigger
                                    value="preview"
                                    className="h-6 px-2 text-xs shadow-none"
                                    disabled={language === "mermaid" && !canPreviewMermaid}
                                >
                                    Preview
                                </TabsTrigger>
                            </TabsList>
                            <div className="flex-grow" />

                            {language === "mermaid" && activeTab === "preview" && (
                                <MermaidActions code={codeString} svg={mermaidSvg} />
                            )}

                            {lineNumber >= 16 && !disable?.expand && activeTab === "code" && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-[1.5rem] w-[1.5rem] text-muted-foreground"
                                            onClick={() => setExpanded((t) => !t)}
                                        >
                                            {expanded ? (
                                                <ChevronUp className="!size-4" />
                                            ) : (
                                                <ChevronDown className="!size-4" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {expanded ? "Collapse" : "Expand"}
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            {!disable?.wrap && activeTab === "code" && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-[1.5rem] w-[1.5rem] text-muted-foreground"
                                            onClick={() => setWrapped((t) => !t)}
                                        >
                                            {wrapped ? (
                                                <WrapText className="!size-4" />
                                            ) : (
                                                <AlignLeft className="!size-4" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {wrapped ? "Unwrap lines" : "Wrap lines"}
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            {!disable?.copy &&
                                !(language === "mermaid" && activeTab === "preview") && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-[1.5rem] w-[1.5rem] text-muted-foreground"
                                                onClick={() => {
                                                    copyToClipboard(codeString)
                                                    setDidRecentlyCopied(true)
                                                    setTimeout(() => {
                                                        setDidRecentlyCopied(false)
                                                    }, 1000)
                                                }}
                                            >
                                                {didRecentlyCopied ? (
                                                    <CheckIcon className="size-4" />
                                                ) : (
                                                    <CopyIcon className="size-4" />
                                                )}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {didRecentlyCopied ? "Copied!" : "Copy code"}
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                        </div>

                        <TabsContent value="code" className="mt-0">
                            <div className="relative h-full">
                                <div className={codeRendererClassName}>
                                    <StreamdownCodeBlock
                                        code={codeString}
                                        language={language}
                                        lineNumbers={true}
                                    />
                                </div>

                                {!expanded && lineNumber > 17 && (
                                    <div className="absolute right-0 bottom-0 left-0 flex h-12 justify-center rounded-b-md bg-gradient-to-t from-sidebar via-sidebar/80 to-transparent">
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() => setExpanded(true)}
                                            className="h-[1.5rem] gap-1.5 rounded-md shadow-lg"
                                        >
                                            {lineNumber - 17} more lines
                                            <ChevronDown className="!size-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="preview" className="mt-0">
                            {typeof window === "undefined" ? (
                                <div className="p-4 text-center text-muted-foreground text-sm">
                                    Preview loads on the client.
                                </div>
                            ) : (
                                <Suspense
                                    fallback={
                                        <div className="p-4 text-center text-muted-foreground text-sm">
                                            Loading preview...
                                        </div>
                                    }
                                >
                                    <ArtifactPreview
                                        code={codeString}
                                        language={language as ArtifactLanguage}
                                        onMermaidSvgChange={setMermaidSvg}
                                    />
                                </Suspense>
                            )}
                        </TabsContent>
                    </Tabs>
                ) : (
                    <>
                        <div className="flex items-center gap-2 rounded-t-md border-border border-b bg-code-background px-2 py-1">
                            <span className="pl-2 font-mono text-muted-foreground text-xs">
                                {language}
                            </span>
                            {lineNumber >= 16 && (
                                <span className="pt-0.5 pl-2 font-mono text-muted-foreground/50 text-xs">
                                    {lineNumber + 1} lines
                                </span>
                            )}
                            <div className="flex-grow" />
                            {lineNumber >= 16 && !disable?.expand && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-[1.5rem] w-[1.5rem] text-muted-foreground"
                                            onClick={() => setExpanded((t) => !t)}
                                        >
                                            {expanded ? (
                                                <ChevronUp className="!size-4" />
                                            ) : (
                                                <ChevronDown className="!size-4" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {expanded ? "Collapse" : "Expand"}
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            {!disable?.wrap && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-[1.5rem] w-[1.5rem] text-muted-foreground"
                                            onClick={() => setWrapped((t) => !t)}
                                        >
                                            {wrapped ? (
                                                <WrapText className="!size-4" />
                                            ) : (
                                                <AlignLeft className="!size-4" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {wrapped ? "Unwrap lines" : "Wrap lines"}
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            {!disable?.copy && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-[1.5rem] w-[1.5rem] text-muted-foreground"
                                            onClick={() => {
                                                copyToClipboard(codeString)
                                                setDidRecentlyCopied(true)
                                                setTimeout(() => {
                                                    setDidRecentlyCopied(false)
                                                }, 1000)
                                            }}
                                        >
                                            {didRecentlyCopied ? (
                                                <CheckIcon className="size-4" />
                                            ) : (
                                                <CopyIcon className="size-4" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {didRecentlyCopied ? "Copied!" : "Copy code"}
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>

                        <div className={codeRendererClassName}>
                            <StreamdownCodeBlock
                                code={codeString}
                                language={language}
                                lineNumbers={true}
                            />
                        </div>

                        {!expanded && lineNumber > 17 && (
                            <div className="absolute right-0 bottom-0 left-0 flex h-16 justify-center rounded-b-md bg-gradient-to-t from-sidebar via-sidebar/80 to-transparent">
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => setExpanded(true)}
                                    className="h-[1.5rem] gap-1.5 rounded-md shadow-lg"
                                >
                                    {lineNumber - 17} more lines
                                    <ChevronDown className="!size-4" />
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        ) : (
            <code
                className={cn(
                    className,
                    "rounded-md border border-primary/20 bg-primary/10 px-1 py-0.5 font-medium font-mono text-foreground/80 text-sm leading-4"
                )}
                {...props}
            >
                {children}
            </code>
        )
    }
)
Codeblock.displayName = "Codeblock"
