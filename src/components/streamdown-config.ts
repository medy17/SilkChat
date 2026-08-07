import { cn } from "@/lib/utils"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import type React from "react"
import { createElement } from "react"
import type { Components, ExtraProps, PluginConfig } from "streamdown"
import { Codeblock } from "./codeblock"
import { MarkdownTable } from "./markdown-table"

export const streamdownPlugins: PluginConfig = {
    code,
    math
}

const TableHead = ({
    className,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["thead"] & ExtraProps) =>
    createElement("thead", { className: cn("bg-secondary/50", className), ...props })

const TableBody = ({
    className,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["tbody"] & ExtraProps) =>
    createElement("tbody", {
        className: cn("divide-y divide-border bg-background", className),
        ...props
    })

const TableRow = ({
    className,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["tr"] & ExtraProps) =>
    createElement("tr", { className: cn("border-border align-top", className), ...props })

const TableHeadCell = ({
    className,
    children,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["th"] & ExtraProps) =>
    createElement(
        "th",
        {
            className: cn(
                "min-w-40 px-4 py-3 text-left align-top font-semibold text-sm",
                className
            ),
            ...props
        },
        createElement("span", { className: "block max-w-96" }, children)
    )

const TableCell = ({
    className,
    children,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["td"] & ExtraProps) =>
    createElement(
        "td",
        {
            className: cn("min-w-40 px-4 py-3 align-top text-sm", className),
            ...props
        },
        createElement("span", { className: "block max-w-96" }, children)
    )

export const streamdownComponents: Components = {
    code: Codeblock as Components["code"],
    inlineCode: Codeblock as Components["inlineCode"],
    table: MarkdownTable,
    thead: TableHead,
    tbody: TableBody,
    tr: TableRow,
    th: TableHeadCell,
    td: TableCell
}
