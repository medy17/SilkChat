import { v } from "convex/values"

export const UserAccess = v.object({
    userId: v.string(),
    isStaff: v.boolean(),
    bypassLimits: v.boolean(),
    updatedAt: v.number()
})
