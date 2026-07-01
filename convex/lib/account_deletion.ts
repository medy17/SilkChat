export const normalizeAccountDeletionEmail = (email: string) => {
    const normalized = email.trim().toLowerCase()
    const [localPart, domain] = normalized.split("@")

    if (!localPart || !domain) return normalized

    if (domain === "gmail.com" || domain === "googlemail.com") {
        const baseLocalPart = localPart.split("+")[0]?.replace(/\./g, "") ?? localPart
        return `${baseLocalPart}@gmail.com`
    }

    return normalized
}

const toHex = (bytes: ArrayBuffer) =>
    Array.from(new Uint8Array(bytes))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")

export const hmacSha256Hex = async ({ pepper, value }: { pepper: string; value: string }) => {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(pepper),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    )
    const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(value))

    return toHex(digest)
}

export const fingerprintAccountIdentity = async ({
    pepper,
    email,
    googleSub
}: {
    pepper: string
    email: string
    googleSub?: string
}) => {
    const emailHash = await hmacSha256Hex({
        pepper,
        value: normalizeAccountDeletionEmail(email)
    })
    const googleSubHash = googleSub
        ? await hmacSha256Hex({
              pepper,
              value: googleSub
          })
        : undefined

    return {
        emailHash,
        googleSubHash
    }
}

export type SuppressionMergeInput = {
    _id: string
    googleSubHash?: string
    emailHash: string
    freePeriodKey: string
    freeConsumedBasicUnits: number
    proEntitlementEndsAt?: number
    refundCount: number
    firstDeletedAt: number
    lastDeletedAt: number
}

export const chooseCanonicalSuppression = ({
    matches,
    googleSubHash
}: {
    matches: SuppressionMergeInput[]
    googleSubHash?: string
}) => {
    const googleMatches = googleSubHash
        ? matches.filter((match) => match.googleSubHash === googleSubHash)
        : []
    const candidates = googleMatches.length > 0 ? googleMatches : matches

    return [...candidates].sort((left, right) => {
        if (left.firstDeletedAt !== right.firstDeletedAt) {
            return left.firstDeletedAt - right.firstDeletedAt
        }

        return left._id.localeCompare(right._id)
    })[0]
}

export const mergeSuppressionSnapshots = ({
    matches,
    freePeriodKey
}: {
    matches: SuppressionMergeInput[]
    freePeriodKey: string
}) => {
    if (matches.length === 0) return null

    return matches.reduce(
        (merged, match) => ({
            freeConsumedBasicUnits:
                match.freePeriodKey === freePeriodKey
                    ? Math.max(merged.freeConsumedBasicUnits, match.freeConsumedBasicUnits)
                    : merged.freeConsumedBasicUnits,
            proEntitlementEndsAt: Math.max(
                merged.proEntitlementEndsAt ?? 0,
                match.proEntitlementEndsAt ?? 0
            ),
            refundCount: Math.max(merged.refundCount, match.refundCount),
            firstDeletedAt: Math.min(merged.firstDeletedAt, match.firstDeletedAt),
            lastDeletedAt: Math.max(merged.lastDeletedAt, match.lastDeletedAt),
            freePeriodKey
        }),
        {
            freePeriodKey,
            freeConsumedBasicUnits: Math.max(
                0,
                ...matches
                    .filter((match) => match.freePeriodKey === freePeriodKey)
                    .map((match) => match.freeConsumedBasicUnits)
            ),
            proEntitlementEndsAt: matches[0].proEntitlementEndsAt,
            refundCount: matches[0].refundCount,
            firstDeletedAt: matches[0].firstDeletedAt,
            lastDeletedAt: matches[0].lastDeletedAt
        }
    )
}
