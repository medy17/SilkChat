import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useIsMobile } from "@/hooks/use-mobile"
import { DEFAULT_PROJECT_ICON, PROJECT_COLORS } from "@/lib/project-constants"
import { cn } from "@/lib/utils"
import { useMutation } from "convex/react"
import { Check, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export function FolderForm({
    idPrefix,
    name,
    setName,
    description,
    setDescription,
    color: selectedColor,
    setColor,
    disabled,
    onSubmit
}: {
    idPrefix: string
    name: string
    setName: (v: string) => void
    description: string
    setDescription: (v: string) => void
    color: string
    setColor: (v: string) => void
    disabled: boolean
    onSubmit: () => void
}) {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-name`}>Name</Label>
                <Input
                    id={`${idPrefix}-name`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter folder name"
                    className="max-w-full sm:max-w-[50%]"
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !disabled) {
                            onSubmit()
                        }
                    }}
                    disabled={disabled}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-description`}>Description (Optional)</Label>
                <Input
                    id={`${idPrefix}-description`}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter folder description"
                    disabled={disabled}
                />
            </div>

            <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                    {PROJECT_COLORS.map((color) => (
                        <button
                            key={color.id}
                            type="button"
                            onClick={() => setColor(color.id)}
                            disabled={disabled}
                            className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-[border-color,transform]",
                                color.class.split(" ").slice(1).join(" "),
                                selectedColor === color.id
                                    ? "scale-110 border-foreground"
                                    : "border-transparent hover:scale-105"
                            )}
                        >
                            {selectedColor === color.id && (
                                <Check className="h-4 w-4 text-white drop-shadow-sm" />
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

export function NewFolderDialog({
    open,
    onOpenChange,
    onSuccess,
    className
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: (projectId: Id<"projects">) => void
    className?: string
}) {
    const isMobile = useIsMobile()
    const [folderName, setFolderName] = useState("")
    const [folderDescription, setFolderDescription] = useState("")
    const [folderColor, setFolderColor] = useState<string>("blue")
    const [isCreating, setIsCreating] = useState(false)
    const createProjectMutation = useMutation(api.folders.createProject)

    const handleCreate = async () => {
        const trimmedName = folderName.trim()
        if (!trimmedName) {
            toast.error("Folder name cannot be empty")
            return
        }

        setIsCreating(true)
        try {
            const result = await createProjectMutation({
                name: trimmedName,
                description: folderDescription.trim() || undefined,
                icon: DEFAULT_PROJECT_ICON,
                color: folderColor
            })

            if (result && !("error" in result) && "projectId" in result) {
                toast.success("Folder created successfully")
                setFolderName("")
                setFolderDescription("")
                setFolderColor("blue")
                onOpenChange(false)
                onSuccess?.(result.projectId as Id<"projects">)
            } else {
                toast.error("Failed to create folder")
            }
        } catch (error) {
            console.error("Failed to create folder:", error)
            toast.error("Failed to create folder")
        } finally {
            setIsCreating(false)
        }
    }

    const formProps = {
        idPrefix: "folder",
        name: folderName,
        setName: setFolderName,
        description: folderDescription,
        setDescription: setFolderDescription,
        color: folderColor,
        setColor: setFolderColor,
        disabled: isCreating,
        onSubmit: handleCreate
    }

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent className={cn("z-[70]", className)} overlayClassName="z-[70]">
                    <DrawerHeader>
                        <DrawerTitle>Create New Folder</DrawerTitle>
                        <DrawerDescription>
                            Folders are a great way to organize your threads
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="overflow-y-auto px-4 pb-2">
                        <FolderForm {...formProps} />
                    </div>
                    <DrawerFooter>
                        <DrawerClose asChild>
                            <Button variant="outline" disabled={isCreating}>
                                Cancel
                            </Button>
                        </DrawerClose>
                        <Button onClick={handleCreate} disabled={isCreating || !folderName.trim()}>
                            {isCreating ? "Creating..." : "Create"}
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn("max-w-md", className)}>
                <DialogHeader>
                    <DialogTitle>Create New Folder</DialogTitle>
                    <DialogDescription>
                        Folders are a great way to organize your threads
                    </DialogDescription>
                </DialogHeader>
                <FolderForm {...formProps} />
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isCreating}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleCreate} disabled={isCreating || !folderName.trim()}>
                        {isCreating ? "Creating..." : "Create"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export function NewFolderButton({
    onClick,
    onSuccess
}: {
    onClick?: () => void
    onSuccess?: (projectId: Id<"projects">) => void
}) {
    const [showDialog, setShowDialog] = useState(false)

    return (
        <>
            <Button
                size="sm"
                variant={"ghost"}
                onClick={() => {
                    setShowDialog(true)
                    onClick?.()
                }}
                className="size-6 text-muted-foreground"
            >
                <Plus className="size-4" />
                <span className="sr-only">New folder</span>
            </Button>

            <NewFolderDialog open={showDialog} onOpenChange={setShowDialog} onSuccess={onSuccess} />
        </>
    )
}
