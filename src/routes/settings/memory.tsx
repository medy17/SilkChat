import { SettingsLayout } from "@/components/settings/settings-layout"
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
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious
} from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/convex/_generated/api"
import type { SupermemoryMemoryEntry } from "@/convex/lib/supermemory_api"
import { useSession } from "@/hooks/auth-hooks"
import { filterCurrentMemories } from "@/lib/memory"
import { createFileRoute } from "@tanstack/react-router"
import { useAction, useQuery } from "convex/react"
import { BrainCircuit, Pencil, Plus, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

const PAGE_SIZE = 20

type MemoryPage = {
    memoryEntries: SupermemoryMemoryEntry[]
    pagination: {
        currentPage: number
        limit: number
        totalItems: number
        totalPages: number
    }
}

export const Route = createFileRoute("/settings/memory")({
    component: MemorySettingsPage
})

function MemorySettingsPage() {
    const session = useSession()
    const availability = useQuery(api.settings.getToolAvailability, session.user?.id ? {} : "skip")
    const listMemories = useAction(api.supermemory_node.listMemories)
    const createMemory = useAction(api.supermemory_node.createMemory)
    const updateMemory = useAction(api.supermemory_node.updateMemory)
    const forgetMemory = useAction(api.supermemory_node.forgetMemory)

    const [page, setPage] = useState(1)
    const [result, setResult] = useState<MemoryPage | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingMemory, setEditingMemory] = useState<SupermemoryMemoryEntry | null>(null)
    const [draft, setDraft] = useState("")
    const [saving, setSaving] = useState(false)
    const [forgettingMemory, setForgettingMemory] = useState<SupermemoryMemoryEntry | null>(null)
    const [forgetting, setForgetting] = useState(false)

    const memoryAvailable = availability?.supermemory.enabled === true

    const refresh = useCallback(async () => {
        if (!session.user?.id || !memoryAvailable) {
            setLoading(false)
            return
        }

        setLoading(true)
        setLoadError(null)
        try {
            const next = await listMemories({ page, limit: PAGE_SIZE })
            setResult(next as MemoryPage)
        } catch (error) {
            console.error(error)
            setLoadError(error instanceof Error ? error.message : "Could not load memories.")
        } finally {
            setLoading(false)
        }
    }, [listMemories, memoryAvailable, page, session.user?.id])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const openCreateDialog = () => {
        setEditingMemory(null)
        setDraft("")
        setDialogOpen(true)
    }

    const openEditDialog = (memory: SupermemoryMemoryEntry) => {
        setEditingMemory(memory)
        setDraft(memory.memory)
        setDialogOpen(true)
    }

    const handleSave = async () => {
        const content = draft.trim()
        if (!content) return

        setSaving(true)
        try {
            if (editingMemory) {
                await updateMemory({ memoryId: editingMemory.id, content })
                toast.success("Memory updated")
            } else {
                await createMemory({ content })
                toast.success("Memory added")
            }
            setDialogOpen(false)
            if (!editingMemory && page !== 1) {
                setPage(1)
            } else {
                await refresh()
            }
        } catch (error) {
            console.error(error)
            toast.error(editingMemory ? "Failed to update memory" : "Failed to add memory")
        } finally {
            setSaving(false)
        }
    }

    const handleForget = async () => {
        if (!forgettingMemory) return
        setForgetting(true)
        try {
            await forgetMemory({ memoryId: forgettingMemory.id })
            toast.success("Memory forgotten")
            setForgettingMemory(null)
            if (memories.length === 1 && page > 1) {
                setPage((current) => current - 1)
            } else {
                await refresh()
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to forget memory")
        } finally {
            setForgetting(false)
        }
    }

    const memories = filterCurrentMemories(result?.memoryEntries ?? [])
    const canGoPrevious = page > 1
    const canGoNext = page < (result?.pagination.totalPages ?? 1)

    return (
        <SettingsLayout
            title="Memory"
            description="Review and manage what SilkChat remembers about you."
            action={
                memoryAvailable ? (
                    <Button onClick={openCreateDialog}>
                        <Plus className="size-4" />
                        Add memory
                    </Button>
                ) : undefined
            }
        >
            {!session.user?.id ? (
                <p className="text-muted-foreground text-sm">Sign in to manage memory.</p>
            ) : availability === undefined || loading ? (
                <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
            ) : !memoryAvailable ? (
                <div
                    className="border border-border bg-muted/40 p-6"
                    style={{ borderRadius: "var(--radius-lg)" }}
                >
                    <p className="font-medium">Memory isn't available right now</p>
                    <p className="mt-1 text-muted-foreground text-sm">Please try again later.</p>
                </div>
            ) : loadError ? (
                <div
                    className="border border-destructive/40 bg-destructive/5 p-6"
                    style={{ borderRadius: "var(--radius-lg)" }}
                >
                    <p className="font-medium text-destructive">Could not load memories</p>
                    <p className="mt-1 text-muted-foreground text-sm">{loadError}</p>
                    <Button className="mt-4" variant="outline" onClick={() => void refresh()}>
                        Try again
                    </Button>
                </div>
            ) : memories.length === 0 ? (
                <div
                    className="flex flex-col items-center border border-border bg-muted/20 px-6 py-12 text-center"
                    style={{ borderRadius: "var(--radius-lg)" }}
                >
                    <BrainCircuit className="size-8 text-muted-foreground" />
                    <p className="mt-4 font-medium">No memories yet</p>
                    <p className="mt-1 max-w-md text-muted-foreground text-sm">
                        Ask SilkChat to remember something, or add a memory here. Changes requested
                        in chat still require your confirmation.
                    </p>
                </div>
            ) : (
                <div id="memory-list" className="space-y-3">
                    <p className="text-muted-foreground text-sm">
                        {memories.length} saved {memories.length === 1 ? "memory" : "memories"}
                        {canGoPrevious || canGoNext ? " on this page" : ""}
                    </p>
                    {memories.map((memory) => (
                        <article
                            key={memory.id}
                            className="border border-border bg-card p-4 shadow-xs"
                            style={{ borderRadius: "var(--radius-lg)" }}
                        >
                            <div className="flex items-start gap-4">
                                <div className="min-w-0 flex-1">
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                        {memory.memory}
                                    </p>
                                    <p className="mt-3 text-muted-foreground text-xs">
                                        Updated {new Date(memory.updatedAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex shrink-0 gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Edit memory"
                                        onClick={() => openEditDialog(memory)}
                                    >
                                        <Pencil className="size-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive"
                                        aria-label="Forget memory"
                                        onClick={() => setForgettingMemory(memory)}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            </div>
                        </article>
                    ))}

                    {(canGoPrevious || canGoNext) && (
                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        href="#memory-list"
                                        className={
                                            canGoPrevious
                                                ? undefined
                                                : "pointer-events-none opacity-50"
                                        }
                                        onClick={(event) => {
                                            event.preventDefault()
                                            if (canGoPrevious) setPage((current) => current - 1)
                                        }}
                                    />
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationLink
                                        href="#memory-list"
                                        isActive
                                        onClick={(event) => event.preventDefault()}
                                    >
                                        {page}
                                    </PaginationLink>
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationNext
                                        href="#memory-list"
                                        className={
                                            canGoNext ? undefined : "pointer-events-none opacity-50"
                                        }
                                        onClick={(event) => {
                                            event.preventDefault()
                                            if (canGoNext) setPage((current) => current + 1)
                                        }}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    )}
                </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent style={{ borderRadius: "var(--radius-xl)" }}>
                    <DialogHeader>
                        <DialogTitle>{editingMemory ? "Edit memory" : "Add memory"}</DialogTitle>
                        <DialogDescription>
                            Keep memories concise, factual, and useful in future conversations.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="What should SilkChat remember?"
                        className="min-h-32"
                        maxLength={10_000}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            disabled={saving || !draft.trim()}
                            onClick={() => void handleSave()}
                        >
                            {saving ? "Saving…" : editingMemory ? "Save changes" : "Add memory"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={Boolean(forgettingMemory)}
                onOpenChange={(open) => {
                    if (!open && !forgetting) setForgettingMemory(null)
                }}
            >
                <AlertDialogContent style={{ borderRadius: "var(--radius-xl)" }}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Forget this memory?</AlertDialogTitle>
                        <AlertDialogDescription>
                            SilkChat will stop using this memory in future conversations. This
                            cannot be undone from SilkChat.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={forgetting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={forgetting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={(event) => {
                                event.preventDefault()
                                void handleForget()
                            }}
                        >
                            {forgetting ? "Forgetting…" : "Forget memory"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </SettingsLayout>
    )
}
