import type { ReactNode } from "react"

// Keep rendered content alive while editing: code expansion, wrapping, preview
// tabs, and completed highlighting must survive a cancelled edit.
export function MessageEditContent({
    editing,
    editor,
    children
}: {
    editing: boolean
    editor: ReactNode
    children: ReactNode
}) {
    return (
        <>
            {editing ? editor : null}
            <div hidden={editing}>{children}</div>
        </>
    )
}
