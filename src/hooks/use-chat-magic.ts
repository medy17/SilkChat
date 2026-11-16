import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useSession } from "@/hooks/auth-hooks"
import { useConvexQuery } from "@convex-dev/react-query"

/**
 * Magic picks a chat's tools once, from its first message. A chat that has started can't
 * change that, so its menus report whether Magic was used instead of offering the switch.
 */
export function useChatMagic(threadId: string | undefined) {
    const session = useSession()
    const thread = useConvexQuery(
        api.threads.getThread,
        session.user?.id && threadId ? { threadId: threadId as Id<"threads"> } : "skip"
    )
    return {
        locked: Boolean(threadId),
        // Undefined until the chat has loaded. A chat from before Magic never used it.
        used: thread ? thread.openingToolSelection?.mode === "magic" : undefined
    }
}
