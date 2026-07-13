import { create } from "zustand"

/**
 * Tracks which chat view has finished hydrating its deferred message list.
 *
 * Chat renders its messages through `useDeferredValue`, so the commit that swaps
 * the route target in `_chat.tsx` can land before the (potentially heavy) message
 * render has caught up. Chat publishes its key here once the deferred value matches
 * the live value, and the route-transition overlay waits for it before dismissing.
 */
interface ChatHydrationStore {
    hydratedChatKey: string | null
    setHydratedChatKey: (key: string | null) => void
}

export const useChatHydrationStore = create<ChatHydrationStore>()((set) => ({
    hydratedChatKey: null,
    setHydratedChatKey: (key) =>
        set((state) => (state.hydratedChatKey === key ? state : { hydratedChatKey: key }))
}))
