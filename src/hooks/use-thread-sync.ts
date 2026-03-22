import { useChatStore } from "@/lib/chat-store"
import { useEffect, useRef } from "react"

interface UseThreadSyncProps {
    routeThreadId: string | undefined
}

export function useThreadSync({ routeThreadId }: UseThreadSyncProps) {
    const { threadId: storeThreadId, setThreadId, resetChat, triggerRerender } = useChatStore()
    const threadId = routeThreadId ?? storeThreadId
    const previousRouteThreadIdRef = useRef<string | undefined>(undefined)
    const latestStoreThreadIdRef = useRef<string | undefined>(storeThreadId)
    latestStoreThreadIdRef.current = storeThreadId

    useEffect(() => {
        const previousRouteThreadId = previousRouteThreadIdRef.current
        previousRouteThreadIdRef.current = routeThreadId

        if (routeThreadId === undefined) {
            console.log("[thread-sync] resetChat")
            resetChat()
        } else {
            setThreadId(routeThreadId)

            if (
                previousRouteThreadId !== routeThreadId &&
                latestStoreThreadIdRef.current !== routeThreadId
            ) {
                triggerRerender()
            }
        }
    }, [routeThreadId, setThreadId, resetChat, triggerRerender])

    return { threadId, setThreadId }
}
