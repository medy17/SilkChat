import { forwardRef, useCallback, useImperativeHandle, useState } from "react"
import { ThreadItemDialogs } from "./thread-item-dialogs"
import type { SidebarProject, Thread } from "./types"

export interface SidebarDialogsHandle {
    openRename: (thread: Thread) => void
    openMove: (thread: Thread) => void
    openDelete: (thread: Thread) => void
}

interface SidebarDialogsContainerProps {
    projects: SidebarProject[]
}

export const SidebarDialogsContainer = forwardRef<
    SidebarDialogsHandle,
    SidebarDialogsContainerProps
>(function SidebarDialogsContainer({ projects }, ref) {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [showRenameDialog, setShowRenameDialog] = useState(false)
    const [showMoveDialog, setShowMoveDialog] = useState(false)
    const [currentThread, setCurrentThread] = useState<Thread | null>(null)

    useImperativeHandle(
        ref,
        () => ({
            openRename: (thread: Thread) => {
                setCurrentThread(thread)
                setShowRenameDialog(true)
            },
            openMove: (thread: Thread) => {
                setCurrentThread(thread)
                setShowMoveDialog(true)
            },
            openDelete: (thread: Thread) => {
                setCurrentThread(thread)
                setShowDeleteDialog(true)
            }
        }),
        []
    )

    const handleCloseRenameDialog = useCallback(() => {
        setShowRenameDialog(false)
        setTimeout(() => {
            if (!showRenameDialog && !showMoveDialog && !showDeleteDialog) {
                setCurrentThread(null)
            }
        }, 150)
    }, [showRenameDialog, showMoveDialog, showDeleteDialog])

    const handleCloseMoveDialog = useCallback(() => {
        setShowMoveDialog(false)
        setTimeout(() => {
            if (!showRenameDialog && !showMoveDialog && !showDeleteDialog) {
                setCurrentThread(null)
            }
        }, 150)
    }, [showRenameDialog, showMoveDialog, showDeleteDialog])

    const handleCloseDeleteDialog = useCallback(() => {
        setShowDeleteDialog(false)
        setTimeout(() => {
            if (!showRenameDialog && !showMoveDialog && !showDeleteDialog) {
                setCurrentThread(null)
            }
        }, 150)
    }, [showRenameDialog, showMoveDialog, showDeleteDialog])

    return (
        <ThreadItemDialogs
            showDeleteDialog={showDeleteDialog}
            showRenameDialog={showRenameDialog}
            showMoveDialog={showMoveDialog}
            onCloseDeleteDialog={handleCloseDeleteDialog}
            onCloseRenameDialog={handleCloseRenameDialog}
            onCloseMoveDialog={handleCloseMoveDialog}
            currentThread={currentThread}
            projects={projects}
        />
    )
})
