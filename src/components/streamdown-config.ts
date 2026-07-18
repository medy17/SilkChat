import { cn } from "@/lib/utils"
import { code } from "@streamdown/code"
import { math } from "@streamdown/math"
import type React from "react"
import { Fragment, createElement, isValidElement } from "react"
import type { Components, ExtraProps, PluginConfig } from "streamdown"
import { Codeblock } from "./codeblock"
import { MarkdownTable } from "./markdown-table"

export const streamdownPlugins: PluginConfig = {
    code,
    math
}

const Paragraph = ({
    children,
    className,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["p"] & ExtraProps) => {
    const renderedChildren = Array.isArray(children) ? children : [children]
    const visibleChildren = renderedChildren.filter((child) => child !== null && child !== "")

    if (visibleChildren.length === 1 && isValidElement(visibleChildren[0])) {
        const childProps = visibleChildren[0].props as { node?: unknown; "data-block"?: unknown }
        const node = childProps && typeof childProps === "object" ? childProps.node : undefined
        const tagName =
            node && typeof node === "object" && "tagName" in node ? node.tagName : undefined

        if (tagName === "img") return createElement(Fragment, null, children)

        if (
            tagName === "code" &&
            childProps &&
            typeof childProps === "object" &&
            "data-block" in childProps
        ) {
            return createElement(Fragment, null, children)
        }
    }

    return createElement("p", {
        className: cn("my-3 whitespace-pre-wrap leading-7 first:mt-0 last:mb-0", className),
        ...props,
        children
    })
}

const UnorderedList = ({
    className,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["ul"] & ExtraProps) =>
    createElement("ul", {
        className: cn(
            "my-3 list-inside list-disc space-y-1 whitespace-normal [li_&]:pl-6",
            className
        ),
        ...props
    })

const OrderedList = ({
    className,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["ol"] & ExtraProps) =>
    createElement("ol", {
        className: cn(
            "my-3 list-inside list-decimal space-y-1 whitespace-normal [li_&]:pl-6",
            className
        ),
        ...props
    })

const ListItem = ({
    className,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["li"] & ExtraProps) =>
    createElement("li", {
        className: cn("py-1 leading-7 [&>p]:inline", className),
        ...props
    })

const Blockquote = ({
    className,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["blockquote"] & ExtraProps) =>
    createElement("blockquote", {
        className: cn(
            "my-4 border-muted-foreground/30 border-l-4 pl-4 text-muted-foreground italic",
            className
        ),
        ...props
    })

const HorizontalRule = ({
    className,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["hr"] & ExtraProps) =>
    createElement("hr", { className: cn("my-6 border-border", className), ...props })

const Heading1 = ({
    className,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["h1"] & ExtraProps) =>
    createElement("h1", {
        className: cn("mt-6 mb-3 font-semibold text-3xl leading-tight first:mt-0", className),
        ...props
    })

const Heading2 = ({
    className,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["h2"] & ExtraProps) =>
    createElement("h2", {
        className: cn("mt-6 mb-3 font-semibold text-2xl leading-tight first:mt-0", className),
        ...props
    })

const Heading3 = ({
    className,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["h3"] & ExtraProps) =>
    createElement("h3", {
        className: cn("mt-5 mb-2 font-semibold text-xl leading-snug first:mt-0", className),
        ...props
    })

const Heading4 = ({
    className,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["h4"] & ExtraProps) =>
    createElement("h4", {
        className: cn("mt-5 mb-2 font-semibold text-lg leading-snug first:mt-0", className),
        ...props
    })

const Heading5 = ({
    className,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["h5"] & ExtraProps) =>
    createElement("h5", {
        className: cn("mt-4 mb-2 font-semibold text-base leading-snug first:mt-0", className),
        ...props
    })

const Heading6 = ({
    className,
    node: _node,
    ...props
}: React.JSX.IntrinsicElements["h6"] & ExtraProps) =>
    createElement("h6", {
        className: cn("mt-4 mb-2 font-semibold text-sm leading-snug first:mt-0", className),
        ...props
    })

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
    code: Codeblock,
    blockquote: Blockquote,
    h1: Heading1,
    h2: Heading2,
    h3: Heading3,
    h4: Heading4,
    h5: Heading5,
    h6: Heading6,
    hr: HorizontalRule,
    inlineCode: Codeblock,
    li: ListItem,
    ol: OrderedList,
    p: Paragraph,
    table: MarkdownTable,
    thead: TableHead,
    tbody: TableBody,
    tr: TableRow,
    th: TableHeadCell,
    td: TableCell,
    ul: UnorderedList
}
