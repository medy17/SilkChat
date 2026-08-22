interface SilkChatBunImage {
    metadata(): Promise<{ width: number; height: number; format: string }>
    resize(width: number): SilkChatBunImage
    avif(options?: { quality?: number }): SilkChatBunImage
    webp(options?: { quality?: number }): SilkChatBunImage
    png(): SilkChatBunImage
    jpeg(options?: { quality?: number }): SilkChatBunImage
    bytes(): Promise<Uint8Array>
}

declare namespace Bun {
    const Image: {
        new (input: string | Uint8Array | Blob): SilkChatBunImage
    }

    function serve(options: {
        hostname: string
        port: number
        fetch(request: Request): Response | Promise<Response>
    }): {
        readonly url: URL
        stop(): void
    }
}
