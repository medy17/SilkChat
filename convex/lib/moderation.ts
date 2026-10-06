// Pure moderation rules shared by Convex functions, the sign-in gate and settings UI.

export const MODERATION_STRIKE_LIMIT = 3
export const DEFAULT_STRIKE_EXPIRY_DAYS = 90
export const MAX_STRIKE_EXPIRY_DAYS = 365
export const MAX_SUSPENSION_DAYS = 365
export const MODERATION_VIOLATION_MAX_LENGTH = 1000
export const MODERATION_CONTENT_ACTION_MAX_LENGTH = 300
export const MODERATION_NOTE_MAX_LENGTH = 2000
export const MODERATION_APPEAL_MAX_LENGTH = 2000
export const MODERATION_EMAIL_MAX_RETRIES = 3

const DAY_MS = 24 * 60 * 60 * 1000

export type ModerationAction = "warning" | "strike" | "suspension" | "ban"
export type ModerationCaseStatus = "active" | "overturned" | "lifted"
export type ModerationCaseState = "active" | "expired" | "ended" | "overturned" | "lifted"

type PolicySection = { label: string; anchor: string }

const TERMS_SECTIONS = {
    accounts: { label: "§2 Accounts", anchor: "section-2" },
    restrictions: { label: "§5.1 Restrictions", anchor: "section-5-1" },
    prohibitedConduct: { label: "§5.2 Prohibited conduct", anchor: "section-5-2" },
    copyright: { label: "§16 Copyright Policy", anchor: "section-16" }
} satisfies Record<string, PolicySection>

export const MODERATION_CATEGORIES = [
    {
        id: "harassment",
        label: "Harassment, abuse, or hate",
        summary: "Content or conduct that harasses, abuses, threatens, or demeans other people.",
        policy: TERMS_SECTIONS.prohibitedConduct
    },
    {
        id: "minor_safety",
        label: "Sexual content involving minors",
        summary: "Sexual content involving minors.",
        policy: TERMS_SECTIONS.prohibitedConduct
    },
    {
        id: "illegal_content",
        label: "Unlawful or harmful content",
        summary: "Content or activity that is unlawful, fraudulent, obscene, or harmful.",
        policy: TERMS_SECTIONS.prohibitedConduct
    },
    {
        id: "malware",
        label: "Malware or phishing",
        summary:
            "Malware, phishing, or other material designed to damage systems, steal information, or gain unauthorized access.",
        policy: TERMS_SECTIONS.prohibitedConduct
    },
    {
        id: "impersonation",
        label: "Impersonation or deception",
        summary: "Impersonating others or using materially false or misleading identities.",
        policy: TERMS_SECTIONS.prohibitedConduct
    },
    {
        id: "copyright",
        label: "Copyright or IP infringement",
        summary: "Content that infringes the intellectual property rights of others.",
        policy: TERMS_SECTIONS.copyright
    },
    {
        id: "circumvention",
        label: "Circumventing limits or billing",
        summary:
            "Circumventing security, rate limits, quotas, billing controls, or access restrictions.",
        policy: TERMS_SECTIONS.restrictions
    },
    {
        id: "scraping",
        label: "Scraping or bulk extraction",
        summary: "Scraping, bulk extraction, or automated harvesting of the service.",
        policy: TERMS_SECTIONS.restrictions
    },
    {
        id: "ban_evasion",
        label: "Ban evasion",
        summary: "Using another account to get around an existing suspension or ban.",
        policy: TERMS_SECTIONS.restrictions
    },
    {
        id: "account_sharing",
        label: "Account sharing or resale",
        summary: "Sharing or reselling access to an account.",
        policy: TERMS_SECTIONS.accounts
    },
    {
        id: "other",
        label: "Other Terms violation",
        summary: "Activity that violates our Terms of Service.",
        policy: undefined
    }
] as const satisfies readonly {
    id: string
    label: string
    summary: string
    policy: PolicySection | undefined
}[]

export type ModerationCategoryId = (typeof MODERATION_CATEGORIES)[number]["id"]

export const getModerationCategory = (id: string) =>
    MODERATION_CATEGORIES.find((category) => category.id === id)

export const getPolicyReference = (categoryId: string) => {
    const policy = getModerationCategory(categoryId)?.policy
    return policy ? `Terms of Service ${policy.label}` : undefined
}

export const getPolicyAnchor = (categoryId: string) =>
    getModerationCategory(categoryId)?.policy?.anchor

export const isRestrictionAction = (action: ModerationAction) =>
    action === "suspension" || action === "ban"

type CaseTiming = {
    action: ModerationAction
    status: ModerationCaseStatus
    expiresAt?: number
    endsAt?: number
}

export const getCaseState = (moderationCase: CaseTiming, now: number): ModerationCaseState => {
    if (moderationCase.status !== "active") return moderationCase.status
    if (moderationCase.action === "strike" && moderationCase.expiresAt !== undefined) {
        return moderationCase.expiresAt <= now ? "expired" : "active"
    }
    // A ban only has an end date once it has been shortened.
    if (isRestrictionAction(moderationCase.action) && moderationCase.endsAt !== undefined) {
        return moderationCase.endsAt <= now ? "ended" : "active"
    }
    return "active"
}

export const isPermanentBan = (moderationCase: CaseTiming) =>
    moderationCase.action === "ban" && moderationCase.endsAt === undefined

export const countActiveStrikes = (cases: readonly CaseTiming[], now: number) =>
    cases.filter(
        (moderationCase) =>
            moderationCase.action === "strike" && getCaseState(moderationCase, now) === "active"
    ).length

// A permanent ban outranks everything; otherwise the latest end date wins.
export const getActiveRestriction = <Case extends CaseTiming>(
    cases: readonly Case[],
    now: number
): Case | undefined => {
    const active = cases.filter(
        (moderationCase) =>
            isRestrictionAction(moderationCase.action) &&
            getCaseState(moderationCase, now) === "active"
    )
    return (
        active.find(isPermanentBan) ??
        active.sort((left, right) => (right.endsAt ?? 0) - (left.endsAt ?? 0))[0]
    )
}

export type AccountStanding =
    | { status: "good"; activeStrikes: 0; strikeLimit: number }
    | { status: "strikes"; activeStrikes: number; strikeLimit: number }
    | { status: "suspended"; activeStrikes: number; strikeLimit: number; endsAt: number }
    | { status: "banned"; activeStrikes: number; strikeLimit: number }

export const getAccountStanding = (
    cases: readonly CaseTiming[],
    now: number,
    strikeLimit = MODERATION_STRIKE_LIMIT
): AccountStanding => {
    const activeStrikes = countActiveStrikes(cases, now)
    const restriction = getActiveRestriction(cases, now)
    if (restriction && isPermanentBan(restriction)) {
        return { status: "banned", activeStrikes, strikeLimit }
    }
    if (restriction?.endsAt !== undefined) {
        return { status: "suspended", activeStrikes, strikeLimit, endsAt: restriction.endsAt }
    }
    if (activeStrikes > 0) return { status: "strikes", activeStrikes, strikeLimit }
    return { status: "good", activeStrikes: 0, strikeLimit }
}

// Warnings and strikes are appealed in-app. Restricted users can't sign in, so suspensions
// and bans are appealed by email and resolved from the moderation panel.
export const canAppealCase = (
    moderationCase: CaseTiming,
    { hasAppeal, now }: { hasAppeal: boolean; now: number }
) =>
    !hasAppeal &&
    (moderationCase.action === "warning" || moderationCase.action === "strike") &&
    getCaseState(moderationCase, now) === "active"

export const getRemainingStrikesCopy = (strikeNumber: number, strikeLimit: number) => {
    const remaining = Math.max(strikeLimit - strikeNumber, 0)
    if (remaining === 0) return "Your account has reached the strike limit."
    if (remaining === 1) return "One more strike will result in your account being banned."
    return `${remaining} more strikes will result in your account being banned.`
}

// Restricted users can't sign in, so only warnings and strikes get an in-app notice. Cases from
// before acknowledgedAt existed fall under the same rule: they show only while still active.
export const needsAcknowledgement = (
    moderationCase: CaseTiming & { acknowledgedAt?: number },
    now: number
) =>
    (moderationCase.action === "warning" || moderationCase.action === "strike") &&
    moderationCase.acknowledgedAt === undefined &&
    getCaseState(moderationCase, now) === "active"

export const addDays = (from: number, days: number) => from + days * DAY_MS

const CASE_ID_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"

export const generateCaseId = (random: () => number = Math.random) =>
    `SC-${Array.from(
        { length: 8 },
        () => CASE_ID_ALPHABET[Math.floor(random() * CASE_ID_ALPHABET.length)]
    ).join("")}`

export const CASE_ID_PATTERN = /^SC-[2-9A-Z]{8}$/

// Better Auth's admin plugin refuses banned users with the same code.
export const RESTRICTED_ERROR_CODE = "BANNED_USER"

// The sign-in gate can only pass details back through the OAuth error redirect, so it carries a
// small JSON notice. Refused sessions arrive as ?error=BANNED_USER&error_description=<notice>,
// but Better Auth flattens refused sign-ups to ?error=<notice>, so the notice repeats the code.
export type RestrictionNotice = { caseId?: string; endsAt?: number }

export const formatRestrictionNotice = (notice: RestrictionNotice) =>
    JSON.stringify({
        code: RESTRICTED_ERROR_CODE,
        ...(notice.caseId ? { caseId: notice.caseId } : {}),
        ...(notice.endsAt !== undefined ? { endsAt: notice.endsAt } : {})
    })

// Accepts the raw string, or the object TanStack Router's search parser turns it into.
const readNoticeFields = (value: unknown): Record<string, unknown> | null => {
    let parsed = value
    if (typeof value === "string") {
        if (value.length > 200) return null
        try {
            parsed = JSON.parse(value)
        } catch {
            return null
        }
    }
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
}

export const parseRestrictionNotice = (value: unknown): RestrictionNotice => {
    const fields = readNoticeFields(value)
    if (!fields) return {}
    return {
        ...(typeof fields.caseId === "string" && CASE_ID_PATTERN.test(fields.caseId)
            ? { caseId: fields.caseId }
            : {}),
        ...(typeof fields.endsAt === "number" && Number.isFinite(fields.endsAt)
            ? { endsAt: fields.endsAt }
            : {})
    }
}

// Returns the notice when an OAuth error redirect is a moderation refusal, otherwise null.
export const readRestrictionRedirect = (
    error: unknown,
    description: unknown
): RestrictionNotice | null => {
    if (error === RESTRICTED_ERROR_CODE) return parseRestrictionNotice(description)
    return readNoticeFields(error)?.code === RESTRICTED_ERROR_CODE
        ? parseRestrictionNotice(error)
        : null
}

export const formatModerationEmailDate = (timestamp: number) =>
    new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(timestamp)
