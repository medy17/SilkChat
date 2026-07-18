import {
    TABULAR_PREVIEW_MAX_COLUMNS,
    TABULAR_PREVIEW_MAX_ROWS,
    getTabularDelimiter,
    parseDelimitedTextPreview
} from "@/lib/tabular-file-preview"
import { useEffect, useState } from "react"
import { Loader } from "./ui/loader"

type PreviewState =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; rows: string[][]; truncated: boolean }

export const TabularFilePreview = ({
    url,
    filename,
    mediaType
}: {
    url: string
    filename: string
    mediaType?: string
}) => {
    const [state, setState] = useState<PreviewState>({ status: "loading" })

    useEffect(() => {
        const controller = new AbortController()
        setState({ status: "loading" })

        void (async () => {
            try {
                const response = await fetch(url, { signal: controller.signal })
                if (!response.ok) throw new Error(`Preview request failed (${response.status})`)
                const parsed = parseDelimitedTextPreview(
                    await response.text(),
                    getTabularDelimiter(filename, mediaType)
                )
                setState({ status: "ready", ...parsed })
            } catch (error) {
                if (controller.signal.aborted) return
                setState({
                    status: "error",
                    message: error instanceof Error ? error.message : "Unable to preview this file"
                })
            }
        })()

        return () => controller.abort()
    }, [filename, mediaType, url])

    if (state.status === "loading") {
        return (
            <div className="flex min-h-48 items-center justify-center text-muted-foreground">
                <Loader className="size-5" />
            </div>
        )
    }

    if (state.status === "error") {
        return (
            <div className="rounded-[var(--radius-md)] border bg-muted/40 p-4 text-sm">
                <p className="font-medium">Preview unavailable</p>
                <p className="mt-1 text-muted-foreground">{state.message}</p>
            </div>
        )
    }

    if (state.rows.length === 0) {
        return (
            <div className="rounded-[var(--radius-md)] border bg-muted/40 p-4 text-muted-foreground text-sm">
                This file contains no tabular rows.
            </div>
        )
    }

    const [header, ...body] = state.rows
    const columnCount = Math.max(...state.rows.map((row) => row.length))
    const columns = Array.from({ length: columnCount }, (_, index) => header[index] ?? "")

    return (
        <div className="space-y-2">
            <div className="max-h-[69dvh] overflow-auto rounded-[var(--radius-md)] border">
                <table className="w-max min-w-full border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-background shadow-sm">
                        <tr>
                            {columns.map((cell, index) => (
                                <th
                                    className="max-w-80 border-r border-b px-3 py-2 font-medium last:border-r-0"
                                    key={`header-${index}`}
                                >
                                    <span className="block whitespace-pre-wrap break-words">
                                        {cell || `Column ${index + 1}`}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {body.map((row, rowIndex) => (
                            <tr className="odd:bg-muted/30" key={`row-${rowIndex}`}>
                                {columns.map((_, columnIndex) => (
                                    <td
                                        className="max-w-80 border-r border-b px-3 py-2 align-top last:border-r-0"
                                        key={`cell-${rowIndex}-${columnIndex}`}
                                    >
                                        <span className="block whitespace-pre-wrap break-words">
                                            {row[columnIndex] ?? ""}
                                        </span>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {state.truncated && (
                <p className="text-muted-foreground text-xs">
                    Preview limited to {TABULAR_PREVIEW_MAX_ROWS} rows and{" "}
                    {TABULAR_PREVIEW_MAX_COLUMNS} columns. Download the file for the complete
                    dataset.
                </p>
            )}
        </div>
    )
}
