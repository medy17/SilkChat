import { v } from "convex/values"

export const ComputerKey = v.object({
    userId: v.string(),
    presetId: v.string(),
    label: v.string(),
    host: v.optional(v.string()),
    headerName: v.optional(v.string()),
    valuePrefix: v.optional(v.string()),
    envName: v.optional(v.string()),
    valueEncrypted: v.string(),
    lastFour: v.string(),
    enabled: v.boolean(),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
})
