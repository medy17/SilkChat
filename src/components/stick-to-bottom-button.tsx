import { ChevronDown } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { Button } from "./ui/button"

export const StickToBottomButton = ({
    isVisible,
    scrollToBottom
}: {
    // From the message list's read of the reader's intent (lib/jump-to-bottom-intent).
    isVisible: boolean
    scrollToBottom: () => void
}) => {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                >
                    <Button
                        onClick={() => scrollToBottom()}
                        size="sm"
                        variant="ghost"
                        className="glass-surface rounded-full border text-foreground transition-all duration-200 hover:bg-accent"
                    >
                        <span className="inline-block">Scroll to bottom</span>
                        <ChevronDown className="mt-0.5 h-4 w-4" />
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
