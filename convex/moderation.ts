import { ConvexError, v } from "convex/values"
import { internal } from "./_generated/api"
import type { Doc, Id } from "./_generated/dataModel"
import {
    type MutationCtx,
    type QueryCtx,
    internalMutation,
    internalQuery,
    mutation,
    query
} from "./_generated/server"
import {
    authComponent,
    betterAuthComponent,
    findAuthUserByIdentifier,
    getAppUserId,
    getAuthUserSummary,
    isOperatorAuthUser
} from "./auth"
import { fingerprintAccountIdentity } from "./lib/account_deletion"
import { getFingerprintPepper } from "./lib/account_deletion_restore"
import { getUserIdentity } from "./lib/identity"
import { canImpersonate } from "./lib/impersonation"
import {
    DEFAULT_STRIKE_EXPIRY_DAYS,
    MAX_STRIKE_EXPIRY_DAYS,
    MAX_SUSPENSION_DAYS,
    MODERATION_APPEAL_MAX_LENGTH,
    MODERATION_CONTENT_ACTION_MAX_LENGTH,
    MODERATION_NOTE_MAX_LENGTH,
    MODERATION_STRIKE_LIMIT,
    MODERATION_VIOLATION_MAX_LENGTH,
    type RestrictionNotice,
    addDays,
    canAppealCase,
    countActiveStrikes,
    generateCaseId,
    getAccountStanding,
    getActiveRestriction,
    getCaseState,
    getModerationCategory,
    getPolicyAnchor,
    getPolicyReference,
    isPermanentBan,
    isRestrictionAction,
    needsAcknowledgement
} from "./lib/moderation"
import { ModerationActionValidator } from "./schema/moderation"

type ModerationCase = Doc<"moderationCases">

const DEFAULT_SUPPORT_EMAIL = "support@silkchat.dev"
const PENDING_APPEALS_LIMIT = 50
const CLOSED_SUBSCRIPTION_STATUSES = new Set(["cancelled", "expired"])

const requireOperator = async (ctx: QueryCtx) => {
    const operator = await authComponent.safeGetAuthUser(ctx)
    if (!operator || !canImpersonate(operator._id)) {
        throw new ConvexError("Moderator access required")
    }
    return operator
}

const getAuthUserById = async (ctx: QueryCtx, authUserId: string) =>
    await ctx.runQuery(betterAuthComponent.adapter.findOne, {
        model: "user",
        where: [{ field: "_id", value: authUserId }]
    })

const listCasesForAuthUser = async (ctx: QueryCtx, authUserId: string) =>
    await ctx.db
        .query("moderationCases")
        .withIndex("byAuthUserCreatedAt", (q) => q.eq("authUserId", authUserId))
        .order("desc")
        .collect()

const getAppealsByCase = async (ctx: QueryCtx, cases: ModerationCase[]) => {
    const appeals = await Promise.all(
        cases.map((moderationCase) =>
            ctx.db
                .query("moderationAppeals")
                .withIndex("byCase", (q) => q.eq("caseId", moderationCase._id))
                .first()
        )
    )
    return new Map(cases.map((moderationCase, index) => [moderationCase._id, appeals[index]]))
}

const trimOptional = (value: string | undefined, maxLength: number, label: string) => {
    const trimmed = value?.trim()
    if (!trimmed) return undefined
    if (trimmed.length > maxLength) {
        throw new ConvexError(`${label} must be ${maxLength} characters or fewer`)
    }
    return trimmed
}

const assertWholeDays = (value: number, max: number, label: string) => {
    if (!Number.isInteger(value) || value < 1 || value > max) {
        throw new ConvexError(`${label} must be between 1 and ${max} days`)
    }
}

const createUniqueCaseId = async (ctx: MutationCtx) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const caseId = generateCaseId()
        const existing = await ctx.db
            .query("moderationCases")
            .withIndex("byCaseId", (q) => q.eq("caseId", caseId))
            .first()
        if (!existing) return caseId
    }
    throw new ConvexError("Could not allocate a case ID. Try again.")
}

// Mirrors the active restriction onto the Better Auth user so sign-in is refused, and
// clears it once nothing is left in effect. Returns whether a restriction remains.
const syncAuthRestriction = async (ctx: MutationCtx, authUserId: string) => {
    const restriction = getActiveRestriction(
        await listCasesForAuthUser(ctx, authUserId),
        Date.now()
    )
    await ctx.runMutation(betterAuthComponent.adapter.updateOne, {
        input: {
            model: "user",
            where: [{ field: "_id", value: authUserId }],
            update: restriction
                ? {
                      banned: true,
                      banReason: `Case ${restriction.caseId}`,
                      banExpires: restriction.endsAt ?? null
                  }
                : { banned: false, banReason: null, banExpires: null }
        }
    })
    if (!restriction) return false

    // Signs the user out everywhere. Their Convex JWT stays valid until it expires (15 min).
    let deleted: { count: number }
    do {
        deleted = await ctx.runMutation(betterAuthComponent.adapter.deleteMany, {
            input: { model: "session", where: [{ field: "userId", value: authUserId }] },
            paginationOpts: { numItems: 100, cursor: null }
        })
    } while (deleted.count === 100)
    return true
}

const closeOpenEscalations = async (
    ctx: MutationCtx,
    authUserId: string,
    status: "resolved" | "dismissed",
    operatorId: string
) => {
    const escalations = await ctx.db
        .query("moderationEscalations")
        .withIndex("byAuthUserStatus", (q) => q.eq("authUserId", authUserId).eq("status", "open"))
        .collect()
    const now = Date.now()
    await Promise.all(
        escalations.map((escalation) =>
            ctx.db.patch(escalation._id, { status, resolvedBy: operatorId, resolvedAt: now })
        )
    )
}

const toUserUpdateView = (update: Doc<"moderationCaseUpdates">) => ({
    id: update._id,
    kind: update.kind,
    viaAppeal: update.viaAppeal ?? false,
    newEnd: update.newEnd ?? null,
    note: update.note ?? null,
    createdAt: update.createdAt
})

const toUserCaseView = (
    moderationCase: ModerationCase,
    appeal: Doc<"moderationAppeals"> | null | undefined,
    updates: Doc<"moderationCaseUpdates">[] | undefined,
    now: number
) => ({
    id: moderationCase._id,
    caseId: moderationCase.caseId,
    action: moderationCase.action,
    violation: moderationCase.violation,
    policyReference: moderationCase.policyReference ?? null,
    policyAnchor: getPolicyAnchor(moderationCase.category) ?? null,
    contentAction: moderationCase.contentAction ?? null,
    strikeNumber: moderationCase.strikeNumber ?? null,
    strikeLimit: moderationCase.strikeLimit ?? null,
    expiresAt: moderationCase.expiresAt ?? null,
    endsAt: moderationCase.endsAt ?? null,
    state: getCaseState(moderationCase, now),
    createdAt: moderationCase.createdAt,
    canAppeal: canAppealCase(moderationCase, { hasAppeal: Boolean(appeal), now }),
    appeal: appeal
        ? {
              status: appeal.status,
              message: appeal.message,
              decisionNote: appeal.decisionNote ?? null,
              createdAt: appeal.createdAt,
              reviewedAt: appeal.reviewedAt ?? null
          }
        : null,
    updates: (updates ?? []).map(toUserUpdateView)
})

const getUpdatesByCase = async (ctx: QueryCtx, cases: ModerationCase[]) => {
    const updates = await Promise.all(
        cases.map((moderationCase) =>
            ctx.db
                .query("moderationCaseUpdates")
                .withIndex("byCaseCreatedAt", (q) => q.eq("caseId", moderationCase._id))
                .collect()
        )
    )
    return new Map(cases.map((moderationCase, index) => [moderationCase._id, updates[index]]))
}

const toOperatorCaseView = (
    moderationCase: ModerationCase,
    appeal: Doc<"moderationAppeals"> | null | undefined,
    updates: Doc<"moderationCaseUpdates">[] | undefined,
    now: number
) => ({
    ...toUserCaseView(moderationCase, appeal, updates, now),
    category: moderationCase.category,
    internalNote: moderationCase.internalNote ?? null,
    recipientEmail: moderationCase.recipientEmail,
    emailStatus: moderationCase.emailStatus,
    emailError: moderationCase.emailError ?? null,
    emailSentAt: moderationCase.emailSentAt ?? null,
    subscriptionCancellation: moderationCase.subscriptionCancellation ?? null,
    resolvedAt: moderationCase.resolvedAt ?? null,
    appealId: appeal?._id ?? null,
    updates: (updates ?? []).map((update) => ({
        ...toUserUpdateView(update),
        emailStatus: update.emailStatus,
        emailError: update.emailError ?? null
    }))
})

// --- Operator ---

export const resolveModerationUser = query({
    args: { identifier: v.string() },
    handler: async (ctx, { identifier }) => {
        await requireOperator(ctx)
        const user = await findAuthUserByIdentifier(ctx, identifier)
        if (!user) return null
        if (isOperatorAuthUser(user)) {
            throw new ConvexError("Operator accounts can't be moderated")
        }
        return { authUserId: user._id }
    }
})

export const getUserModeration = query({
    args: { authUserId: v.string() },
    handler: async (ctx, { authUserId }) => {
        await requireOperator(ctx)
        const user = await getAuthUserById(ctx, authUserId)
        if (!user) return null
        const now = Date.now()
        const cases = await listCasesForAuthUser(ctx, authUserId)
        const [appeals, updates] = await Promise.all([
            getAppealsByCase(ctx, cases),
            getUpdatesByCase(ctx, cases)
        ])
        return {
            user: await getAuthUserSummary(ctx, user),
            standing: getAccountStanding(cases, now),
            nextStrikeNumber: countActiveStrikes(cases, now) + 1,
            cases: cases.map((moderationCase) =>
                toOperatorCaseView(
                    moderationCase,
                    appeals.get(moderationCase._id),
                    updates.get(moderationCase._id),
                    now
                )
            )
        }
    }
})

export const listPendingAppeals = query({
    args: {},
    handler: async (ctx) => {
        await requireOperator(ctx)
        const now = Date.now()
        const appeals = await ctx.db
            .query("moderationAppeals")
            .withIndex("byStatusCreatedAt", (q) => q.eq("status", "pending"))
            .order("asc")
            .take(PENDING_APPEALS_LIMIT)
        const rows = await Promise.all(
            appeals.map(async (appeal) => {
                const moderationCase = await ctx.db.get(appeal.caseId)
                if (!moderationCase) return null
                const updates = await getUpdatesByCase(ctx, [moderationCase])
                return {
                    appealId: appeal._id,
                    message: appeal.message,
                    createdAt: appeal.createdAt,
                    authUserId: moderationCase.authUserId,
                    recipientEmail: moderationCase.recipientEmail,
                    recipientName: moderationCase.recipientName ?? null,
                    case: toOperatorCaseView(
                        moderationCase,
                        appeal,
                        updates.get(moderationCase._id),
                        now
                    )
                }
            })
        )
        return rows.filter((row) => row !== null)
    }
})

export const listModerationEscalations = query({
    args: {},
    handler: async (ctx) => {
        await requireOperator(ctx)
        const now = Date.now()
        const escalations = await ctx.db
            .query("moderationEscalations")
            .withIndex("byStatusCreatedAt", (q) => q.eq("status", "open"))
            .order("asc")
            .take(PENDING_APPEALS_LIMIT)
        const rows = await Promise.all(
            escalations.map(async (escalation) => {
                const trigger = await ctx.db.get(escalation.caseId)
                if (!trigger) return null
                const cases = await listCasesForAuthUser(ctx, escalation.authUserId)
                return {
                    escalationId: escalation._id,
                    reason: escalation.reason,
                    createdAt: escalation.createdAt,
                    authUserId: escalation.authUserId,
                    recipientEmail: trigger.recipientEmail,
                    recipientName: trigger.recipientName ?? null,
                    caseId: trigger.caseId,
                    // Live, so a strike that expired since shows the account is back under.
                    standing: getAccountStanding(cases, now)
                }
            })
        )
        return rows.filter((row) => row !== null)
    }
})

export const dismissModerationEscalation = mutation({
    args: { escalationId: v.id("moderationEscalations") },
    handler: async (ctx, { escalationId }) => {
        const operator = await requireOperator(ctx)
        const escalation = await ctx.db.get(escalationId)
        if (!escalation) throw new ConvexError("Not found")
        if (escalation.status !== "open") return
        await ctx.db.patch(escalationId, {
            status: "dismissed",
            resolvedBy: operator._id,
            resolvedAt: Date.now()
        })
    }
})

export const issueModerationAction = mutation({
    args: {
        authUserId: v.string(),
        action: ModerationActionValidator,
        category: v.string(),
        violation: v.string(),
        contentAction: v.optional(v.string()),
        internalNote: v.optional(v.string()),
        // Strikes only. null means the strike never expires.
        strikeExpiryDays: v.optional(v.union(v.number(), v.null())),
        // Suspensions only.
        suspensionDays: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        const operator = await requireOperator(ctx)
        const user = await getAuthUserById(ctx, args.authUserId)
        if (!user) throw new ConvexError("User not found")
        if (isOperatorAuthUser(user)) throw new ConvexError("Operator accounts can't be moderated")
        if (!user.email) throw new ConvexError("This account has no email address to notify")
        if (!getModerationCategory(args.category)) throw new ConvexError("Choose a violation type")

        const violation = trimOptional(
            args.violation,
            MODERATION_VIOLATION_MAX_LENGTH,
            "What we found"
        )
        if (!violation) throw new ConvexError("Describe what you found")
        const contentAction = trimOptional(
            args.contentAction,
            MODERATION_CONTENT_ACTION_MAX_LENGTH,
            "Action on content"
        )
        const internalNote = trimOptional(
            args.internalNote,
            MODERATION_NOTE_MAX_LENGTH,
            "Internal note"
        )

        const now = Date.now()
        const cases = await listCasesForAuthUser(ctx, user._id)
        const activeRestriction = getActiveRestriction(cases, now)
        if (args.action === "suspension" && activeRestriction) {
            throw new ConvexError(
                `This account is already ${activeRestriction.action === "ban" ? "banned" : "suspended"}`
            )
        }
        if (args.action === "ban" && activeRestriction && isPermanentBan(activeRestriction)) {
            throw new ConvexError("This account is already banned")
        }

        let timing: Partial<
            Pick<ModerationCase, "strikeNumber" | "strikeLimit" | "expiresAt" | "endsAt">
        > = {}
        if (args.action === "strike") {
            const expiryDays =
                args.strikeExpiryDays === undefined
                    ? DEFAULT_STRIKE_EXPIRY_DAYS
                    : args.strikeExpiryDays
            if (expiryDays !== null) {
                assertWholeDays(expiryDays, MAX_STRIKE_EXPIRY_DAYS, "Strike expiry")
            }
            timing = {
                strikeNumber: countActiveStrikes(cases, now) + 1,
                strikeLimit: MODERATION_STRIKE_LIMIT,
                ...(expiryDays !== null ? { expiresAt: addDays(now, expiryDays) } : {})
            }
        }
        if (args.action === "suspension") {
            if (args.suspensionDays === undefined) {
                throw new ConvexError("Choose how long the suspension lasts")
            }
            assertWholeDays(args.suspensionDays, MAX_SUSPENSION_DAYS, "Suspension")
            timing = { endsAt: addDays(now, args.suspensionDays) }
        }

        const caseId = await createUniqueCaseId(ctx)
        const id = await ctx.db.insert("moderationCases", {
            caseId,
            userId: getAppUserId(user),
            authUserId: user._id,
            action: args.action,
            category: args.category,
            violation,
            policyReference: getPolicyReference(args.category),
            contentAction,
            internalNote,
            recipientEmail: user.email,
            recipientName: user.name || undefined,
            createdBy: operator._id,
            ...timing,
            status: "active",
            emailStatus: "pending",
            emailAttempts: 0,
            ...(isRestrictionAction(args.action)
                ? { subscriptionCancellation: "pending" as const }
                : {}),
            createdAt: now,
            updatedAt: now
        })

        if (isRestrictionAction(args.action)) {
            await syncAuthRestriction(ctx, user._id)
            await closeOpenEscalations(ctx, user._id, "resolved", operator._id)
        }
        // Reaching the limit doesn't ban automatically. It raises the account for review.
        if (
            timing.strikeNumber !== undefined &&
            timing.strikeNumber >= MODERATION_STRIKE_LIMIT &&
            !(await ctx.db
                .query("moderationEscalations")
                .withIndex("byAuthUserStatus", (q) =>
                    q.eq("authUserId", user._id).eq("status", "open")
                )
                .first())
        ) {
            await ctx.db.insert("moderationEscalations", {
                authUserId: user._id,
                reason: "strike_limit",
                caseId: id,
                status: "open",
                createdAt: now
            })
        }
        if (args.action === "ban") {
            const { emailHash } = await fingerprintAccountIdentity({
                pepper: getFingerprintPepper(),
                email: user.email
            })
            await ctx.db.insert("moderationIdentityBlocks", {
                emailHash,
                caseId: id,
                createdAt: now
            })
        }
        await ctx.scheduler.runAfter(0, internal.moderation_node.deliverModerationCase, {
            caseId: id
        })
        return { caseId }
    }
})

// Returns whether closing this case let the user sign in again.
const closeCase = async (
    ctx: MutationCtx,
    moderationCase: ModerationCase,
    resolution: "overturned" | "lifted",
    operatorId: string
) => {
    const now = Date.now()
    const wasRestricting =
        isRestrictionAction(moderationCase.action) && getCaseState(moderationCase, now) === "active"
    await ctx.db.patch(moderationCase._id, {
        status: resolution,
        resolvedAt: now,
        resolvedBy: operatorId,
        updatedAt: now
    })
    if (
        moderationCase.action === "strike" &&
        countActiveStrikes(await listCasesForAuthUser(ctx, moderationCase.authUserId), now) <
            MODERATION_STRIKE_LIMIT
    ) {
        await closeOpenEscalations(ctx, moderationCase.authUserId, "resolved", operatorId)
    }
    if (!isRestrictionAction(moderationCase.action)) return false
    const blocks = await ctx.db
        .query("moderationIdentityBlocks")
        .withIndex("byCase", (q) => q.eq("caseId", moderationCase._id))
        .collect()
    await Promise.all(blocks.map((block) => ctx.db.delete(block._id)))
    const stillRestricted = await syncAuthRestriction(ctx, moderationCase.authUserId)
    return wasRestricting && !stillRestricted
}

const recordCaseUpdate = async (
    ctx: MutationCtx,
    update: Omit<
        Doc<"moderationCaseUpdates">,
        "_id" | "_creationTime" | "createdAt" | "emailStatus" | "emailAttempts"
    >
) => {
    const updateId = await ctx.db.insert("moderationCaseUpdates", {
        ...update,
        createdAt: Date.now(),
        emailStatus: "pending",
        emailAttempts: 0
    })
    await ctx.scheduler.runAfter(0, internal.moderation_node.deliverModerationUpdate, {
        updateId
    })
}

const noteArg = (note: string | undefined) => trimOptional(note, MODERATION_NOTE_MAX_LENGTH, "Note")

export const resolveModerationCase = mutation({
    args: {
        caseId: v.id("moderationCases"),
        // overturned: the violation is withdrawn. lifted: a suspension or ban ends early.
        resolution: v.union(v.literal("overturned"), v.literal("lifted")),
        note: v.optional(v.string())
    },
    handler: async (ctx, { caseId, resolution, note: rawNote }) => {
        const operator = await requireOperator(ctx)
        const moderationCase = await ctx.db.get(caseId)
        if (!moderationCase) throw new ConvexError("Case not found")
        if (moderationCase.status !== "active") throw new ConvexError("This case is already closed")
        if (resolution === "lifted" && !isRestrictionAction(moderationCase.action)) {
            throw new ConvexError("Only suspensions and bans can be lifted")
        }
        const note = noteArg(rawNote)
        const restoresAccess = await closeCase(ctx, moderationCase, resolution, operator._id)
        const appeal = await ctx.db
            .query("moderationAppeals")
            .withIndex("byCase", (q) => q.eq("caseId", caseId))
            .first()
        const settlesAppeal = appeal?.status === "pending" && resolution === "overturned"
        if (appeal && settlesAppeal) {
            await ctx.db.patch(appeal._id, {
                status: "overturned",
                decisionNote: note,
                reviewedBy: operator._id,
                reviewedAt: Date.now()
            })
        }
        await recordCaseUpdate(ctx, {
            caseId,
            kind: resolution,
            viaAppeal: settlesAppeal,
            note,
            restoresAccess,
            createdBy: operator._id
        })
    }
})

// Moves an active case's expiry or end date. Shortening a permanent ban gives it an end
// date, which also lifts its sign-up block.
export const changeModerationCaseEnd = mutation({
    args: {
        caseId: v.id("moderationCases"),
        // Days from now.
        days: v.number(),
        note: v.optional(v.string())
    },
    handler: async (ctx, { caseId, days, note: rawNote }) => {
        const operator = await requireOperator(ctx)
        const moderationCase = await ctx.db.get(caseId)
        if (!moderationCase) throw new ConvexError("Case not found")
        const now = Date.now()
        if (moderationCase.action === "warning" || getCaseState(moderationCase, now) !== "active") {
            throw new ConvexError("Only active strikes, suspensions, and bans can change length")
        }
        assertWholeDays(
            days,
            moderationCase.action === "strike" ? MAX_STRIKE_EXPIRY_DAYS : MAX_SUSPENSION_DAYS,
            "New length"
        )
        const newEnd = addDays(now, days)
        const currentEnd = moderationCase.expiresAt ?? moderationCase.endsAt
        // No current end means it never expires, so any date is sooner.
        const kind = currentEnd === undefined || newEnd < currentEnd ? "shortened" : "extended"
        if (currentEnd !== undefined && newEnd === currentEnd) {
            throw new ConvexError("Choose a different date")
        }
        await ctx.db.patch(caseId, {
            ...(moderationCase.action === "strike" ? { expiresAt: newEnd } : { endsAt: newEnd }),
            updatedAt: now
        })
        if (isPermanentBan(moderationCase)) {
            const blocks = await ctx.db
                .query("moderationIdentityBlocks")
                .withIndex("byCase", (q) => q.eq("caseId", caseId))
                .collect()
            await Promise.all(blocks.map((block) => ctx.db.delete(block._id)))
        }
        if (isRestrictionAction(moderationCase.action)) {
            await syncAuthRestriction(ctx, moderationCase.authUserId)
        }
        await recordCaseUpdate(ctx, {
            caseId,
            kind,
            newEnd,
            note: noteArg(rawNote),
            createdBy: operator._id
        })
    }
})

export const decideModerationAppeal = mutation({
    args: {
        appealId: v.id("moderationAppeals"),
        decision: v.union(v.literal("upheld"), v.literal("overturned")),
        decisionNote: v.optional(v.string())
    },
    handler: async (ctx, { appealId, decision, decisionNote }) => {
        const operator = await requireOperator(ctx)
        const appeal = await ctx.db.get(appealId)
        if (!appeal) throw new ConvexError("Appeal not found")
        if (appeal.status !== "pending") throw new ConvexError("This appeal was already decided")
        const moderationCase = await ctx.db.get(appeal.caseId)
        if (!moderationCase) throw new ConvexError("Case not found")

        const note = noteArg(decisionNote)
        await ctx.db.patch(appealId, {
            status: decision,
            decisionNote: note,
            reviewedBy: operator._id,
            reviewedAt: Date.now()
        })
        const restoresAccess =
            decision === "overturned" && moderationCase.status === "active"
                ? await closeCase(ctx, moderationCase, "overturned", operator._id)
                : false
        await recordCaseUpdate(ctx, {
            caseId: moderationCase._id,
            kind: decision === "upheld" ? "appeal_denied" : "overturned",
            viaAppeal: true,
            note,
            restoresAccess,
            createdBy: operator._id
        })
    }
})

export const retryModerationUpdateDelivery = mutation({
    args: { updateId: v.id("moderationCaseUpdates") },
    handler: async (ctx, { updateId }) => {
        await requireOperator(ctx)
        const update = await ctx.db.get(updateId)
        if (!update) throw new ConvexError("Update not found")
        if (update.emailStatus !== "failed") {
            throw new ConvexError("Only failed deliveries can be retried")
        }
        await ctx.db.patch(updateId, {
            emailStatus: "pending",
            emailError: undefined,
            emailAttempts: 0
        })
        await ctx.scheduler.runAfter(0, internal.moderation_node.deliverModerationUpdate, {
            updateId
        })
    }
})

export const retryModerationDelivery = mutation({
    args: { caseId: v.id("moderationCases") },
    handler: async (ctx, { caseId }) => {
        await requireOperator(ctx)
        const moderationCase = await ctx.db.get(caseId)
        if (!moderationCase) throw new ConvexError("Case not found")
        if (moderationCase.emailStatus !== "failed") {
            throw new ConvexError("Only failed deliveries can be retried")
        }
        await ctx.db.patch(caseId, {
            emailStatus: "pending",
            emailError: undefined,
            emailAttempts: 0,
            ...(moderationCase.subscriptionCancellation === "failed"
                ? { subscriptionCancellation: "pending" as const }
                : {}),
            updatedAt: Date.now()
        })
        await ctx.scheduler.runAfter(0, internal.moderation_node.deliverModerationCase, { caseId })
    }
})

// --- Signed-in user ---

export const getMySafety = query({
    args: {},
    handler: async (ctx) => {
        const identity = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in identity) return null
        const now = Date.now()
        const cases = await ctx.db
            .query("moderationCases")
            .withIndex("byUserCreatedAt", (q) => q.eq("userId", identity.id))
            .order("desc")
            .collect()
        const [appeals, updates] = await Promise.all([
            getAppealsByCase(ctx, cases),
            getUpdatesByCase(ctx, cases)
        ])
        return {
            standing: getAccountStanding(cases, now),
            supportEmail: process.env.SUPPORT_EMAIL?.trim() || DEFAULT_SUPPORT_EMAIL,
            cases: cases.map((moderationCase) =>
                toUserCaseView(
                    moderationCase,
                    appeals.get(moderationCase._id),
                    updates.get(moderationCase._id),
                    now
                )
            )
        }
    }
})

// Warnings and strikes the user hasn't acknowledged yet, oldest first.
export const getMyModerationNotices = query({
    args: {},
    handler: async (ctx) => {
        const identity = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in identity) return null
        const now = Date.now()
        const cases = await ctx.db
            .query("moderationCases")
            .withIndex("byUserCreatedAt", (q) => q.eq("userId", identity.id))
            .collect()
        const pending = cases.filter((moderationCase) => needsAcknowledgement(moderationCase, now))
        const [appeals, updates] = await Promise.all([
            getAppealsByCase(ctx, pending),
            getUpdatesByCase(ctx, pending)
        ])
        return {
            standing: getAccountStanding(cases, now),
            cases: pending.map((moderationCase) =>
                toUserCaseView(
                    moderationCase,
                    appeals.get(moderationCase._id),
                    updates.get(moderationCase._id),
                    now
                )
            )
        }
    }
})

const isImpersonatedSession = async (ctx: QueryCtx, sessionId: unknown) => {
    if (typeof sessionId !== "string" || !sessionId) return false
    const session = await ctx.runQuery(betterAuthComponent.adapter.findOne, {
        model: "session",
        where: [{ field: "_id", value: sessionId }]
    })
    return Boolean((session as { impersonatedBy?: string | null } | null)?.impersonatedBy)
}

export const submitModerationAppeal = mutation({
    args: { caseId: v.id("moderationCases"), message: v.string() },
    handler: async (ctx, args) => {
        const identity = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in identity) throw new ConvexError("Sign in to appeal")
        // The Safety page disables appeals while impersonating. This is the backstop.
        if (await isImpersonatedSession(ctx, identity.sessionId)) {
            throw new ConvexError("Appeals can't be filed while viewing as this user")
        }
        const moderationCase = await ctx.db.get(args.caseId)
        if (!moderationCase || moderationCase.userId !== identity.id) {
            throw new ConvexError("Case not found")
        }
        const message = trimOptional(args.message, MODERATION_APPEAL_MAX_LENGTH, "Your appeal")
        if (!message) throw new ConvexError("Tell us why you think we got this wrong")
        const existing = await ctx.db
            .query("moderationAppeals")
            .withIndex("byCase", (q) => q.eq("caseId", args.caseId))
            .first()
        if (!canAppealCase(moderationCase, { hasAppeal: Boolean(existing), now: Date.now() })) {
            throw new ConvexError("This case can no longer be appealed")
        }
        await ctx.db.insert("moderationAppeals", {
            caseId: args.caseId,
            userId: identity.id,
            message,
            status: "pending",
            createdAt: Date.now()
        })
    }
})

export const acknowledgeModerationCase = mutation({
    args: { caseId: v.id("moderationCases") },
    handler: async (ctx, args) => {
        const identity = await getUserIdentity(ctx.auth, { allowAnons: false })
        if ("error" in identity) throw new ConvexError("Sign in to continue")
        const moderationCase = await ctx.db.get(args.caseId)
        if (!moderationCase || moderationCase.userId !== identity.id) {
            throw new ConvexError("Case not found")
        }
        // An operator viewing as this user shouldn't use up the user's notice.
        if (await isImpersonatedSession(ctx, identity.sessionId)) return
        if (moderationCase.acknowledgedAt !== undefined) return
        await ctx.db.patch(args.caseId, { acknowledgedAt: Date.now() })
    }
})

// --- Internal ---

export const getBlockedSignupCaseInternal = internalQuery({
    args: { emailHash: v.string() },
    handler: async (ctx, { emailHash }) => {
        const block = await ctx.db
            .query("moderationIdentityBlocks")
            .withIndex("byEmailHash", (q) => q.eq("emailHash", emailHash))
            .first()
        if (!block) return null
        return (await ctx.db.get(block.caseId))?.caseId ?? ""
    }
})

export const getRestrictionNoticeInternal = internalQuery({
    args: { authUserId: v.string() },
    handler: async (ctx, { authUserId }): Promise<RestrictionNotice> => {
        const restriction = getActiveRestriction(
            await listCasesForAuthUser(ctx, authUserId),
            Date.now()
        )
        if (!restriction) return {}
        return {
            caseId: restriction.caseId,
            ...(restriction.endsAt !== undefined ? { endsAt: restriction.endsAt } : {})
        }
    }
})

export const getModerationPreviewContextInternal = internalQuery({
    args: { authUserId: v.string() },
    handler: async (ctx, { authUserId }) => {
        const user = await getAuthUserById(ctx, authUserId)
        if (!user) return null
        return {
            name: user.name || undefined,
            nextStrikeNumber:
                countActiveStrikes(await listCasesForAuthUser(ctx, authUserId), Date.now()) + 1
        }
    }
})

export const getModerationCaseForDeliveryInternal = internalQuery({
    args: { caseId: v.id("moderationCases") },
    handler: async (ctx, { caseId }) => {
        const moderationCase = await ctx.db.get(caseId)
        if (!moderationCase || moderationCase.emailStatus !== "pending") return null
        const subscriptionIds =
            moderationCase.subscriptionCancellation === "pending"
                ? (
                      await ctx.db
                          .query("lemonSqueezySubscriptions")
                          .withIndex("byUser", (q) => q.eq("userId", moderationCase.userId))
                          .collect()
                  )
                      .filter(
                          (subscription) => !CLOSED_SUBSCRIPTION_STATUSES.has(subscription.status)
                      )
                      .map((subscription) => subscription.lemonSqueezySubscriptionId)
                : []
        return { ...moderationCase, subscriptionIds }
    }
})

export const recordModerationDeliveryInternal = internalMutation({
    args: {
        caseId: v.id("moderationCases"),
        attempts: v.number(),
        subscriptionCancellation: v.optional(v.union(v.literal("done"), v.literal("failed"))),
        emailStatus: v.optional(v.union(v.literal("sent"), v.literal("failed"))),
        emailError: v.optional(v.string())
    },
    handler: async (
        ctx,
        { caseId, attempts, subscriptionCancellation, emailStatus, emailError }
    ) => {
        const moderationCase = await ctx.db.get(caseId)
        if (!moderationCase) return
        const now = Date.now()
        await ctx.db.patch(caseId, {
            emailAttempts: attempts,
            ...(subscriptionCancellation ? { subscriptionCancellation } : {}),
            ...(emailStatus ? { emailStatus } : {}),
            ...(emailStatus === "sent" ? { emailSentAt: now, emailError: undefined } : {}),
            ...(emailError ? { emailError: emailError.slice(0, 500) } : {}),
            updatedAt: now
        })
    }
})

export const getModerationExportTargetInternal = internalQuery({
    args: { authUserId: v.string() },
    handler: async (ctx, { authUserId }) => {
        const user = await getAuthUserById(ctx, authUserId)
        if (!user?.email || isOperatorAuthUser(user)) return null
        return { userId: getAppUserId(user), email: user.email }
    }
})

export const getModerationUpdateForDeliveryInternal = internalQuery({
    args: { updateId: v.id("moderationCaseUpdates") },
    handler: async (ctx, { updateId }) => {
        const update = await ctx.db.get(updateId)
        if (!update || update.emailStatus !== "pending") return null
        const moderationCase = await ctx.db.get(update.caseId)
        if (!moderationCase) return null
        return {
            ...update,
            action: moderationCase.action,
            caseId: moderationCase.caseId,
            violation: moderationCase.violation,
            recipientEmail: moderationCase.recipientEmail,
            recipientName: moderationCase.recipientName
        }
    }
})

export const recordModerationUpdateDeliveryInternal = internalMutation({
    args: {
        updateId: v.id("moderationCaseUpdates"),
        attempts: v.number(),
        emailStatus: v.optional(v.union(v.literal("sent"), v.literal("failed"))),
        emailError: v.optional(v.string())
    },
    handler: async (ctx, { updateId, attempts, emailStatus, emailError }) => {
        if (!(await ctx.db.get(updateId))) return
        await ctx.db.patch(updateId, {
            emailAttempts: attempts,
            ...(emailStatus ? { emailStatus } : {}),
            ...(emailStatus === "sent" ? { emailSentAt: Date.now(), emailError: undefined } : {}),
            ...(emailError ? { emailError: emailError.slice(0, 500) } : {})
        })
    }
})
