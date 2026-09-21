import { v } from "convex/values"
import { ABILITIES } from "@/lib/tool-abilities"
import { APP_SKILL_IDS } from "../chat_http/skills/types"

export const OpeningToolSelection = v.object({
    enabledTools: v.array(v.union(...ABILITIES.map((id) => v.literal(id)))),
    skillIds: v.array(v.union(...APP_SKILL_IDS.map((id) => v.literal(id)))),
    status: v.union(v.literal("pending"), v.literal("complete"), v.literal("failed")),
    mode: v.union(v.literal("magic"), v.literal("manual"))
})
