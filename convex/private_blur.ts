import type { PrivateBlurFormat } from "@/lib/private-blur-variants"
import { internal } from "./_generated/api"
import { httpAction } from "./_generated/server"

const clampWidth = (value: string | null) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return null
    return Math.max(64, Math.min(1200, Math.round(parsed)))
}

const isPrivateBlurFormat = (value: string | null): value is PrivateBlurFormat =>
    value === "avif" || value === "webp"

export const getPrivateBlur = httpAction(async (ctx, request) => {
    const url = new URL(request.url)
    const key = url.searchParams.get("key")
    const width = clampWidth(url.searchParams.get("w"))
    const format = url.searchParams.get("fmt")

    if (!key || !width || !isPrivateBlurFormat(format)) {
        return Response.json({ error: "Invalid image blur request" }, { status: 400 })
    }

    const privateBlurUrl =
        // biome-ignore lint/complexity/useLiteralKeys: generated internal types do not always surface node modules reliably.
        await ctx.runAction(internal["private_blur_node"].ensurePrivateBlur, {
            key,
            width,
            format
        })

    if (!privateBlurUrl) {
        return new Response(null, { status: 404 })
    }

    return new Response(null, {
        status: 302,
        headers: {
            Location: privateBlurUrl,
            "Cache-Control":
                "public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=604800"
        }
    })
})
