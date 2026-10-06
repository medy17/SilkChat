import { describe, expect, it } from "vitest"
import {
    CASE_ID_PATTERN,
    type ModerationAction,
    type ModerationCaseStatus,
    canAppealCase,
    formatRestrictionNotice,
    generateCaseId,
    getAccountStanding,
    getActiveRestriction,
    needsAcknowledgement,
    parseRestrictionNotice,
    readRestrictionRedirect
} from "../../convex/lib/moderation"

const NOW = 1_800_000_000_000
const DAY = 24 * 60 * 60 * 1000

const moderationCase = (
    action: ModerationAction,
    extra: {
        status?: ModerationCaseStatus
        expiresAt?: number
        endsAt?: number
        caseId?: string
        acknowledgedAt?: number
    } = {}
) => ({ action, status: "active" as ModerationCaseStatus, caseId: "SC-AAAAAAAA", ...extra })

describe("account standing", () => {
    it("counts only strikes that are active, unexpired, and not overturned", () => {
        const standing = getAccountStanding(
            [
                moderationCase("warning"),
                moderationCase("strike", { expiresAt: NOW + DAY }),
                moderationCase("strike"),
                moderationCase("strike", { expiresAt: NOW - 1 }),
                moderationCase("strike", { status: "overturned" })
            ],
            NOW
        )
        expect(standing).toEqual({ status: "strikes", activeStrikes: 2, strikeLimit: 3 })
    })

    it("treats warnings alone as good standing", () => {
        expect(getAccountStanding([moderationCase("warning")], NOW).status).toBe("good")
    })

    it("lets a ban outrank suspensions and ignores ended or lifted restrictions", () => {
        const suspension = moderationCase("suspension", {
            endsAt: NOW + DAY,
            caseId: "SC-SUSPEND1"
        })
        const ban = moderationCase("ban", { caseId: "SC-BANNED11" })
        expect(getActiveRestriction([suspension, ban], NOW)?.caseId).toBe("SC-BANNED11")
        expect(getAccountStanding([suspension], NOW)).toMatchObject({
            status: "suspended",
            endsAt: NOW + DAY
        })
        expect(
            getActiveRestriction(
                [
                    moderationCase("suspension", { endsAt: NOW - 1 }),
                    moderationCase("ban", { status: "lifted" })
                ],
                NOW
            )
        ).toBeUndefined()
    })

    it("treats a shortened ban like a suspension that ends", () => {
        const ban = moderationCase("ban", { endsAt: NOW + DAY })
        expect(getAccountStanding([ban], NOW)).toMatchObject({
            status: "suspended",
            endsAt: NOW + DAY
        })
        expect(getActiveRestriction([{ ...ban, endsAt: NOW - 1 }], NOW)).toBeUndefined()
    })

    it("picks the suspension that ends last when several overlap", () => {
        const restriction = getActiveRestriction(
            [
                moderationCase("suspension", { endsAt: NOW + DAY, caseId: "SC-SHORTER1" }),
                moderationCase("suspension", { endsAt: NOW + 7 * DAY, caseId: "SC-LONGER11" })
            ],
            NOW
        )
        expect(restriction?.caseId).toBe("SC-LONGER11")
    })
})

describe("appeal eligibility", () => {
    it("allows one in-app appeal for active warnings and strikes only", () => {
        expect(canAppealCase(moderationCase("warning"), { hasAppeal: false, now: NOW })).toBe(true)
        expect(canAppealCase(moderationCase("strike"), { hasAppeal: true, now: NOW })).toBe(false)
        expect(
            canAppealCase(moderationCase("strike", { expiresAt: NOW - 1 }), {
                hasAppeal: false,
                now: NOW
            })
        ).toBe(false)
        expect(
            canAppealCase(moderationCase("suspension", { endsAt: NOW + DAY }), {
                hasAppeal: false,
                now: NOW
            })
        ).toBe(false)
    })
})

describe("in-app notice", () => {
    it("shows unacknowledged warnings and strikes only while they're active", () => {
        expect(needsAcknowledgement(moderationCase("warning"), NOW)).toBe(true)
        expect(needsAcknowledgement(moderationCase("strike", { expiresAt: NOW + DAY }), NOW)).toBe(
            true
        )
        expect(
            needsAcknowledgement(moderationCase("warning", { acknowledgedAt: NOW - DAY }), NOW)
        ).toBe(false)
        expect(needsAcknowledgement(moderationCase("strike", { expiresAt: NOW - 1 }), NOW)).toBe(
            false
        )
        expect(needsAcknowledgement(moderationCase("strike", { status: "overturned" }), NOW)).toBe(
            false
        )
        expect(needsAcknowledgement(moderationCase("warning", { status: "lifted" }), NOW)).toBe(
            false
        )
        expect(needsAcknowledgement(moderationCase("suspension", { endsAt: NOW + DAY }), NOW)).toBe(
            false
        )
    })
})

describe("restriction notice", () => {
    it("round-trips the case ID and end date through the OAuth error description", () => {
        const notice = { caseId: generateCaseId(), endsAt: NOW }
        expect(parseRestrictionNotice(formatRestrictionNotice(notice))).toEqual(notice)
    })

    it("drops anything that isn't a well-formed case ID or timestamp", () => {
        expect(parseRestrictionNotice('{"caseId":"<script>","endsAt":"soon"}')).toEqual({})
        expect(parseRestrictionNotice("You have been banned")).toEqual({})
        expect(parseRestrictionNotice(undefined)).toEqual({})
    })

    it("treats other OAuth errors as ordinary failures", () => {
        expect(readRestrictionRedirect("access_denied", undefined)).toBeNull()
        expect(readRestrictionRedirect({ caseId: generateCaseId() }, undefined)).toBeNull()
    })

    it("generates case IDs that match the published format", () => {
        expect(generateCaseId()).toMatch(CASE_ID_PATTERN)
        expect(generateCaseId(() => 0.999999)).toMatch(CASE_ID_PATTERN)
    })
})
