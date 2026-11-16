import type { SkillAudit, StoreSkill } from "@/components/skills/skill-types"
import { authServer } from "@/lib/auth-server"
import { createFileRoute } from "@tanstack/react-router"

// Search and audit lookups against the skills.sh store. Its versioned API only accepts a
// Vercel OIDC token, which Vercel hands each request, so these calls live here and not in
// Convex. Where there is no token, search falls back to the open endpoint the store's own
// installer uses. Audits are open either way.

const STORE_API = "https://skills.sh/api/v1"
const OPEN_SEARCH = "https://skills.sh/api/search"
const SEARCH_LIMIT = 20
const SEARCH_TTL_MS = 5 * 60_000
const SEARCH_CACHE_SIZE = 200
const searchCache = new Map<string, { skills: StoreSkill[]; fetchedAt: number }>()

const PASSING = new Set(["pass", "passed", "safe", "clean", "ok"])
const FLAGGED = new Set(["fail", "failed", "unsafe", "malicious", "flagged", "blocked"])

const getStoreToken = async (request: Request) => {
    const fromVercel = request.headers.get("x-vercel-oidc-token")
    if (fromVercel) return fromVercel
    if (!import.meta.env.DEV) return process.env.VERCEL_OIDC_TOKEN ?? null
    // Local development: Vercel's helper mints a token with the CLI's login and the linked
    // project, and keeps it in the user's data folder. It writes nothing into this project,
    // which `vercel env pull` would.
    try {
        const { getVercelOidcToken } = await import("@vercel/oidc")
        return await getVercelOidcToken()
    } catch {
        return null
    }
}

const unavailable = () => Response.json({ error: "Store unavailable" }, { status: 503 })

type StoreSearchItem = {
    slug?: unknown
    skillId?: unknown
    source?: unknown
    sourceType?: unknown
    isDuplicate?: unknown
}

// The versioned API, when there is a token for it.
const searchVersioned = async (token: string, query: string) => {
    const response = await fetch(
        `${STORE_API}/skills/search?q=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT * 2}`,
        { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!response.ok) throw new Error(`Store search returned ${response.status}`)
    return ((await response.json()) as { data?: StoreSearchItem[] }).data ?? []
}

// The endpoint the store's installer searches with. It takes no token.
const searchOpen = async (query: string) => {
    const response = await fetch(
        `${OPEN_SEARCH}?q=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT * 2}`
    )
    if (!response.ok) throw new Error(`Store search returned ${response.status}`)
    return ((await response.json()) as { skills?: StoreSearchItem[] }).skills ?? []
}

const searchStore = async (token: string | null, query: string) => {
    const cacheKey = query.toLowerCase()
    const cached = searchCache.get(cacheKey)
    if (cached && Date.now() - cached.fetchedAt < SEARCH_TTL_MS) return cached.skills

    const items = token
        ? await searchVersioned(token, query).catch(() => searchOpen(query))
        : await searchOpen(query)
    const skills: StoreSkill[] = []
    for (const item of items) {
        const name = item.slug ?? item.skillId
        if (typeof name !== "string" || typeof item.source !== "string") continue
        // A duplicate is the same skill listed twice.
        if (item.isDuplicate === true) continue
        // Installs go through GitHub, and only its sources read as owner/repo.
        if (item.sourceType !== undefined && item.sourceType !== "github") continue
        if (!/^[\w.-]+\/[\w.-]+$/.test(item.source)) continue
        skills.push({ repo: item.source, name })
        if (skills.length === SEARCH_LIMIT) break
    }
    // Re-inserted so the oldest entry is always the first one, which goes when it is full.
    searchCache.delete(cacheKey)
    searchCache.set(cacheKey, { skills, fetchedAt: Date.now() })
    if (searchCache.size > SEARCH_CACHE_SIZE) {
        searchCache.delete(searchCache.keys().next().value as string)
    }
    return skills
}

// Null when nobody has checked the skill.
const fetchAudits = async (token: string | null, repo: string, name: string) => {
    const response = await fetch(
        `${STORE_API}/skills/audit/${repo}/${encodeURIComponent(name)}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    )
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Store audit returned ${response.status}`)
    const body = (await response.json()) as {
        audits?: Array<{ provider?: unknown; status?: unknown }>
    }
    const audits: SkillAudit[] = []
    for (const audit of body.audits ?? []) {
        if (typeof audit.provider !== "string" || typeof audit.status !== "string") continue
        const status = audit.status.toLowerCase()
        // A verdict we don't recognize is left out rather than guessed at.
        if (PASSING.has(status)) audits.push({ provider: audit.provider, status: "pass" })
        else if (FLAGGED.has(status)) audits.push({ provider: audit.provider, status: "flagged" })
    }
    return audits.length > 0 ? audits : null
}

export const Route = createFileRoute("/api/skill-store")({
    server: {
        handlers: {
            GET: async ({ request }) => {
                if (!(await authServer.getToken())) {
                    return Response.json({ error: "Unauthorized" }, { status: 401 })
                }
                const token = await getStoreToken(request)
                const url = new URL(request.url)
                const query = url.searchParams.get("q")?.trim().slice(0, 100)
                const repo = url.searchParams.get("repo")
                const name = url.searchParams.get("name")
                try {
                    if (query && query.length >= 2) {
                        return Response.json({ skills: await searchStore(token, query) })
                    }
                    if (repo && name && /^[\w.-]+\/[\w.-]+$/.test(repo) && /^[\w.-]+$/.test(name)) {
                        return Response.json({ audits: await fetchAudits(token, repo, name) })
                    }
                } catch (error) {
                    console.warn("[skill-store] Store request failed", error)
                    return unavailable()
                }
                return Response.json({ error: "Bad request" }, { status: 400 })
            }
        }
    }
})

export const ServerRoute = Route
