const RECONNECT_REQUEST_TIMEOUT_MS = 15_000

type FetchImplementation = typeof globalThis.fetch

export const createChatTransportFetch = (
    fetchImplementation: FetchImplementation = globalThis.fetch,
    reconnectTimeoutMs = RECONNECT_REQUEST_TIMEOUT_MS
): FetchImplementation => {
    return async (input, init) => {
        if (init?.method?.toUpperCase() !== "GET") {
            return fetchImplementation(input, init)
        }

        const controller = new AbortController()
        const parentSignal = init.signal
        const abortFromParent = () => controller.abort(parentSignal?.reason)

        if (parentSignal?.aborted) {
            abortFromParent()
        } else {
            parentSignal?.addEventListener("abort", abortFromParent, { once: true })
        }

        const timeout = globalThis.setTimeout(() => controller.abort(), reconnectTimeoutMs)

        try {
            return await fetchImplementation(input, {
                ...init,
                signal: controller.signal
            })
        } finally {
            globalThis.clearTimeout(timeout)
            parentSignal?.removeEventListener("abort", abortFromParent)
        }
    }
}
