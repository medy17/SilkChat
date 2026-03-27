import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getProjectColorClasses } from "@/lib/project-constants"
import { cn } from "@/lib/utils"
import type { Project } from "./types"

export function BulkMoveThreadsDialog({
    open,
    onOpenChange,
    selectedThreadsCount,
    bulkMoveProjectId,
    onBulkMoveProjectIdChange,
    isApplyingSelectionAction,
    projects,
    onConfirm
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedThreadsCount: number
    bulkMoveProjectId: string
    onBulkMoveProjectIdChange: (value: string) => void
    isApplyingSelectionAction: boolean
    projects: Project[]
    onConfirm: () => void
}) {
    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!isApplyingSelectionAction || nextOpen) {
                    onOpenChange(nextOpen)
                }
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        Move {selectedThreadsCount} selected thread
                        {selectedThreadsCount === 1 ? "" : "s"}
                    </DialogTitle>
                </DialogHeader>
                <RadioGroup
                    value={bulkMoveProjectId}
                    onValueChange={onBulkMoveProjectIdChange}
                    disabled={isApplyingSelectionAction}
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no-folder" id="bulk-no-folder" />
                        <Label htmlFor="bulk-no-folder" className="cursor-pointer">
                            No Folder
                        </Label>
                    </div>
                    {projects.map((project) => {
                        const colorClasses = getProjectColorClasses(project.color as never)
                        return (
                            <div key={project._id} className="flex items-center space-x-2">
                                <RadioGroupItem value={project._id} id={`bulk-${project._id}`} />
                                <Label
                                    htmlFor={`bulk-${project._id}`}
                                    className="flex cursor-pointer items-center gap-2"
                                >
                                    <div
                                        className={cn(
                                            "flex size-3 rounded-full",
                                            colorClasses.split(" ").slice(1).join(" ")
                                        )}
                                    />
                                    <span>{project.name}</span>
                                </Label>
                            </div>
                        )
                    })}
                </RadioGroup>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isApplyingSelectionAction}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={isApplyingSelectionAction || selectedThreadsCount === 0}
                    >
                        {isApplyingSelectionAction ? "Moving..." : "Move Selected"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function BulkDeleteThreadsDialog({
    open,
    onOpenChange,
    selectedThreadsCount,
    isApplyingSelectionAction,
    onConfirm
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    selectedThreadsCount: number
    isApplyingSelectionAction: boolean
    onConfirm: () => void
}) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Selected Threads</AlertDialogTitle>
                    <AlertDialogDescription>
                        Delete {selectedThreadsCount} selected thread
                        {selectedThreadsCount === 1 ? "" : "s"}? This cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isApplyingSelectionAction}>
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={isApplyingSelectionAction}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isApplyingSelectionAction ? "Deleting..." : "Delete Selected"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
