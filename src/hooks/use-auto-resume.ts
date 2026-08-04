"use client"

import type { Thread } from "@/convex/schema/thread"
import { useChatStore } from "@/lib/chat-store"
import type { Infer } from "convex/values"
import { useEffect, useRef } from "react"

const MAX_RESUME_ATTEMPTS_PER_ACTIVITY_WINDOW = 5
const MIN_RESUME_RETRY_INTERVAL_MS = 750
const RESUME_ATTEMPT_WINDOW_MS = 30_000
const STALE_ACTIVE_STREAM_MS = 8_000

type ResumeAttempt = {
    streamId?: string
    attempts: number
    firstAttemptAt: number
    lastAttemptAt: number
    lastActivityKey?: string
    lastActivityAt: number
    resumeInFlight: boolean
    restartRequested: boolean
}

const createResumeAttempt = (): ResumeAttempt => ({
    streamId: undefined,
    attempts: 0,
    firstAttemptAt: 0,
    lastAttemptAt: 0,
    lastActivityKey: undefined,
    lastActivityAt: 0,
    resumeInFlight: false,
    restartRequested: false
})

export interface AutoResumeProps {
    autoResume: boolean
    thread?: Infer<typeof Thread>
    threadId?: string
    experimental_resume: () => Promise<void> | void
    status?: "idle" | "streaming" | "submitted" | string
    threadMessages?: readonly unknown[] | { error: unknown }
    clientId?: string
    streamActivityKey?: string
    localChatId?: string
    restartLocalChat?: () => void
    hasDirectSendStream?: boolean
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
    localChatId,
    restartLocalChat,
    hasDirectSendStream = false
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
    const resumeAttemptRef = useRef<ResumeAttempt>(createResumeAttempt())
    const resumeGenerationKey = `${threadId ?? ""}:${localChatId ?? ""}`
    const resumeGenerationRef = useRef(resumeGenerationKey)

    if (resumeGenerationRef.current !== resumeGenerationKey) {
        resumeGenerationRef.current = resumeGenerationKey
        resumeAttemptRef.current = createResumeAttempt()
    }

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
        // The original POST already owns a direct SSE response. A quiet period is
        // normal while a tool runs, and replaying the resumable copy from byte zero
        // would append the already-rendered text a second time.
        if (hasDirectSendStream) return
        const currentStreamId = thread.currentStreamId

        const attempt = resumeAttemptRef.current

        if (attempt.streamId !== currentStreamId) {
            resumeAttemptRef.current = {
                streamId: currentStreamId,
                attempts: 0,
                firstAttemptAt: 0,
                lastAttemptAt: 0,
                lastActivityKey: streamActivityKey,
                lastActivityAt: Date.now(),
                resumeInFlight: false,
                restartRequested: false
            }
        } else if (attempt.lastActivityKey !== streamActivityKey) {
            resumeAttemptRef.current = {
                ...attempt,
                attempts: 0,
                firstAttemptAt: 0,
                lastAttemptAt: 0,
                lastActivityKey: streamActivityKey,
                lastActivityAt: Date.now()
            }
        }

        const attemptResume = () => {
            if (resumeGenerationRef.current !== resumeGenerationKey) return

            const currentAttempt = resumeAttemptRef.current

            if (currentAttempt.streamId !== currentStreamId) return

            const attemptNow = Date.now()
            const isActiveLocally = status === "streaming" || status === "submitted"
            const lastActivityAt = currentAttempt.lastActivityAt || attemptNow
            const isStaleActiveStream =
                isActiveLocally && attemptNow - lastActivityAt >= STALE_ACTIVE_STREAM_MS

            if (isActiveLocally) {
                if (!isStaleActiveStream || currentAttempt.restartRequested) return

                // A resumed AI SDK stream is not wired to stop()'s AbortSignal.
                // Recreate the local Chat before reconnecting so makeRequest calls
                // can never overlap on the same SDK instance.
                resumeAttemptRef.current = {
                    ...currentAttempt,
                    restartRequested: true
                }
                restartLocalChat?.()
                return
            }

            if (currentAttempt.resumeInFlight) return

            const attemptWindowExpired =
                currentAttempt.firstAttemptAt > 0 &&
                attemptNow - currentAttempt.firstAttemptAt >= RESUME_ATTEMPT_WINDOW_MS
            const attempts = attemptWindowExpired ? 0 : currentAttempt.attempts
            const firstAttemptAt = attemptWindowExpired ? 0 : currentAttempt.firstAttemptAt

            if (attempts >= MAX_RESUME_ATTEMPTS_PER_ACTIVITY_WINDOW) return
            if (attemptNow - currentAttempt.lastAttemptAt < MIN_RESUME_RETRY_INTERVAL_MS) return

            const activeAttempt = {
                streamId: currentStreamId,
                attempts: attempts + 1,
                firstAttemptAt: firstAttemptAt || attemptNow,
                lastAttemptAt: attemptNow,
                lastActivityKey: streamActivityKey,
                lastActivityAt,
                resumeInFlight: true,
                restartRequested: false
            }
            resumeAttemptRef.current = activeAttempt

            console.log("[AR:resume]", {
                t: threadId,
                current: currentStreamId.slice(0, 5),
                msgsCount: threadMessages.length,
                attempt: resumeAttemptRef.current.attempts,
                reason: "live_stream_for_mounted_chat"
            })

            try {
                void Promise.resolve(experimental_resume()).finally(() => {
                    if (resumeAttemptRef.current !== activeAttempt) return
                    resumeAttemptRef.current = {
                        ...activeAttempt,
                        resumeInFlight: false
                    }
                })
            } catch {
                if (resumeAttemptRef.current === activeAttempt) {
                    resumeAttemptRef.current = {
                        ...activeAttempt,
                        resumeInFlight: false
                    }
                }
            }
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
        resumeGenerationKey,
        restartLocalChat,
        hasDirectSendStream
    ])
}
