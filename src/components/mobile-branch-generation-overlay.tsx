import { ChatLoadingOverlay } from "@/components/chat-loading-overlay"
import { useIsMobile } from "@/hooks/use-mobile"
import { useChatStore } from "@/lib/chat-store"
import { AnimatePresence } from "motion/react"
import { useEffect, useState } from "react"

const BRANCH_GENERATION_LABELS = ["Branching chat", "Almost there..."]

export function MobileBranchGenerationOverlay() {
    const isMobile = useIsMobile()
    const hasPendingBranchGeneration = useChatStore((state) =>
        Object.values(state.pendingBranchGenerations).some(Boolean)
    )
    const [labelIndex, setLabelIndex] = useState(0)

    useEffect(() => {
        if (!hasPendingBranchGeneration) {
            setLabelIndex(0)
            return
        }

        const interval = window.setInterval(() => {
            setLabelIndex((currentIndex) => (currentIndex + 1) % BRANCH_GENERATION_LABELS.length)
        }, 2500)

        return () => window.clearInterval(interval)
    }, [hasPendingBranchGeneration])

    return (
        <AnimatePresence>
            {isMobile && hasPendingBranchGeneration ? (
                <ChatLoadingOverlay
                    key="mobile-branch-generation"
                    label={BRANCH_GENERATION_LABELS[labelIndex]}
                    ariaLabel="Branching chat"
                    className="z-30"
                />
            ) : null}
        </AnimatePresence>
    )
}
