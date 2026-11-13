// Fake moderation data for the dev dock's Moderation seed. Each scenario owns its accounts,
// so seeding one again restores it after its cases have been acted on.
import type { ModerationAction } from "../moderation"

// A reserved domain: nothing sent here can reach a real mailbox.
export const MODERATION_SEED_DOMAIN = "seed.example"

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

export type SeedCaseUpdate = {
    kind: "overturned" | "lifted" | "shortened"
    // Time before now.
    ago: number
    note?: string
    viaAppeal?: boolean
    restoresAccess?: boolean
    // Shortened only: the new end, in days from now.
    newEndInDays?: number
    emailError?: string
}

export type SeedCase = {
    account: string
    action: ModerationAction
    category: string
    violation: string
    contentAction?: string
    internalNote?: string
    // Time before now.
    ago: number
    strikeNumber?: number
    // Days from creation.
    expiresAfterDays?: number
    endsAfterDays?: number
    status?: "overturned" | "lifted"
    resolvedAgo?: number
    emailError?: string
    subscriptionCancellation?: "done" | "failed"
    // Opens a strike-limit escalation raised by this case.
    escalates?: boolean
    appeal?: {
        message: string
        ago: number
        decision?: { status: "overturned" | "upheld"; note: string; ago: number }
    }
    updates?: SeedCaseUpdate[]
}

export type SeedScenario = {
    id: string
    title: string
    description: string
    // Email local part and display name. An empty name is an account that never set one.
    accounts: { key: string; name: string }[]
    cases: SeedCase[]
}

export const MODERATION_SEED_SCENARIOS = [
    {
        id: "strike_limit",
        title: "Strike limit",
        description: "An account on three active strikes, raised for review.",
        accounts: [{ key: "mara", name: "Mara Lindqvist" }],
        cases: [
            {
                account: "mara",
                action: "strike",
                category: "harassment",
                violation: "A shared thread targeted another person with abusive messages.",
                contentAction: "Removed the shared thread",
                ago: 25 * DAY,
                strikeNumber: 1,
                expiresAfterDays: 90
            },
            {
                account: "mara",
                action: "strike",
                category: "harassment",
                violation:
                    "Generated images demeaning a named individual and shared them publicly.",
                contentAction: "Removed 4 shared images",
                ago: 12 * DAY,
                strikeNumber: 2,
                expiresAfterDays: 90
            },
            {
                account: "mara",
                action: "strike",
                category: "harassment",
                violation: "Continued harassment of the same person after two earlier strikes.",
                ago: 2 * DAY,
                strikeNumber: 3,
                expiresAfterDays: 90,
                escalates: true
            }
        ]
    },
    {
        id: "appeals",
        title: "Pending appeals",
        description: "A strike and a warning, each waiting on an appeal decision.",
        accounts: [
            { key: "tobias", name: "Tobias Reyes" },
            { key: "priya", name: "Priya Nambiar" }
        ],
        cases: [
            {
                account: "tobias",
                action: "strike",
                category: "copyright",
                violation:
                    "Shared images that reproduce a stock library's watermarked photographs.",
                contentAction: "Unlisted the shared gallery",
                ago: 6 * DAY,
                strikeNumber: 1,
                expiresAfterDays: 90,
                appeal: {
                    message:
                        "The images were my own work. The watermark is from a mock-up template I licensed, and I can send the receipt and the original files if that helps.",
                    ago: 5 * DAY
                }
            },
            {
                account: "priya",
                action: "warning",
                category: "impersonation",
                violation: "A public persona presented itself as a real company's support team.",
                ago: 3 * DAY,
                appeal: {
                    message:
                        "That persona is a parody for a writing class. It says so in the description, and nobody was misled.",
                    ago: 2 * DAY
                }
            }
        ]
    },
    {
        id: "failed_deliveries",
        title: "Failed deliveries",
        description: "A ban whose email never went out, and an update email that bounced.",
        accounts: [
            { key: "dmitri", name: "Dmitri Volkov" },
            { key: "kwame", name: "Kwame Boateng" }
        ],
        cases: [
            {
                account: "kwame",
                action: "ban",
                category: "ban_evasion",
                violation: "This account was created to get around an earlier suspension.",
                internalNote: "Same payment method as the suspended account.",
                ago: 20 * DAY,
                // Shortened two days later, to end 42 days from now.
                endsAfterDays: 62,
                subscriptionCancellation: "done",
                updates: [
                    {
                        kind: "shortened",
                        ago: 18 * DAY,
                        note: "Reduced after review. This is the account's first violation.",
                        newEndInDays: 42,
                        emailError: "Mailbox unavailable"
                    }
                ]
            },
            {
                account: "dmitri",
                action: "ban",
                category: "malware",
                violation: "Distributed a credential-stealing script through shared threads.",
                contentAction: "Removed 12 shared threads",
                ago: 1 * DAY,
                emailError: "Subscription cancellation failed: Lemon Squeezy returned 503",
                subscriptionCancellation: "failed"
            }
        ]
    },
    {
        id: "suspension",
        title: "Active suspension",
        description: "An account suspended for another three days.",
        accounts: [{ key: "hana", name: "Hana Okafor" }],
        cases: [
            {
                account: "hana",
                action: "suspension",
                category: "malware",
                violation: "A shared app collected visitors' sign-in details.",
                contentAction: "Took the shared app offline",
                internalNote: "Reported by two users. Recheck the app before the suspension ends.",
                ago: 4 * DAY,
                endsAfterDays: 7,
                subscriptionCancellation: "done"
            }
        ]
    },
    {
        id: "history",
        title: "Closed cases",
        description: "Expired, lifted, and overturned cases, plus two plain warnings.",
        accounts: [
            { key: "luis", name: "Luis Ferreira" },
            { key: "chen", name: "Chen Wei" },
            { key: "sofia", name: "Sofia Marchetti" },
            { key: "quietfox88", name: "" }
        ],
        cases: [
            {
                account: "luis",
                action: "strike",
                category: "scraping",
                violation: "Automated bulk extraction of shared threads over several days.",
                ago: 120 * DAY,
                strikeNumber: 1,
                expiresAfterDays: 90
            },
            {
                account: "chen",
                action: "warning",
                category: "account_sharing",
                violation: "This account was used from several locations at the same time.",
                ago: 60 * DAY
            },
            {
                account: "chen",
                action: "suspension",
                category: "account_sharing",
                violation: "The account kept being shared after our earlier warning.",
                internalNote: "Six concurrent sessions across three countries.",
                ago: 45 * DAY,
                endsAfterDays: 30,
                status: "lifted",
                resolvedAgo: 40 * DAY,
                subscriptionCancellation: "done",
                updates: [
                    {
                        kind: "lifted",
                        ago: 40 * DAY,
                        note: "Thanks for confirming the account is back to one person.",
                        restoresAccess: true
                    }
                ]
            },
            {
                account: "sofia",
                action: "strike",
                category: "circumvention",
                violation: "Requests were crafted to get around the 5-hour usage limit.",
                ago: 30 * DAY,
                strikeNumber: 1,
                expiresAfterDays: 90,
                status: "overturned",
                resolvedAgo: 27 * DAY,
                appeal: {
                    message:
                        "I was testing my own retry script against the API and didn't realise it kept going after the limit.",
                    ago: 29 * DAY,
                    decision: {
                        status: "overturned",
                        note: "The logs match a runaway retry loop, not an attempt to get around the limit.",
                        ago: 27 * DAY
                    }
                },
                updates: [
                    {
                        kind: "overturned",
                        ago: 27 * DAY,
                        note: "The logs match a runaway retry loop, not an attempt to get around the limit.",
                        viaAppeal: true,
                        restoresAccess: false
                    }
                ]
            },
            {
                account: "luis",
                action: "warning",
                category: "account_sharing",
                violation: "Sharing or reselling access to an account.",
                ago: 9 * DAY
            },
            {
                account: "quietfox88",
                action: "warning",
                category: "other",
                violation: "Activity that violates our Terms of Service.",
                ago: 5 * HOUR
            }
        ]
    }
] as const satisfies readonly SeedScenario[]

export type ModerationSeedScenarioId = (typeof MODERATION_SEED_SCENARIOS)[number]["id"]

export const getModerationSeedScenario = (id: string): SeedScenario | undefined =>
    MODERATION_SEED_SCENARIOS.find((scenario) => scenario.id === id)

export const moderationSeedEmail = (accountKey: string) => `${accountKey}@${MODERATION_SEED_DOMAIN}`

export type SeedScenarioFacts = {
    accounts: number
    cases: number
    activeCases: number
    pendingAppeals: number
    failedDeliveries: number
    raisedForReview: number
}

const isActiveWhenSeeded = (spec: SeedCase) => {
    if (spec.status) return false
    const lifetimeDays = spec.action === "strike" ? spec.expiresAfterDays : spec.endsAfterDays
    return lifetimeDays === undefined || spec.ago < lifetimeDays * DAY
}

// What a scenario holds right after seeding. Once the live counts differ, its cases have
// been acted on or have run out, and seeding it again starts it over.
export const getSeedScenarioFacts = (scenario: SeedScenario): SeedScenarioFacts => ({
    accounts: scenario.accounts.length,
    cases: scenario.cases.length,
    activeCases: scenario.cases.filter(isActiveWhenSeeded).length,
    pendingAppeals: scenario.cases.filter((spec) => spec.appeal && !spec.appeal.decision).length,
    failedDeliveries: scenario.cases.filter(
        (spec) => spec.emailError || spec.updates?.some((update) => update.emailError)
    ).length,
    raisedForReview: scenario.cases.filter((spec) => spec.escalates).length
})
