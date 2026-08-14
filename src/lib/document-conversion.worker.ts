import init, { toMarkdownBytes, type Format } from "@firecrawl/anydoc-wasm"
import packagedWasmUrl from "@firecrawl/anydoc-wasm/anydoc_wasm_bg.wasm?url"

let initialization: Promise<unknown> | undefined
const wasmUrl = import.meta.env.DEV ? "/vendor/anydoc/anydoc_wasm_bg.wasm" : packagedWasmUrl

const initializeAnydoc = async () => {
    const response = await fetch(wasmUrl)
    if (!response.ok) {
        throw new Error(`Unable to load document converter (${response.status} from ${wasmUrl})`)
    }
    return init({ module_or_path: response })
}

self.onmessage = async (event: MessageEvent<{ bytes: ArrayBuffer; format: Format }>) => {
    try {
        initialization ??= initializeAnydoc()
        await initialization
        const markdown = toMarkdownBytes(new Uint8Array(event.data.bytes), event.data.format)
        self.postMessage({ ok: true, markdown })
    } catch (error) {
        const documentError = error as Error & { code?: string }
        self.postMessage({
            ok: false,
            message: documentError.message || "Document conversion failed",
            code: documentError.code
        })
    }
}
