import { CircularLoader } from "@/components/ui/loader"
import { cn } from "@/lib/utils"
import { motion } from "motion/react"

interface ChatLoadingOverlayProps {
    label: string
    ariaLabel?: string
    className?: string
}

export function ChatLoadingOverlay({
    label,
    ariaLabel = label,
    className
}: ChatLoadingOverlayProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            aria-busy="true"
            aria-label={ariaLabel}
            className={cn(
                "absolute inset-0 z-20 flex items-center justify-center overflow-hidden bg-background backdrop-blur-3xl",
                className
            )}
            style={{
                backgroundImage: "url(/noise.png)",
                backgroundRepeat: "repeat",
                backgroundSize: "auto"
            }}
        >
            <div className="flex flex-col items-center gap-3 text-center">
                <CircularLoader size="lg" />
                <div className="text-muted-foreground text-sm">{label}</div>
            </div>
        </motion.div>
    )
}
