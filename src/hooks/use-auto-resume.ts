"use client"

import type { Thread } from "@/convex/schema/thread"
import { useChatStore } from "@/lib/chat-store"
import type { Infer } from "convex/values"
import { useEffect, useRef } from "react"

const MAX_RESUME_ATTEMPTS_PER_ACTIVITY_WINDOW = 5
const MIN_RESUME_RETRY_INTERVAL_MS = 750
const STALE_ACTIVE_STREAM_MS = 8_000

export interface AutoResumeProps {
    autoResume: boolean
    thread?: Infer<typeof Thread>
    threadId?: string
    experimental_resume: () => Promise<void> | void
    status?: "idle" | "streaming" | "submitted" | string
    threadMessages?: readonly unknown[] | { error: unknown }
    clientId?: string
    streamActivityKey?: string
    stopLocalStream?: () => void
}

export function useAutoResume({
    autoResume,
    thread,
    threadId,
    experimental_resume,
    status,
    threadMessages,
    clientId,
    streamActivityKey = "",
    stopLocalStream
}: AutoResumeProps) {
    const pending = useChatStore((s) =>
        threadId && s.pendingStreams[threadId] === true
            ? !clientId ||
              !s.pendingStreamOwnerClientIds[threadId] ||
              s.pendingStreamOwnerClientIds[threadId] === clientId
            : false
    )
    const manuallyStopped = useChatStore((s) =>
        threadId ? s.manuallyStoppedThreads[threadId] : false
    )
    const resumeAttemptRef = useRef<{
        streamId?: string
        attempts: number
        lastAttemptAt: number
        lastActivityKey?: string
        lastActivityAt: number
    }>({
        streamId: undefined,
        attempts: 0,
        lastAttemptAt: 0,
        lastActivityKey: undefined,
        lastActivityAt: 0
    })

    useEffect(() => {
        resumeAttemptRef.current = {
            streamId: undefined,
            attempts: 0,
            lastAttemptAt: 0,
            lastActivityKey: undefined,
            lastActivityAt: 0
        }
    }, [threadId])

    useEffect(() => {
        if (!autoResume) return
        if (!threadId) return
        if (!thread?.isLive || !thread.currentStreamId) return

        if (!threadMessages || "error" in threadMessages) {
            console.log("[AR:waiting_for_messages]", { threadId: threadId.slice(0, 8) })
            return
        }

        if (manuallyStopped) return
        if (pending) return
        const currentStreamId = thread.currentStreamId

        const attempt = resumeAttemptRef.current

        if (attempt.streamId !== currentStreamId) {
            resumeAttemptRef.current = {
                streamId: currentStreamId,
                attempts: 0,
                lastAttemptAt: 0,
                lastActivityKey: streamActivityKey,
                lastActivityAt: Date.now()
            }
        } else if (attempt.lastActivityKey !== streamActivityKey) {
            resumeAttemptRef.current = {
                ...attempt,
                attempts: 0,
                lastAttemptAt: 0,
                lastActivityKey: streamActivityKey,
                lastActivityAt: Date.now()
            }
        }

        const attemptResume = () => {
            const currentAttempt = resumeAttemptRef.current

            if (currentAttempt.streamId !== currentStreamId) return

            const attemptNow = Date.now()
            const isActiveLocally = status === "streaming" || status === "submitted"
            const lastActivityAt = currentAttempt.lastActivityAt || attemptNow
            const isStaleActiveStream =
                isActiveLocally && attemptNow - lastActivityAt >= STALE_ACTIVE_STREAM_MS

            if (isActiveLocally && !isStaleActiveStream) return
            if (currentAttempt.attempts >= MAX_RESUME_ATTEMPTS_PER_ACTIVITY_WINDOW) return
            if (attemptNow - currentAttempt.lastAttemptAt < MIN_RESUME_RETRY_INTERVAL_MS) return

            resumeAttemptRef.current = {
                streamId: currentStreamId,
                attempts: currentAttempt.attempts + 1,
                lastAttemptAt: attemptNow,
                lastActivityKey: streamActivityKey,
                lastActivityAt
            }

            console.log("[AR:resume]", {
                t: threadId,
                current: currentStreamId.slice(0, 5),
                msgsCount: threadMessages.length,
                attempt: resumeAttemptRef.current.attempts,
                reason: isStaleActiveStream
                    ? "stale_local_stream_for_mounted_chat"
                    : "live_stream_for_mounted_chat"
            })

            if (isStaleActiveStream) {
                // Kill the possibly-dead local stream before re-attaching so
                // two streams never feed the same message concurrently.
                stopLocalStream?.()
            }

            void experimental_resume()
        }

        const initialDelay = resumeAttemptRef.current.attempts === 0 ? 150 : 0
        const timeout = window.setTimeout(() => {
            attemptResume()
        }, initialDelay)

        const interval = window.setInterval(() => {
            attemptResume()
        }, 900)

        return () => {
            window.clearTimeout(timeout)
            window.clearInterval(interval)
        }
    }, [
        autoResume,
        thread?.isLive,
        thread?.currentStreamId,
        threadId,
        pending,
        manuallyStopped,
        experimental_resume,
        status,
        threadMessages,
        streamActivityKey,
        stopLocalStream
    ])
}
