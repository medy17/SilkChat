import { ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc } from "./_generated/dataModel"
import {
    type MutationCtx,
    type QueryCtx,
    internalMutation,
    internalQuery,
    mutation,
    query
} from "./_generated/server"
import { assertAccountNotDeleting } from "./lib/account_deletion_status"
import {
    CUSTOM_COMPUTER_KEY_ID,
    MAX_COMPUTER_KEYS,
    MAX_COMPUTER_KEY_LABEL_LENGTH,
    MAX_COMPUTER_KEY_VALUE_LENGTH,
    findComputerKeyHostConflict,
    getComputerKeyEnvName,
    getComputerKeyHosts,
    getComputerKeyPreset,
    normalizeComputerKeyHost,
    validateCustomComputerKey
} from "./lib/computer_keys"
import { encryptKey } from "./lib/encryption"
import { getUserIdentity } from "./lib/identity"

const getKeys = (ctx: Pick<QueryCtx, "db">, userId: string) =>
    ctx.db
        .query("computerKeys")
        .withIndex("byUserId", (q) => q.eq("userId", userId))
        .collect()

const requireUser = async (ctx: MutationCtx) => {
    const user = await getUserIdentity(ctx.auth, { allowAnons: false })
    if ("error" in user) throw new ConvexError("Unauthorized")
    await assertAccountNotDeleting(ctx, user.id)
    return user
}

const requireOwnKey = async (
    ctx: MutationCtx,
    userId: string,
    keyId: Doc<"computerKeys">["_id"]
) => {
    const key = await ctx.db.get(keyId)
    if (!key || key.userId !== userId) throw new ConvexError("Key not found")
    return key
}

const hostConflictMessage = (host: string) =>
    `Another key that's on already covers ${host}. Turn it off first.`

/**
 * Records the change before trying to apply it, so a failed attempt can't leave an old key active:
 * the computer won't run another command until it has the latest policy.
 */
const applyToComputer = async (ctx: MutationCtx, userId: string) => {
    const computer = await ctx.db
        .query("computers")
        .withIndex("byUserId", (q) => q.eq("userId", userId))
        .first()
    if (!computer) return
    await ctx.db.patch(computer._id, { keysChangedAt: Date.now() })
    await ctx.scheduler.runAfter(0, internal.computers_node.applyComputerNetworkPolicy, { userId })
}

/** Everything the settings page shows. The value itself never leaves the server. */
export const listMyComputerKeys = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return []
        const keys = await getKeys(ctx, user.id)
        return keys.map((key) => ({
            _id: key._id,
            presetId: key.presetId,
            label: key.label,
            hosts: getComputerKeyHosts(key),
            envName: getComputerKeyEnvName(key),
            lastFour: key.lastFour,
            enabled: key.enabled,
            expiresAt: key.expiresAt,
            createdAt: key.createdAt
        }))
    }
})

export const addMyComputerKey = mutation({
    args: {
        presetId: v.string(),
        value: v.string(),
        expiresAt: v.optional(v.number()),
        label: v.optional(v.string()),
        host: v.optional(v.string()),
        headerName: v.optional(v.string()),
        valuePrefix: v.optional(v.string()),
        envName: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const user = await requireUser(ctx)
        const value = args.value.trim()
        if (!value || value.length > MAX_COMPUTER_KEY_VALUE_LENGTH) {
            throw new ConvexError("That doesn't look like a key")
        }

        const preset = getComputerKeyPreset(args.presetId)
        if (!preset && args.presetId !== CUSTOM_COMPUTER_KEY_ID) {
            throw new ConvexError("Unknown service")
        }

        const host = preset ? undefined : normalizeComputerKeyHost(args.host ?? "")
        const headerName = preset ? undefined : args.headerName?.trim() || undefined
        const envName = preset ? undefined : args.envName?.trim() || undefined
        if (!preset) {
            const problem = validateCustomComputerKey({ host: host ?? "", headerName, envName })
            if (problem) throw new ConvexError(problem)
        }

        const label = preset?.label ?? (args.label?.trim() || (host as string))
        if (label.length > MAX_COMPUTER_KEY_LABEL_LENGTH) {
            throw new ConvexError(`Names can be up to ${MAX_COMPUTER_KEY_LABEL_LENGTH} characters`)
        }

        const existing = await getKeys(ctx, user.id)
        if (existing.length >= MAX_COMPUTER_KEYS) {
            throw new ConvexError("Remove a key before adding another")
        }

        const config = {
            presetId: args.presetId,
            host,
            headerName,
            // A custom key defaults to the usual bearer format; an empty prefix means a bare key.
            valuePrefix: preset ? undefined : (args.valuePrefix ?? "Bearer "),
            envName
        }
        const conflict = findComputerKeyHostConflict(
            config,
            existing.filter((key) => key.enabled)
        )
        if (conflict) throw new ConvexError(hostConflictMessage(conflict))

        const now = Date.now()
        await ctx.db.insert("computerKeys", {
            userId: user.id,
            label,
            ...config,
            valueEncrypted: await encryptKey(value),
            lastFour: value.slice(-4),
            enabled: true,
            expiresAt: args.expiresAt,
            createdAt: now,
            updatedAt: now
        })
        await applyToComputer(ctx, user.id)
    }
})

export const setMyComputerKeyEnabled = mutation({
    args: { keyId: v.id("computerKeys"), enabled: v.boolean() },
    handler: async (ctx, { keyId, enabled }) => {
        const user = await requireUser(ctx)
        const key = await requireOwnKey(ctx, user.id, keyId)
        if (enabled) {
            const others = (await getKeys(ctx, user.id)).filter(
                (other) => other.enabled && other._id !== keyId
            )
            const conflict = findComputerKeyHostConflict(key, others)
            if (conflict) throw new ConvexError(hostConflictMessage(conflict))
        }
        await ctx.db.patch(keyId, { enabled, updatedAt: Date.now() })
        await applyToComputer(ctx, user.id)
    }
})

export const replaceMyComputerKey = mutation({
    args: { keyId: v.id("computerKeys"), value: v.string() },
    handler: async (ctx, { keyId, value }) => {
        const user = await requireUser(ctx)
        await requireOwnKey(ctx, user.id, keyId)
        const trimmed = value.trim()
        if (!trimmed || trimmed.length > MAX_COMPUTER_KEY_VALUE_LENGTH) {
            throw new ConvexError("That doesn't look like a key")
        }
        await ctx.db.patch(keyId, {
            valueEncrypted: await encryptKey(trimmed),
            lastFour: trimmed.slice(-4),
            // The old key's expiry says nothing about this one.
            expiresAt: undefined,
            updatedAt: Date.now()
        })
        await applyToComputer(ctx, user.id)
    }
})

export const setMyComputerKeyExpiry = mutation({
    args: { keyId: v.id("computerKeys"), expiresAt: v.optional(v.number()) },
    handler: async (ctx, { keyId, expiresAt }) => {
        const user = await requireUser(ctx)
        await requireOwnKey(ctx, user.id, keyId)
        await ctx.db.patch(keyId, { expiresAt, updatedAt: Date.now() })
    }
})

export const removeMyComputerKey = mutation({
    args: { keyId: v.id("computerKeys") },
    handler: async (ctx, { keyId }) => {
        const user = await requireUser(ctx)
        await requireOwnKey(ctx, user.id, keyId)
        await ctx.db.delete(keyId)
        await applyToComputer(ctx, user.id)
    }
})

export const listEnabledComputerKeys = internalQuery({
    args: { userId: v.string() },
    handler: async (ctx, { userId }): Promise<Doc<"computerKeys">[]> =>
        (await getKeys(ctx, userId)).filter((key) => key.enabled)
})

export const deleteComputerKeysForUser = internalMutation({
    args: { userId: v.string() },
    handler: async (ctx, { userId }) => {
        for (const key of await getKeys(ctx, userId)) await ctx.db.delete(key._id)
    }
})
