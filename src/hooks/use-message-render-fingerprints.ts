import { getMessageRenderFingerprintMap } from "@/lib/message-render-fingerprint"
import type { UIMessage } from "ai"
import { useEffect, useRef, useState } from "react"

type FingerprintWorkerRequestMessage = {
    message: UIMessage
    version: number
}

type FingerprintWorkerResponseEntry = {
    id: string
    version: number
    fingerprint: string
}

type MessageRenderWorkerResponse = {
    entries: FingerprintWorkerResponseEntry[]
}

export function useMessageRenderFingerprints(
    messages: UIMessage[],
    { liveMessageId, editingMessageId }: { liveMessageId?: string; editingMessageId?: string } = {}
) {
    const [fingerprints, setFingerprints] = useState<Record<string, string>>(() =>
        getMessageRenderFingerprintMap(messages)
    )
    const workerRef = useRef<Worker | null>(null)
    const messageRefsRef = useRef(new Map(messages.map((message) => [message.id, message])))
    const messageVersionsRef = useRef(new Map(messages.map((message) => [message.id, 0])))
    const nextMessageVersionRef = useRef(0)

    useEffect(() => {
        if (typeof window === "undefined" || typeof Worker === "undefined") {
            return
        }

        const worker = new Worker(new URL("../workers/message-render.worker.ts", import.meta.url), {
            type: "module"
        })
        const handleMessage = (event: MessageEvent<MessageRenderWorkerResponse>) => {
            setFingerprints((current) => {
                let next = current

                for (const entry of event.data.entries) {
                    if (messageVersionsRef.current.get(entry.id) !== entry.version) {
                        continue
                    }

                    if (next === current) {
                        next = { ...current }
                    }
                    next[entry.id] = entry.fingerprint
                }

                return next
            })
        }

        worker.addEventListener("message", handleMessage)
        workerRef.current = worker

        return () => {
            worker.removeEventListener("message", handleMessage)
            worker.terminate()
            workerRef.current = null
        }
    }, [])

    useEffect(() => {
        const currentIds = new Set(messages.map((message) => message.id))
        const changedMessages: FingerprintWorkerRequestMessage[] = []
        let removedMessage = false

        for (const id of messageRefsRef.current.keys()) {
            if (!currentIds.has(id)) {
                messageRefsRef.current.delete(id)
                messageVersionsRef.current.delete(id)
                removedMessage = true
            }
        }

        for (const message of messages) {
            if (message.id === liveMessageId || message.id === editingMessageId) {
                continue
            }

            if (messageRefsRef.current.get(message.id) === message) {
                continue
            }

            const version = nextMessageVersionRef.current + 1
            nextMessageVersionRef.current = version
            messageRefsRef.current.set(message.id, message)
            messageVersionsRef.current.set(message.id, version)
            changedMessages.push({ message, version })
        }

        if (removedMessage) {
            setFingerprints((current) =>
                Object.fromEntries(Object.entries(current).filter(([id]) => currentIds.has(id)))
            )
        }

        if (changedMessages.length === 0) {
            return
        }

        const worker = workerRef.current
        if (worker) {
            worker.postMessage({ messages: changedMessages })
            return
        }

        setFingerprints((current) => {
            const next = { ...current }
            for (const { message } of changedMessages) {
                next[message.id] = getMessageRenderFingerprintMap([message])[message.id]
            }
            return next
        })
    }, [editingMessageId, liveMessageId, messages])

    return fingerprints
}
