import { ChatError } from "@/lib/errors"
import {
    BUILT_IN_PERSONAS,
    MAX_PERSONA_AVATAR_BYTES,
    MAX_PERSONA_KNOWLEDGE_DOCS,
    MAX_PERSONA_PROMPT_TOKENS,
    MAX_PERSONA_STARTERS,
    MIN_PERSONA_STARTERS,
    getBuiltInPersonaById
} from "@/lib/personas/builtins"
import { type Infer, v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import { internalQuery, mutation, query } from "./_generated/server"
import { r2 } from "./attachments"
import { getUserIdentity } from "./lib/identity"
import { compilePersonaSnapshot } from "./lib/personas"

const PersonaDocInput = v.object({
    key: v.string(),
    fileName: v.string(),
    mimeType: v.union(v.literal("text/markdown"), v.literal("text/plain")),
    sizeBytes: v.number()
})

const PersonaAvatarInput = v.object({
    key: v.string(),
    mimeType: v.union(
        v.literal("image/avif"),
        v.literal("image/webp"),
        v.literal("image/jpeg"),
        v.literal("image/png")
    ),
    sizeBytes: v.number()
})

const trimText = (value: string) => value.trim()
const normalizeConversationStarters = (starters: string[]) => starters.map(trimText).filter(Boolean)

const validatePersonaInput = ({
    name,
    shortName,
    description,
    instructions,
    conversationStarters,
    knowledgeDocs
}: {
    name: string
    shortName: string
    description: string
    instructions: string
    conversationStarters: string[]
    knowledgeDocs: Array<Infer<typeof PersonaDocInput>>
}) => {
    if (!trimText(name)) throw new Error("Persona name is required")
    if (trimText(name).length > 80) throw new Error("Persona name must be 80 characters or less")
    if (!trimText(shortName)) throw new Error("Persona short name is required")
    if (trimText(shortName).length > 10)
        throw new Error("Persona short name must be 10 characters or less")
    if (!trimText(description)) throw new Error("Persona description is required")
    if (trimText(description).length > 240)
        throw new Error("Persona description must be 240 characters or less")
    if (!trimText(instructions)) throw new Error("Persona instructions are required")
    if (instructions.trim().length > 12_000)
        throw new Error("Persona instructions must be 12,000 characters or less")
    const normalizedConversationStarters = normalizeConversationStarters(conversationStarters)
    if (normalizedConversationStarters.length < MIN_PERSONA_STARTERS) {
        throw new Error(`Personas must have at least ${MIN_PERSONA_STARTERS} conversation starters`)
    }
    if (normalizedConversationStarters.length > MAX_PERSONA_STARTERS) {
        throw new Error(`Personas can have at most ${MAX_PERSONA_STARTERS} conversation starters`)
    }
    for (const starter of normalizedConversationStarters) {
        if (starter.length > 160) {
            throw new Error("Conversation starters must be 160 characters or less")
        }
    }
    if (knowledgeDocs.length > MAX_PERSONA_KNOWLEDGE_DOCS) {
        throw new Error(`Personas can have at most ${MAX_PERSONA_KNOWLEDGE_DOCS} knowledge docs`)
    }
}

const fetchTextFromR2 = async (key: string) => {
    const fileUrl = await r2.getUrl(key)
    const response = await fetch(fileUrl)

    if (!response.ok) {
        throw new Error(`Failed to read persona document "${key}"`)
    }

    return await response.text()
}

const ensureOwnedAsset = async (ctx: any, userId: string, key: string, expectedPrefix: string) => {
    const metadata = await r2.getMetadata(ctx, key)

    if (!metadata) {
        throw new Error("Uploaded asset could not be found")
    }

    if (metadata.authorId !== userId) {
        throw new Error("Uploaded asset does not belong to the current user")
    }

    if (!key.startsWith(expectedPrefix)) {
        throw new Error("Uploaded asset has an unexpected storage key")
    }

    return metadata as {
        authorId: string
        size?: number
        type?: string
    }
}

const resolvePersonaAvatar = async (
    ctx: any,
    userId: string,
    avatar: Infer<typeof PersonaAvatarInput> | null | undefined
) => {
    if (!avatar) {
        return {
            avatarKey: undefined,
            avatarMimeType: undefined,
            avatarSizeBytes: undefined
        }
    }

    const metadata = await ensureOwnedAsset(ctx, userId, avatar.key, `persona-avatars/${userId}/`)
    const assetSize = metadata.size ?? avatar.sizeBytes

    if (assetSize > MAX_PERSONA_AVATAR_BYTES) {
        throw new Error("Persona avatar must be 100KB or smaller")
    }

    return {
        avatarKey: avatar.key,
        avatarMimeType: avatar.mimeType,
        avatarSizeBytes: assetSize
    }
}

const resolvePersonaDocs = async (
    ctx: any,
    userId: string,
    docs: Array<Infer<typeof PersonaDocInput>>
) => {
    const resolvedDocs: Array<Infer<typeof PersonaDocInput> & { content: string }> = []

    for (const doc of docs) {
        if (!doc.fileName.toLowerCase().endsWith(".md")) {
            throw new Error("Knowledge base documents must be markdown files")
        }

        await ensureOwnedAsset(ctx, userId, doc.key, `persona-docs/${userId}/`)
        const content = await fetchTextFromR2(doc.key)
        resolvedDocs.push({
            ...doc,
            content
        })
    }

    return resolvedDocs
}

const findAssetReferences = (persona: {
    avatarKey?: string
    knowledgeDocs: Array<{ key: string }>
}) =>
    [persona.avatarKey, ...persona.knowledgeDocs.map((doc) => doc.key)].filter(Boolean) as string[]

const deleteUnreferencedAssets = async (
    ctx: any,
    userId: string,
    candidateKeys: string[],
    excludingPersonaId?: Id<"userPersonas">
) => {
    if (candidateKeys.length === 0) return

    const personas = await ctx.db
        .query("userPersonas")
        .withIndex("byAuthor", (q: any) => q.eq("authorId", userId))
        .collect()

    const referencedKeys = new Set(
        personas
            .filter((persona: any) => persona._id !== excludingPersonaId)
            .flatMap((persona: any) => findAssetReferences(persona))
    )

    await Promise.allSettled(
        candidateKeys
            .filter((key) => !referencedKeys.has(key))
            .map((key) => r2.deleteObject(ctx, key))
    )
}

export const getUserPersonaByIdInternal = internalQuery({
    args: {
        personaId: v.id("userPersonas")
    },
    handler: async (ctx, { personaId }) => {
        return await ctx.db.get(personaId)
    }
})

export const getThreadPersonaSnapshotInternal = internalQuery({
    args: {
        threadId: v.id("threads")
    },
    handler: async (ctx, { threadId }) => {
        return await ctx.db
            .query("threadPersonaSnapshots")
            .withIndex("byThreadId", (q) => q.eq("threadId", threadId))
            .first()
    }
})

export const listBuiltInPersonas = query({
    args: {},
    handler: async () =>
        BUILT_IN_PERSONAS.map((persona) => ({
            id: persona.id,
            name: persona.name,
            shortName: persona.shortName,
            description: persona.description,
            conversationStarters: persona.conversationStarters,
            defaultModelId: persona.defaultModelId,
            avatarKind: "builtin" as const,
            avatarValue: persona.avatarPath,
            docNames: persona.knowledgeDocs.map((doc) => doc.fileName)
        }))
})

export const listUserPersonas = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return []

        return await ctx.db
            .query("userPersonas")
            .withIndex("byAuthorUpdatedAt", (q) => q.eq("authorId", user.id))
            .order("desc")
            .collect()
    }
})

export const listPersonaPickerOptions = query({
    args: {},
    handler: async (ctx) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) {
            return {
                builtIns: BUILT_IN_PERSONAS.map((persona) => ({
                    source: "builtin" as const,
                    id: persona.id,
                    name: persona.name,
                    shortName: persona.shortName,
                    description: persona.description,
                    conversationStarters: persona.conversationStarters,
                    defaultModelId: persona.defaultModelId,
                    avatarKind: "builtin" as const,
                    avatarValue: persona.avatarPath
                })),
                userPersonas: []
            }
        }

        const userPersonas = await ctx.db
            .query("userPersonas")
            .withIndex("byAuthorUpdatedAt", (q) => q.eq("authorId", user.id))
            .order("desc")
            .collect()

        return {
            builtIns: BUILT_IN_PERSONAS.map((persona) => ({
                source: "builtin" as const,
                id: persona.id,
                name: persona.name,
                shortName: persona.shortName,
                description: persona.description,
                conversationStarters: persona.conversationStarters,
                defaultModelId: persona.defaultModelId,
                avatarKind: "builtin" as const,
                avatarValue: persona.avatarPath
            })),
            userPersonas: userPersonas.map((persona) => ({
                source: "user" as const,
                id: persona._id,
                name: persona.name,
                shortName: persona.shortName || persona.name.slice(0, 10),
                description: persona.description,
                conversationStarters: persona.conversationStarters,
                defaultModelId: persona.defaultModelId,
                avatarKind: persona.avatarKey ? ("r2" as const) : undefined,
                avatarValue: persona.avatarKey,
                avatarMimeType: persona.avatarMimeType
            }))
        }
    }
})

export const getUserPersona = query({
    args: {
        personaId: v.id("userPersonas")
    },
    handler: async (ctx, { personaId }) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return null

        const persona = await ctx.db.get(personaId)
        if (!persona || persona.authorId !== user.id) return null

        return persona
    }
})

export const getThreadPersonaSnapshot = query({
    args: {
        threadId: v.id("threads")
    },
    handler: async (ctx, { threadId }) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) return null

        const thread = await ctx.db.get(threadId)
        if (!thread || thread.authorId !== user.id) return null

        return await ctx.db
            .query("threadPersonaSnapshots")
            .withIndex("byThreadId", (q) => q.eq("threadId", threadId))
            .first()
    }
})

export const createUserPersona = mutation({
    args: {
        name: v.string(),
        shortName: v.string(),
        description: v.string(),
        instructions: v.string(),
        conversationStarters: v.array(v.string()),
        defaultModelId: v.string(),
        avatar: v.optional(v.union(PersonaAvatarInput, v.null())),
        knowledgeDocs: v.array(PersonaDocInput)
    },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new ChatError("unauthorized:api")

        validatePersonaInput(args)
        const resolvedAvatar = await resolvePersonaAvatar(ctx, user.id, args.avatar)
        const resolvedDocs = await resolvePersonaDocs(ctx, user.id, args.knowledgeDocs)
        const snapshot = compilePersonaSnapshot({
            source: "user",
            sourceId: "draft",
            name: args.name,
            shortName: args.shortName,
            description: args.description,
            instructions: args.instructions,
            defaultModelId: args.defaultModelId,
            conversationStarters: args.conversationStarters,
            avatarKind: resolvedAvatar.avatarKey ? "r2" : undefined,
            avatarValue: resolvedAvatar.avatarKey,
            avatarMimeType: resolvedAvatar.avatarMimeType,
            knowledgeDocs: resolvedDocs.map((doc) => ({
                fileName: doc.fileName,
                content: doc.content
            }))
        })

        if (snapshot.promptTokenEstimate > MAX_PERSONA_PROMPT_TOKENS) {
            throw new Error(
                `Persona prompt exceeds ${MAX_PERSONA_PROMPT_TOKENS.toLocaleString()} tokens`
            )
        }

        const now = Date.now()
        return await ctx.db.insert("userPersonas", {
            authorId: user.id,
            name: snapshot.name,
            shortName: snapshot.shortName,
            description: snapshot.description,
            instructions: snapshot.instructions,
            conversationStarters: snapshot.conversationStarters,
            defaultModelId: snapshot.defaultModelId,
            avatarKey: resolvedAvatar.avatarKey,
            avatarMimeType: resolvedAvatar.avatarMimeType,
            avatarSizeBytes: resolvedAvatar.avatarSizeBytes,
            knowledgeDocs: resolvedDocs.map((doc, index) => ({
                key: doc.key,
                fileName: doc.fileName,
                mimeType: doc.mimeType,
                sizeBytes: doc.sizeBytes,
                tokenCount: snapshot.knowledgeDocs[index]?.tokenCount ?? 0
            })),
            promptTokenEstimate: snapshot.promptTokenEstimate,
            createdAt: now,
            updatedAt: now
        })
    }
})

export const updateUserPersona = mutation({
    args: {
        personaId: v.id("userPersonas"),
        name: v.string(),
        shortName: v.string(),
        description: v.string(),
        instructions: v.string(),
        conversationStarters: v.array(v.string()),
        defaultModelId: v.string(),
        avatar: v.optional(v.union(PersonaAvatarInput, v.null())),
        knowledgeDocs: v.array(PersonaDocInput)
    },
    handler: async (ctx, args) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new ChatError("unauthorized:api")

        const existingPersona = await ctx.db.get(args.personaId)
        if (!existingPersona || existingPersona.authorId !== user.id) {
            throw new Error("Persona not found")
        }

        validatePersonaInput(args)
        const resolvedAvatar = await resolvePersonaAvatar(ctx, user.id, args.avatar)
        const resolvedDocs = await resolvePersonaDocs(ctx, user.id, args.knowledgeDocs)
        const snapshot = compilePersonaSnapshot({
            source: "user",
            sourceId: args.personaId,
            name: args.name,
            shortName: args.shortName,
            description: args.description,
            instructions: args.instructions,
            defaultModelId: args.defaultModelId,
            conversationStarters: args.conversationStarters,
            avatarKind: resolvedAvatar.avatarKey ? "r2" : undefined,
            avatarValue: resolvedAvatar.avatarKey,
            avatarMimeType: resolvedAvatar.avatarMimeType,
            knowledgeDocs: resolvedDocs.map((doc) => ({
                fileName: doc.fileName,
                content: doc.content
            }))
        })

        if (snapshot.promptTokenEstimate > MAX_PERSONA_PROMPT_TOKENS) {
            throw new Error(
                `Persona prompt exceeds ${MAX_PERSONA_PROMPT_TOKENS.toLocaleString()} tokens`
            )
        }

        await ctx.db.patch(args.personaId, {
            name: snapshot.name,
            shortName: snapshot.shortName,
            description: snapshot.description,
            instructions: snapshot.instructions,
            conversationStarters: snapshot.conversationStarters,
            defaultModelId: snapshot.defaultModelId,
            avatarKey: resolvedAvatar.avatarKey,
            avatarMimeType: resolvedAvatar.avatarMimeType,
            avatarSizeBytes: resolvedAvatar.avatarSizeBytes,
            knowledgeDocs: resolvedDocs.map((doc, index) => ({
                key: doc.key,
                fileName: doc.fileName,
                mimeType: doc.mimeType,
                sizeBytes: doc.sizeBytes,
                tokenCount: snapshot.knowledgeDocs[index]?.tokenCount ?? 0
            })),
            promptTokenEstimate: snapshot.promptTokenEstimate,
            updatedAt: Date.now()
        })

        const previousKeys = new Set(findAssetReferences(existingPersona))
        const currentKeys = new Set([
            ...(resolvedAvatar.avatarKey ? [resolvedAvatar.avatarKey] : []),
            ...resolvedDocs.map((doc) => doc.key)
        ])
        const removedKeys = [...previousKeys].filter((key) => !currentKeys.has(key))

        await deleteUnreferencedAssets(ctx, user.id, removedKeys, args.personaId)
    }
})

export const deleteUserPersona = mutation({
    args: {
        personaId: v.id("userPersonas")
    },
    handler: async (ctx, { personaId }) => {
        const user = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in user) throw new ChatError("unauthorized:api")

        const persona = await ctx.db.get(personaId)
        if (!persona || persona.authorId !== user.id) {
            throw new Error("Persona not found")
        }

        await ctx.db.delete(personaId)
        await deleteUnreferencedAssets(ctx, user.id, findAssetReferences(persona), personaId)
    }
})

export const getBuiltInPersonaDefinition = (id: string) => getBuiltInPersonaById(id)
