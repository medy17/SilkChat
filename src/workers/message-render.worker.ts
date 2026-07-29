import type { UIMessage } from "ai"
import { getMessageRenderFingerprint } from "../lib/message-render-fingerprint"

type FingerprintWorkerRequestMessage = {
    message: UIMessage
    version: number
}

type MessageRenderWorkerRequest = {
    messages: FingerprintWorkerRequestMessage[]
}

self.onmessage = (event: MessageEvent<MessageRenderWorkerRequest>) => {
    self.postMessage({
        entries: event.data.messages.map(({ message, version }) => ({
            id: message.id,
            version,
            fingerprint: getMessageRenderFingerprint(message)
        }))
    })
}
