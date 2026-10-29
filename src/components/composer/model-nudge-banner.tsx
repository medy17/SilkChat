import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

// A tab on the composer's top edge: same material, no bottom edge, so it reads as part of it.
export function ModelNudgeBanner({
    nudge,
    className
}: {
    nudge: {
        replacement: { name: string }
        message: string
        accept: () => void
        dismiss: () => void
    } | null
    className?: string
}) {
    return (
        <AnimatePresence initial={false}>
            {nudge && (
                <motion.div
                    key="model-nudge"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={cn(
                        "pointer-events-auto mx-auto flex w-full justify-center",
                        className
                    )}
                >
                    <div
                        role="status"
                        className="glass-composer flex w-fit max-w-[calc(100%-2rem)] items-center gap-2 rounded-t-[var(--radius-lg)] border border-b-0 py-1.5 pr-1.5 pl-3.5 text-muted-foreground text-xs"
                    >
                        <p className="min-w-0">{nudge.message}</p>
                        <button
                            type="button"
                            onClick={nudge.accept}
                            className="shrink-0 whitespace-nowrap rounded-[var(--radius-sm)] border bg-glass-control px-2.5 py-1 font-medium text-foreground transition-colors hover:bg-glass-control-hover"
                        >
                            Use {nudge.replacement.name}
                        </button>
                        <button
                            type="button"
                            aria-label="Dismiss"
                            onClick={nudge.dismiss}
                            className="flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] transition-colors hover:bg-glass-control-hover hover:text-foreground"
                        >
                            <X className="size-3.5" />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
