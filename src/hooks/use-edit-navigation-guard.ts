import { useBlocker } from "@tanstack/react-router"
import { useCallback } from "react"

// Mounted only while a message is being edited. Query/hash changes within the
// same page do not discard an edit; leaving the page always closes it first.
export function useEditNavigationGuard(hasUnsavedChanges: boolean, cancelEdit: () => void) {
    return useBlocker({
        withResolver: true,
        enableBeforeUnload: hasUnsavedChanges,
        shouldBlockFn: useCallback(
            ({ current, next }: { current: { pathname: string }; next: { pathname: string } }) => {
                if (current.pathname === next.pathname) return false
                if (hasUnsavedChanges) return true
                cancelEdit()
                return false
            },
            [cancelEdit, hasUnsavedChanges]
        )
    })
}
