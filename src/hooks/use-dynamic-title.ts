import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { useConvexAuth } from "convex/react"
import { useQuery as useConvexQuery } from "convex/react"
import { useEffect, useRef } from "react"

interface UseDynamicTitleProps {
    threadId: string | undefined
    enabled?: boolean
}

export function useDynamicTitle({ threadId, enabled = true }: UseDynamicTitleProps) {
    const auth = useConvexAuth()
    const thread = useConvexQuery(
        api.threads.getThread,
        threadId && !auth.isLoading ? { threadId: threadId as Id<"threads"> } : "skip"
    )
    const previousActiveThreadIdRef = useRef<string | undefined>(undefined)

    useEffect(() => {
        if (!enabled) {
            if (!threadId) {
                document.title = "SilkChat"
            }
            return
        }

        if (!threadId) {
            previousActiveThreadIdRef.current = undefined
            document.title = "SilkChat"
            return
        }

        if (thread && !("error" in thread)) {
            previousActiveThreadIdRef.current = threadId
            document.title = `${thread.title} - SilkChat`
            return
        }

        if (thread && "error" in thread) {
            previousActiveThreadIdRef.current = threadId
            document.title = "SilkChat"
            return
        }

        if (previousActiveThreadIdRef.current && previousActiveThreadIdRef.current !== threadId) {
            return
        }

        document.title = "SilkChat"
    }, [enabled, threadId, thread])
}
