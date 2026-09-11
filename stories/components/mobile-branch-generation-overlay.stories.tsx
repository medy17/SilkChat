import type { Meta, StoryObj } from "@storybook/react-vite"
import { useEffect } from "react"
import { MobileBranchGenerationOverlay } from "@/components/mobile-branch-generation-overlay"
import { useChatStore } from "@/lib/chat-store"
function Example() {
    useEffect(() => {
        useChatStore.getState().setPendingBranchGeneration("storybook-branch", true)
        return () => useChatStore.getState().setPendingBranchGeneration("storybook-branch", false)
    }, [])
    return (
        <div className="relative min-h-96">
            <p>
                Resize the preview to mobile width to see the pending branch overlay used by the
                chat route.
            </p>
            <MobileBranchGenerationOverlay />
        </div>
    )
}
const meta = { title: "Chat/Mobile branch generation", render: () => <Example /> } satisfies Meta
export default meta
export const Pending: StoryObj<typeof meta> = {}
