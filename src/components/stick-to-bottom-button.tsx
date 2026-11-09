import { ChevronDown } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { COMPOSER_EASE } from "./composer/morph"
import { Button } from "./ui/button"

// Shared with the pill it splits from, so the two part and meet on one curve.
export const PILL_SPLIT_TRANSITION = { duration: 0.3, ease: COMPOSER_EASE } as const

// No scale: the pill keeps its own layer (see below), which would leave text drawn at the
// starting scale and blurry once it settles.
const riseHidden = { opacity: 0, x: 0, y: 20 }
// Starts tucked under the companion pill and slides out of its right side.
const splitHidden = { opacity: 0, x: -80, y: 0 }

export const StickToBottomButton = ({
    isVisible,
    scrollToBottom,
    inPillRow = false,
    splitsFromCompanion = false
}: {
    // From the message list's read of the reader's intent (lib/jump-to-bottom-intent).
    isVisible: boolean
    scrollToBottom: () => void
    // In a relative flex row with other floating pills: they make room for each other.
    inPillRow?: boolean
    // A pill beside it is showing, so this one splits off it instead of rising.
    splitsFromCompanion?: boolean
}) => {
    const hidden = splitsFromCompanion ? splitHidden : riseHidden

    return (
        <AnimatePresence mode={inPillRow ? "popLayout" : "sync"}>
            {isVisible && (
                <motion.div
                    layout={inPillRow ? "position" : false}
                    initial={hidden}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    exit={hidden}
                    transition={
                        splitsFromCompanion
                            ? PILL_SPLIT_TRANSITION
                            : { duration: 0.1, ease: "easeOut", layout: PILL_SPLIT_TRANSITION }
                    }
                    // The glass lives on the element that fades: an ancestor below full opacity
                    // switches off a child's backdrop blur, leaving the pill see-through. The
                    // layer stays promoted so the text doesn't change smoothing, and look
                    // heavier or lighter, the moment an animation ends.
                    className="glass-surface flex rounded-full border will-change-transform"
                >
                    {/* 30px inside the 1px border keeps the pill at 32px, as before. */}
                    <Button
                        onClick={() => scrollToBottom()}
                        size="sm"
                        variant="ghost"
                        className="h-7.5 rounded-full text-foreground transition-all duration-200 hover:bg-accent"
                    >
                        <span className="inline-block">Scroll to bottom</span>
                        <ChevronDown className="mt-0.5 h-4 w-4" />
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
