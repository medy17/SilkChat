import type { Thread } from "@/components/threads/types"
import { Button } from "@/components/ui/button"
import { CheckCheck, FolderOpen, Pin, Trash2, X } from "lucide-react"

export function SelectionToolbar({
    selectedThreads,
    isApplyingSelectionAction,
    onSelectAllThreads,
    onBulkTogglePin,
    onOpenBulkMoveDialog,
    onOpenBulkDeleteDialog,
    onExitSelectionMode
}: {
    selectedThreads: Thread[]
    isApplyingSelectionAction: boolean
    onSelectAllThreads: () => void
    onBulkTogglePin: () => void
    onOpenBulkMoveDialog: () => void
    onOpenBulkDeleteDialog: () => void
    onExitSelectionMode: () => void
}) {
    if (selectedThreads.length === 0) return null

    return (
        <div className="absolute right-2 bottom-2 left-2 z-20 rounded-lg border bg-sidebar/95 p-2 shadow-lg backdrop-blur">
            <div className="flex items-center gap-2">
                <div className="font-medium text-sm">{selectedThreads.length} selected</div>
                <div className="ml-auto flex items-center gap-1">
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={onSelectAllThreads}
                        disabled={isApplyingSelectionAction}
                        title="Select all loaded threads"
                    >
                        <CheckCheck className="h-4 w-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={onBulkTogglePin}
                        disabled={isApplyingSelectionAction}
                        title={
                            selectedThreads.every((thread) => thread.pinned)
                                ? "Unpin selected"
                                : "Pin selected"
                        }
                    >
                        <Pin className="h-4 w-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={onOpenBulkMoveDialog}
                        disabled={isApplyingSelectionAction}
                        title="Move selected"
                    >
                        <FolderOpen className="h-4 w-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={onOpenBulkDeleteDialog}
                        disabled={isApplyingSelectionAction}
                        title="Delete selected"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={onExitSelectionMode}
                        disabled={isApplyingSelectionAction}
                        title="Exit selection"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
