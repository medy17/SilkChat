export const IMMUTABLE_OG_CACHE_CONTROL = "public, max-age=31536000, immutable"
export const NO_STORE_CACHE_CONTROL = "no-store, max-age=0"

export type SharedOgLookupResult<T> =
    | { status: "ok"; content: T }
    | { status: "not-found" }
    | { status: "unavailable" }

export function withImmutableOgCache(response: Response) {
    response.headers.set("Cache-Control", IMMUTABLE_OG_CACHE_CONTROL)
    return response
}

export function createOgErrorResponse(message: string, status: 400 | 404 | 503) {
    return new Response(message, {
        status,
        headers: {
            "Cache-Control": NO_STORE_CACHE_CONTROL,
            "Content-Type": "text/plain; charset=utf-8"
        }
    })
}

export async function renderSharedOgResponse<T>(options: {
    sharedThreadId: string
    load: (sharedThreadId: string) => Promise<SharedOgLookupResult<T>>
    render: (content: T) => Promise<Response>
}) {
    if (!options.sharedThreadId) {
        return createOgErrorResponse("Missing shared thread ID", 400)
    }

    const result = await options.load(options.sharedThreadId)
    if (result.status === "not-found") {
        return createOgErrorResponse("Shared thread not found", 404)
    }
    if (result.status === "unavailable") {
        return createOgErrorResponse("Shared card temporarily unavailable", 503)
    }

    return withImmutableOgCache(await options.render(result.content))
}
