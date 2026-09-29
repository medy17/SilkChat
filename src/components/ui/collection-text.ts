import { Children, isValidElement, type ReactNode } from "react"

/** Icons and decorative elements do not contribute to typeahead text. */
export function collectionText(children: ReactNode): string {
    return Children.toArray(children)
        .map((child) => {
            if (typeof child === "string" || typeof child === "number") return String(child)
            if (
                isValidElement<{
                    children?: ReactNode
                    "aria-hidden"?: boolean | "true" | "false"
                }>(child) &&
                child.props["aria-hidden"] !== true &&
                child.props["aria-hidden"] !== "true"
            )
                return collectionText(child.props.children)
            return ""
        })
        .join(" ")
        .trim()
}
