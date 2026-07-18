import { MarkdownIcon } from "@/components/brand-icons"
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"
import { Check, Code, Copy, Download, FileText, Maximize2, Minimize2 } from "lucide-react"
import type React from "react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { ExtraProps } from "streamdown"

const extractTableRows = (table: HTMLTableElement) =>
    Array.from(table.rows, (row) => Array.from(row.cells, (cell) => cell.textContent?.trim() ?? ""))

const escapeCsvCell = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value

export const tableRowsToCsv = (rows: string[][]) =>
    rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")

export const tableRowsToPlainText = (rows: string[][]) =>
    rows.map((row) => row.join("\t")).join("\n")

const escapeMarkdownCell = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ")

export const tableRowsToMarkdown = (rows: string[][]) => {
    if (rows.length === 0) return ""

    const columnCount = Math.max(...rows.map((row) => row.length))
    const normalizeRow = (row: string[]) =>
        Array.from({ length: columnCount }, (_, index) => escapeMarkdownCell(row[index] ?? ""))

    const [header, ...body] = rows.map(normalizeRow)

    return [header, Array.from({ length: columnCount }, () => "---"), ...body]
        .map((row) => `| ${row.join(" | ")} |`)
        .join("\n")
}

type DownloadFormat = "csv" | "markdown"
type CopyFormat = DownloadFormat | "plain"

const downloadTable = (content: string, format: DownloadFormat) => {
    const isCsv = format === "csv"
    const objectUrl = URL.createObjectURL(
        new Blob([isCsv ? `\uFEFF${content}` : content], {
            type: isCsv ? "text/csv;charset=utf-8" : "text/markdown;charset=utf-8"
        })
    )
    const anchor = document.createElement("a")
    anchor.href = objectUrl
    anchor.download = isCsv ? "table.csv" : "table.md"
    anchor.hidden = true
    document.body.appendChild(anchor)

    try {
        anchor.click()
    } finally {
        anchor.remove()
        URL.revokeObjectURL(objectUrl)
    }
}

const TableAction = ({
    label,
    onClick,
    children
}: {
    label: string
    onClick: () => void
    children: React.ReactNode
}) => (
    <Tooltip>
        <TooltipTrigger asChild>
            <Button
                aria-label={label}
                className="size-7 rounded-[var(--radius-md)] text-muted-foreground hover:text-foreground"
                onClick={onClick}
                size="icon"
                type="button"
                variant="ghost"
            >
                {children}
            </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
    </Tooltip>
)

export const MarkdownTable = ({
    className,
    children,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["table"] & ExtraProps) => {
    const tableRef = useRef<HTMLTableElement>(null)
    const copyResetTimer = useRef<number | undefined>(undefined)
    const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
    const [copyTooltipOpen, setCopyTooltipOpen] = useState(false)
    const [expanded, setExpanded] = useState(false)

    useEffect(
        () => () => {
            if (copyResetTimer.current !== undefined) window.clearTimeout(copyResetTimer.current)
        },
        []
    )

    const handleCopy = async (format: CopyFormat) => {
        if (!tableRef.current) return

        const rows = extractTableRows(tableRef.current)
        const content =
            format === "csv"
                ? tableRowsToCsv(rows)
                : format === "plain"
                  ? tableRowsToPlainText(rows)
                  : tableRowsToMarkdown(rows)
        const formatLabel =
            format === "plain" ? "plain text" : format === "csv" ? "CSV" : "Markdown"

        try {
            await navigator.clipboard.writeText(content)

            setCopyFeedback(`Copied as ${formatLabel}`)
            setCopyTooltipOpen(true)
            if (copyResetTimer.current !== undefined) window.clearTimeout(copyResetTimer.current)
            copyResetTimer.current = window.setTimeout(() => {
                setCopyFeedback(null)
                setCopyTooltipOpen(false)
            }, 1500)
        } catch {
            toast.error("Failed to copy table")
        }
    }

    const handleDownload = (format: DownloadFormat) => {
        if (!tableRef.current) return
        const rows = extractTableRows(tableRef.current)
        downloadTable(format === "csv" ? tableRowsToCsv(rows) : tableRowsToMarkdown(rows), format)
    }

    return (
        <div
            className="not-prose my-4 flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-background"
            data-markdown-table
            data-rows-expanded={expanded}
        >
            <ScrollAreaPrimitive.Root
                className={cn(
                    "relative w-full overscroll-x-contain",
                    expanded
                        ? "[&_td>span]:whitespace-normal [&_th>span]:whitespace-normal"
                        : "[&_td>span]:truncate [&_td>span]:whitespace-nowrap [&_th>span]:truncate [&_th>span]:whitespace-nowrap"
                )}
                data-markdown-table-scroll
                type="always"
            >
                <ScrollAreaPrimitive.Viewport
                    className="[&>div]:!block w-full pb-2"
                    data-markdown-table-viewport
                >
                    <table
                        className={cn("w-max min-w-full border-collapse", className)}
                        ref={tableRef}
                        {...props}
                    >
                        {children}
                    </table>
                </ScrollAreaPrimitive.Viewport>
                <ScrollAreaPrimitive.ScrollAreaScrollbar
                    className="flex h-2.5 touch-none select-none flex-col bg-background p-px"
                    data-markdown-table-scrollbar
                    orientation="horizontal"
                >
                    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-[var(--radius-xl)] bg-border" />
                </ScrollAreaPrimitive.ScrollAreaScrollbar>
                <ScrollAreaPrimitive.Corner />
            </ScrollAreaPrimitive.Root>

            <div className="flex h-9 shrink-0 items-center border-border border-t bg-secondary/50 px-2">
                <TableAction
                    label={expanded ? "Collapse all cells" : "Expand all cells"}
                    onClick={() => setExpanded((value) => !value)}
                >
                    {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </TableAction>

                <div className="flex-1" />

                <DropdownMenu>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    aria-label="Download table"
                                    className="size-7 rounded-[var(--radius-md)] text-muted-foreground hover:text-foreground"
                                    size="icon"
                                    type="button"
                                    variant="ghost"
                                >
                                    <Download className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Download table</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => handleDownload("markdown")}>
                            <MarkdownIcon className="size-4" />
                            Markdown
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleDownload("csv")}>
                            <Code className="size-4" />
                            CSV
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <ContextMenu>
                    <Tooltip
                        open={copyTooltipOpen}
                        onOpenChange={(open) => setCopyTooltipOpen(copyFeedback ? true : open)}
                    >
                        <ContextMenuTrigger asChild>
                            <TooltipTrigger asChild>
                                <Button
                                    aria-label="Copy table as Markdown"
                                    className="size-7 rounded-[var(--radius-md)] text-muted-foreground hover:text-foreground"
                                    onClick={() => void handleCopy("markdown")}
                                    size="icon"
                                    type="button"
                                    variant="ghost"
                                >
                                    {copyFeedback ? (
                                        <Check className="size-4" />
                                    ) : (
                                        <Copy className="size-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                        </ContextMenuTrigger>
                        <TooltipContent>
                            {copyFeedback ??
                                "Copy as Markdown. Right-click or hold for more options."}
                        </TooltipContent>
                    </Tooltip>
                    <ContextMenuContent>
                        <ContextMenuItem onSelect={() => void handleCopy("plain")}>
                            <FileText className="size-4" />
                            Plain text
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => void handleCopy("csv")}>
                            <Code className="size-4" />
                            CSV
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => void handleCopy("markdown")}>
                            <MarkdownIcon className="size-4" />
                            Markdown
                        </ContextMenuItem>
                    </ContextMenuContent>
                </ContextMenu>
            </div>
        </div>
    )
}
