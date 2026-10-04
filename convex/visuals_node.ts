"use node"

import sharp from "sharp"
import { v } from "convex/values"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { internalAction, type ActionCtx } from "./_generated/server"
import { r2 } from "./attachments"
import { searchBraveImageCandidates } from "../src/lib/brave-image-search"
import {
    collectVisualRequests,
    isReferentialVisualSelection,
    visualRequestKey,
    type StoredVisual,
    type VisualSelection
} from "../src/lib/visual-selections"
import { fetchVisualImage } from "./lib/visual_image_fetch_node"
import { compressImageBytesToWebpLimit } from "./lib/image_compression_node"
import { getAccountDeletionBlockerForAction } from "./lib/account_deletion_gate"

const stagedKey = (userId: string, runId: string, index: number) =>
    `tool-outputs/${userId}/image-search/${runId}/${index}.webp`

// Share one check across concurrent uploads in this operation, as late as the
// first write. Final persistence still checks deletion in its own transaction.
const createWriteGuard = (ctx: ActionCtx, userId: string) => {
    let check: Promise<void> | undefined
    return () =>
        (check ??= (async () => {
            if (await getAccountDeletionBlockerForAction(ctx, userId))
                throw new Error("Account deletion in progress")
        })())
}
const publicUrl = (key: string) => {
    const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "")
    if (!base) throw new Error("Public image delivery is not configured")
    return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`
}

type SearchOutput = {
    success: boolean
    query: string
    results: StoredVisual[]
    alteredQuery?: string
    strictWarning?: boolean
    error?: string
}
const runSearch = async (
    ctx: ActionCtx,
    args: {
        userId: string
        messageDocId: Id<"messages">
        requestKey: string
        query: string
        variant: "gallery" | "step" | "inspect"
        limit: number
    }
): Promise<SearchOutput> => {
    const apiKey = process.env.BRAVE_API_KEY?.trim()
    if (!apiKey) throw new Error("Visual search is not configured")
    publicUrl("configuration-check")
    const claim = await ctx.runMutation(internal.visuals.claimSearch, {
        userId: args.userId,
        messageDocId: args.messageDocId,
        requestKey: args.requestKey,
        query: args.query
    })
    if (!claim.claimed)
        return {
            success: claim.run.status === "ready",
            query: args.query,
            results: claim.run.assets,
            ...(claim.run.alteredQuery ? { alteredQuery: claim.run.alteredQuery } : {}),
            strictWarning: claim.run.strictWarning,
            ...(claim.run.status === "pending"
                ? { error: "This search is already running; do not repeat it." }
                : {})
        }
    try {
        const { candidates, alteredQuery, strictWarning } = await searchBraveImageCandidates(
            args.query,
            args.variant,
            apiKey
        )
        const assets: StoredVisual[] = []
        const assertCanStore = createWriteGuard(ctx, args.userId)
        const inspecting = args.variant === "inspect"
        const downloadDeadline = Date.now() + (inspecting ? 60_000 : 20_000)
        const capture = async (
            candidate: (typeof candidates)[number],
            index: number
        ): Promise<StoredVisual | undefined> => {
            try {
                // Quick looks prefer Brave's cached thumbnail. Inspection prefers the
                // publisher image. Either source must pass the same decoding checks.
                const urls = inspecting
                    ? [candidate.thumbnailUrl, candidate.fallbackUrl]
                    : [candidate.fallbackUrl, candidate.thumbnailUrl]
                let captured: Uint8Array | undefined
                for (const url of new Set(urls)) {
                    if (!url || Date.now() >= downloadDeadline) continue
                    try {
                        const bytes = await fetchVisualImage(url, {
                            timeoutMs: Math.min(
                                inspecting ? 12_000 : 5_000,
                                downloadDeadline - Date.now()
                            )
                        })
                        const decoded = await sharp(bytes, {
                            limitInputPixels: 40_000_000
                        }).metadata()
                        if (
                            !decoded.width ||
                            !decoded.height ||
                            Math.min(decoded.width, decoded.height) < 200
                        )
                            continue
                        captured = await compressImageBytesToWebpLimit({
                            bytes,
                            maxBytes: 1024 * 1024,
                            steps: [
                                { quality: 0.85, maxDimension: 1536 },
                                { quality: 0.75, maxDimension: 1280 },
                                { quality: 0.65, maxDimension: 1024 }
                            ],
                            errorLabel: "search image"
                        })
                        break
                    } catch {
                        /* Try the other source within the same deadline. */
                    }
                }
                if (!captured) return undefined
                await assertCanStore()
                // Quick-look choices are final already: store once, directly in the
                // durable prefix. Only model-inspected candidates need staging.
                const storageKey = inspecting
                    ? stagedKey(args.userId, claim.run._id, index + 1)
                    : "image-search/" +
                      args.userId +
                      "/" +
                      claim.run._id +
                      "/" +
                      (index + 1) +
                      ".webp"
                await r2.store(ctx, captured, {
                    key: storageKey,
                    authorId: args.userId,
                    type: "image/webp"
                })
                const dimensions = await sharp(captured).metadata()
                return {
                    id: `img_${claim.run._id}_${index + 1}`,
                    title: candidate.title,
                    searchQuery: args.query,
                    source: candidate.source,
                    sourceUrl: candidate.sourceUrl,
                    originalUrl: candidate.thumbnailUrl,
                    thumbnailUrl: publicUrl(storageKey),
                    storageKey,
                    width: dimensions.width!,
                    height: dimensions.height!,
                    confidence: candidate.confidence,
                    ...(candidate.pageFetched ? { pageFetched: candidate.pageFetched } : {})
                }
            } catch (error) {
                console.warn("[visual-search] Candidate unavailable", {
                    source: candidate.source,
                    error: error instanceof Error ? error.message : "Download failed"
                })
                return undefined
            }
        }
        // Bounded parallel batches retain Brave's ordering and avoid downloading
        // candidates beyond the number of remaining display/inspection slots.
        for (
            let offset = 0;
            offset < candidates.length &&
            assets.length < args.limit &&
            Date.now() < downloadDeadline;
        ) {
            const batch = candidates.slice(offset, offset + Math.min(3, args.limit - assets.length))
            const captured = await Promise.all(
                batch.map((candidate, index) => capture(candidate, offset + index))
            )
            assets.push(...captured.filter((image): image is StoredVisual => image !== undefined))
            offset += batch.length
        }
        await ctx.runMutation(internal.visuals.finishSearch, {
            runId: claim.run._id,
            assets,
            ...(alteredQuery ? { alteredQuery } : {}),
            strictWarning
        })
        return {
            success: true,
            query: args.query,
            results: assets,
            ...(alteredQuery ? { alteredQuery } : {}),
            strictWarning
        }
    } catch (error) {
        await ctx.runMutation(internal.visuals.finishSearch, {
            runId: claim.run._id,
            assets: [],
            failed: true
        })
        throw error
    }
}

export const search = internalAction({
    args: {
        userId: v.string(),
        messageDocId: v.id("messages"),
        toolCallId: v.string(),
        query: v.string()
    },
    handler: async (ctx, args): Promise<SearchOutput> => {
        try {
            return await runSearch(ctx, {
                userId: args.userId,
                messageDocId: args.messageDocId,
                requestKey: `tool:${args.toolCallId}`,
                query: args.query.replace(/\s+/g, " ").trim().slice(0, 400),
                variant: "inspect",
                limit: 6
            })
        } catch (error) {
            return {
                success: false,
                query: args.query,
                results: [],
                error: error instanceof Error ? error.message : "Image search failed"
            }
        }
    }
})

const promote = async (
    ctx: ActionCtx,
    userId: string,
    image: StoredVisual,
    assertCanStore: () => Promise<void>,
    fromHistory: boolean
): Promise<StoredVisual> => {
    // Images already shown in this thread are reused read-only, including ones
    // borrowed from a fork. Only this user's own staged candidates get copied.
    if (
        image.storageKey.startsWith(`image-search/${userId}/`) ||
        (fromHistory && image.storageKey.startsWith("image-search/"))
    )
        return { ...image, thumbnailUrl: publicUrl(image.storageKey) }
    const prefix = `tool-outputs/${userId}/image-search/`
    if (!image.storageKey.startsWith(prefix)) throw new Error("Invalid search asset")
    const metadata = await r2.getMetadata(ctx, image.storageKey)
    if (metadata?.authorId !== userId) throw new Error("Search asset unavailable")
    const key = `image-search/${userId}/${image.storageKey.slice(prefix.length)}`
    const response = await fetch(await r2.getUrl(image.storageKey), {
        signal: AbortSignal.timeout(15_000)
    })
    if (!response.ok) throw new Error("Search asset unavailable")
    await assertCanStore()
    await r2.store(ctx, new Uint8Array(await response.arrayBuffer()), {
        key,
        authorId: userId,
        type: "image/webp"
    })
    return { ...image, storageKey: key, thumbnailUrl: publicUrl(key) }
}

export const resolveMessage = internalAction({
    args: { messageDocId: v.id("messages"), expectedStreamId: v.optional(v.id("streams")) },
    handler: async (ctx, args): Promise<void> => {
        const context = await ctx.runQuery(internal.visuals.getMessage, {
            messageDocId: args.messageDocId
        })
        if (
            !context ||
            context.message.generationStreamId !== args.expectedStreamId ||
            context.message.metadata.visualStatus === "ready"
        )
            return
        const { message, userId } = context
        const requests = message.parts
            .flatMap((part) => (part.type === "text" ? collectVisualRequests(part.text) : []))
            .slice(0, 12)
        const available = new Map<string, StoredVisual>()
        const toolIds = new Set<string>()
        // Only trusted persisted results from this turn or selected history can resolve handles.
        const history = requests.some((request) => request.refs !== undefined)
            ? await ctx.runQuery(internal.messages.getMessagesByThreadId, {
                  threadId: message.threadId
              })
            : []
        for (const previous of history) {
            for (const selection of previous.metadata.visualSelections ?? []) {
                if (!isReferentialVisualSelection(selection)) continue
                for (const image of selection.visuals) available.set(image.id, image)
            }
        }
        for (const part of message.parts) {
            if (part.type !== "tool-invocation" || part.toolInvocation.toolName !== "image_search")
                continue
            const result = part.toolInvocation.result as SearchOutput | undefined
            if (result?.success)
                for (const image of result.results) {
                    available.set(image.id, image)
                    toolIds.add(image.id)
                }
        }
        const selections: VisualSelection[] = []
        const promoted = new Map<string, Promise<StoredVisual>>()
        const assertCanPromote = createWriteGuard(ctx, userId)
        let failed = false
        const resolveRequest = async (request: (typeof requests)[number]) => {
            let images: StoredVisual[] = []
            try {
                if (request.refs !== undefined)
                    images = request.refs.flatMap((id) =>
                        available.has(id) ? [available.get(id)!] : []
                    )
                else {
                    const result = await runSearch(ctx, {
                        userId,
                        messageDocId: message._id,
                        requestKey: `quick:${visualRequestKey(request)}`,
                        query: request.cue,
                        variant: request.variant,
                        limit: request.limit
                    })
                    images = result.results
                    if (!result.success) failed = true
                }
                const durable: StoredVisual[] = []
                for (const image of images) {
                    try {
                        if (!promoted.has(image.id))
                            promoted.set(
                                image.id,
                                promote(
                                    ctx,
                                    userId,
                                    image,
                                    assertCanPromote,
                                    !toolIds.has(image.id)
                                )
                            )
                        durable.push(await promoted.get(image.id)!)
                    } catch {
                        failed = true
                    }
                }
                selections.push({
                    key: visualRequestKey(request),
                    cue: request.cue,
                    visuals: durable
                })
            } catch (error) {
                failed = true
                console.warn("[visual-search] Resolution failed", error)
                selections.push({ key: visualRequestKey(request), cue: request.cue, visuals: [] })
            }
            const selection = selections.find(
                (selection) => selection.key === visualRequestKey(request)
            )!
            await ctx.runMutation(internal.visuals.finishSelection, {
                ...args,
                selections: [selection],
                partial: true
            })
        }
        // A finished card need not wait for a slow search in another card.
        for (let offset = 0; offset < requests.length; offset += 2) {
            await Promise.all(requests.slice(offset, offset + 2).map(resolveRequest))
        }
        const orderedSelections = requests.flatMap((request) =>
            selections.filter((selection) => selection.key === visualRequestKey(request))
        )
        await ctx.runMutation(internal.visuals.finishSelection, {
            ...args,
            selections: orderedSelections,
            failed
        })
    }
})

export const cleanupRun = internalAction({
    args: { runId: v.id("visualSearchRuns") },
    handler: async (ctx, { runId }): Promise<void> => {
        const run = await ctx.runQuery(internal.visuals.getRun, { runId })
        if (!run || run.expiresAt > Date.now()) return
        // Quick looks store directly in the durable prefix. For tool runs, scan
        // fixed slots to include uploads made before an interrupted finishSearch.
        if (!run.requestKey.startsWith("quick:")) {
            for (let i = 1; i <= 8; i++) {
                const key = stagedKey(run.userId, runId, i)
                if (await r2.getMetadata(ctx, key)) await r2.deleteObject(ctx, key)
            }
        }
        await ctx.runMutation(internal.visuals.deleteRun, { runId })
    }
})

export const cleanupExpired = internalAction({
    args: {},
    handler: async (ctx): Promise<void> => {
        const runs = await ctx.runQuery(internal.visuals.expiredRuns, {})
        for (const run of runs)
            await ctx.runAction(internal.visuals_node.cleanupRun, { runId: run._id })
    }
})
