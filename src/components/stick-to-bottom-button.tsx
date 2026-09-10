import { ChevronDown } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import type { MessageScrollDirection } from "./messages"
import { Button } from "./ui/button"

export const StickToBottomButton = ({
    isAtBottom,
    scrollDirection,
    scrollToBottom
}: {
    isAtBottom: boolean
    scrollDirection: MessageScrollDirection
    scrollToBottom: () => void
}) => {
    return (
        <AnimatePresence>
            {!isAtBottom && scrollDirection === "down" && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                >
                    <Button
                        onClick={() => scrollToBottom()}
                        size="sm"
                        variant="glass"
                        className="rounded-[var(--radius-xl)] border transition-colors duration-200 hover:bg-accent"
                    >
                        <span className="inline-block">Scroll to bottom</span>
                        <ChevronDown className="mt-0.5 h-4 w-4" />
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
