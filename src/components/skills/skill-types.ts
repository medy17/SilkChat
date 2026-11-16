export type SkillSourceInfo =
    | { kind: "github"; repo: string; path: string; commit?: string; fromStore?: boolean }
    | { kind: "upload"; fileName?: string }

/** A skill in the person's library. */
export type LibrarySkill = {
    id: string
    slug: string
    /** On in new chats. A chat can still pick differently before it starts. */
    enabled: boolean
    description: string
    files: { path: string; sizeBytes: number; text: boolean }[]
    /** Ships scripts, so it only works with Code Execution on. */
    runsCode: boolean
    source: SkillSourceInfo
    createdAt: number
}

/** A skill that can be added: one of ours, or a search result. */
export type StoreSkill = {
    repo: string
    /** The skill's folder in the repository, when it is known ahead of the install. */
    path?: string
    name: string
    /** Search results come without one. */
    description?: string
    /** Picked by us, so it can be added without reading it first. */
    curated?: boolean
}

export type SkillAudit = { provider: string; status: "pass" | "flagged" }

/** What a skill says and holds, read before adding it. */
export type StoreSkillDetail = {
    description: string
    instructions: string
    files: string[]
    runsCode: boolean
    /** Null when nobody has checked the skill; undefined when that couldn't be looked up. */
    audits?: SkillAudit[] | null
}

export type SkillCategory = {
    id: string
    title: string
    skills: StoreSkill[]
}

export const getStoreSkillKey = (skill: StoreSkill) =>
    `${skill.repo.toLowerCase()}/${skill.path ?? skill.name}`

/** "docx, pdf and 2 more", or null when there is nothing to name. */
export const summarizeSkillNames = (names: string[], shown = 2) => {
    if (names.length === 0) return null
    if (names.length <= shown) return names.join(", ")
    return `${names.slice(0, shown).join(", ")} and ${names.length - shown} more`
}
