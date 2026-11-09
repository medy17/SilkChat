import { ComposerMorph } from "@/components/composer/morph"
import { PILL_SPLIT_TRANSITION } from "@/components/stick-to-bottom-button"
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
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle
} from "@/components/ui/drawer"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useSession } from "@/hooks/auth-hooks"
import { useIsMobile } from "@/hooks/use-mobile"
import { useThreadDraftCleanup } from "@/hooks/use-thread-draft-cleanup"
import { useModelStore } from "@/lib/model-store"
import {
    forgetTemporaryThread,
    getTemporaryThreadIdFromPath,
    isTemporaryThreadOwnedHere,
    useTemporaryChatStore
} from "@/lib/temporary-chat"
import { cn } from "@/lib/utils"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { useQuery } from "convex-helpers/react/cache"
import { useMutation } from "convex/react"
import { Check, MessageCircle, MessageCircleDashed } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

// How long the chip reads "Kept" before it leaves.
const KEPT_NOTICE_MS = 1600

// The composer's copy of the chat's tools, which later turns send. The server already added
// memory to the chat's saved tools, for other tabs and reloads.
const addMemoryToChatTools = (threadId: string) => {
    const state = useModelStore.getState()
    const current =
        state.conversationTools[threadId] ??
        (state.toolThreadId === threadId ? state.enabledTools : [])
    if (current.includes("supermemory")) return
    const next = [...current, "supermemory" as const]
    if (state.toolThreadId === threadId) {
        state.setConversationTools(next)
    } else {
        useModelStore.setState({
            conversationTools: { ...state.conversationTools, [threadId]: next }
        })
    }
}

function KeepTemporaryChatDialog({
    threadId,
    open,
    onOpenChange,
    onKept,
    onCloseAutoFocus
}: {
    threadId: Id<"threads">
    open: boolean
    onOpenChange: (open: boolean) => void
    // The chip confirms a kept chat itself, so there is no toast for it.
    onKept: () => void
    onCloseAutoFocus: (event: Event) => void
}) {
    const isMobile = useIsMobile()
    const [isKeeping, setIsKeeping] = useState(false)
    const keepThread = useMutation(api.threads.keepTemporaryThread)

    const handleKeep = async (usePersonalization: boolean) => {
        setIsKeeping(true)
        try {
            // Memory was stripped from this chat's tools while it was temporary. Personalizing
            // puts it back when the user's tool choice for chats would include it: auto mode
            // can pick it, and manual mode keeps it only if it's among their tools.
            const { autoSelectTools, manualTools } = useModelStore.getState()
            const restoreMemory =
                usePersonalization && (autoSelectTools || manualTools.includes("supermemory"))
            const result = await keepThread({ threadId, usePersonalization, restoreMemory })
            if (result && "error" in result) throw new Error(String(result.error))
            if (restoreMemory) addMemoryToChatTools(threadId)
            forgetTemporaryThread(threadId)
            onKept()
            onOpenChange(false)
        } catch (error) {
            console.error("Failed to keep temporary chat:", error)
            toast.error("Couldn't keep this chat")
        } finally {
            setIsKeeping(false)
        }
    }

    const title = "Keep this chat"
    const description =
        "Personalize it to apply your custom instructions, response styles, and memory from here on."
    const keepAsIsButton = (
        <Button variant="outline" onClick={() => handleKeep(false)} disabled={isKeeping}>
            Keep as is
        </Button>
    )
    const keepAndPersonalizeButton = (
        <Button onClick={() => handleKeep(true)} disabled={isKeeping}>
            Keep & personalize
        </Button>
    )

    if (isMobile) {
        // Three buttons don't fit across a narrow phone, so the drawer drops Cancel: it
        // already closes with a swipe down or a tap outside.
        return (
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent onCloseAutoFocus={onCloseAutoFocus}>
                    <DrawerHeader>
                        <DrawerTitle>{title}</DrawerTitle>
                        <DrawerDescription>{description}</DrawerDescription>
                    </DrawerHeader>
                    <DrawerFooter className="flex-row *:flex-1">
                        {keepAsIsButton}
                        {keepAndPersonalizeButton}
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isKeeping}
                    >
                        Cancel
                    </Button>
                    {keepAsIsButton}
                    {keepAndPersonalizeButton}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// Removes a temporary chat when this tab leaves it, and sends anyone who reaches one from
// elsewhere (history, a pasted link, another device) back to a new chat.
function useTemporaryChatLifecycle(
    threadId: string | undefined,
    thread: { temporaryExpiresAt?: number } | null | undefined
) {
    const navigate = useNavigate()
    const discardThread = useMutation(api.threads.discardTemporaryThread)
    const { deleteThreadDraft } = useThreadDraftCleanup()
    const previousThreadIdRef = useRef(threadId)

    useEffect(() => {
        const previousThreadId = previousThreadIdRef.current
        previousThreadIdRef.current = threadId
        if (!previousThreadId || previousThreadId === threadId) return
        if (!isTemporaryThreadOwnedHere(previousThreadId)) return

        // The server keeps a chat that is still streaming or was kept; the sweep handles
        // the first, and keeping already dropped the marker.
        void discardThread({ threadId: previousThreadId as Id<"threads"> })
            .then((result) => {
                if (result && "discarded" in result && result.discarded) {
                    forgetTemporaryThread(previousThreadId)
                    deleteThreadDraft(previousThreadId)
                }
            })
            .catch((error) => console.error("Failed to discard temporary chat:", error))
    }, [deleteThreadDraft, discardThread, threadId])

    const isForeignTemporaryThread =
        Boolean(threadId) &&
        thread?.temporaryExpiresAt !== undefined &&
        !isTemporaryThreadOwnedHere(threadId as string)

    useEffect(() => {
        if (!isForeignTemporaryThread) return
        toast("That temporary chat has ended")
        void navigate({ to: "/", replace: true })
    }, [isForeignTemporaryThread, navigate])
}

// Mounted once for the whole chat layout, so leaving a temporary chat is noticed wherever
// the user goes next.
export function TemporaryChatLifecycle() {
    const { data: session } = useSession()
    const location = useLocation()
    const threadId = getTemporaryThreadIdFromPath(location.pathname)
    const thread = useQuery(
        api.threads.getThread,
        session?.user?.id && threadId ? { threadId: threadId as Id<"threads"> } : "skip"
    )
    useTemporaryChatLifecycle(threadId, thread)
    return null
}

// Last of the new-chat starter rows: a command that turns the next chat temporary, or back.
export function TemporaryChatStarterRow({ className }: { className?: string }) {
    const draftEnabled = useTemporaryChatStore((state) => state.draftEnabled)
    const isSending = useTemporaryChatStore((state) => state.pendingMessageId !== undefined)
    const setDraftEnabled = useTemporaryChatStore((state) => state.setDraftEnabled)
    const Icon = draftEnabled ? MessageCircle : MessageCircleDashed

    return (
        <button
            type="button"
            onClick={() => setDraftEnabled(!draftEnabled)}
            disabled={isSending}
            className={cn(
                "flex w-full items-center gap-3 px-3 py-2 text-left text-foreground text-sm transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
                className
            )}
            style={{ borderRadius: "var(--radius-md)" }}
        >
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>{draftEnabled ? "Back to a normal chat" : "Start a temporary chat"}</span>
        </button>
    )
}

// Floats above the composer for the whole temporary chat. Scroll to bottom splits off its
// right side when it's needed, and the two merge back when it goes.
export function TemporaryChatKeepChip({
    threadId,
    isTemporary,
    onKept
}: {
    threadId: string | undefined
    isTemporary: boolean
    // Focus goes here once the dialog closes, since the chip is about to leave.
    onKept: () => void
}) {
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [isKeptNoticeVisible, setIsKeptNoticeVisible] = useState(false)
    const didKeepRef = useRef(false)

    useEffect(() => {
        if (!isKeptNoticeVisible) return
        const timer = setTimeout(() => setIsKeptNoticeVisible(false), KEPT_NOTICE_MS)
        return () => clearTimeout(timer)
    }, [isKeptNoticeVisible])

    const isOwnedTemporaryThread =
        isTemporary && Boolean(threadId) && isTemporaryThreadOwnedHere(threadId as string)
    const isVisible = isOwnedTemporaryThread || isKeptNoticeVisible

    return (
        <>
            <AnimatePresence mode="popLayout">
                {isVisible && (
                    <motion.div
                        layout="position"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{
                            duration: 0.1,
                            ease: "easeOut",
                            layout: PILL_SPLIT_TRANSITION
                        }}
                        // Above Scroll to bottom, which slides out from underneath it, and
                        // fully round like it. Like that pill, it keeps its own layer and
                        // skips scaling, so its text never changes weight as a move ends.
                        className="glass-surface relative z-10 flex h-8 items-center rounded-full border text-sm will-change-transform"
                    >
                        <ComposerMorph contentKey={isKeptNoticeVisible ? "kept" : "temporary"}>
                            {isKeptNoticeVisible ? (
                                <span className="flex items-center gap-1.5 px-3 text-foreground">
                                    <Check className="size-4" aria-hidden="true" />
                                    Kept
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 pr-1 pl-3">
                                    <MessageCircleDashed
                                        className="size-4 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <span className="text-muted-foreground">Temporary chat</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 rounded-full px-2 font-medium text-foreground"
                                        onClick={() => setIsDialogOpen(true)}
                                    >
                                        Keep
                                    </Button>
                                </span>
                            )}
                        </ComposerMorph>
                    </motion.div>
                )}
            </AnimatePresence>
            <span role="status" className="sr-only">
                {isKeptNoticeVisible ? "Chat kept" : ""}
            </span>
            {threadId && (
                <KeepTemporaryChatDialog
                    threadId={threadId as Id<"threads">}
                    open={isDialogOpen}
                    onOpenChange={setIsDialogOpen}
                    onKept={() => {
                        didKeepRef.current = true
                        setIsKeptNoticeVisible(true)
                    }}
                    onCloseAutoFocus={(event) => {
                        if (!didKeepRef.current) return
                        didKeepRef.current = false
                        event.preventDefault()
                        onKept()
                    }}
                />
            )}
        </>
    )
}
