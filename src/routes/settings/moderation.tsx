import { ModerationAppealsQueue } from "@/components/moderation/moderation-appeals"
import { ModerationPriorityQueue } from "@/components/moderation/moderation-priority"
import { ModerationUserPanel } from "@/components/moderation/moderation-user-panel"
import { SettingsLayout } from "@/components/settings/settings-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useConvex, useQuery } from "convex/react"
import { ConvexError } from "convex/values"
import { Loader2, Search } from "lucide-react"
import { type FormEvent, useState } from "react"

type ModerationSearch = { user?: string }

export const Route = createFileRoute("/settings/moderation")({
    validateSearch: (search: Record<string, unknown>): ModerationSearch =>
        typeof search.user === "string" && search.user.length <= 200 ? { user: search.user } : {},
    component: ModerationSettingsRoute
})

function UserLookup({ onFound }: { onFound: (authUserId: string) => void }) {
    const convex = useConvex()
    const [identifier, setIdentifier] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const lookup = async (event: FormEvent) => {
        event.preventDefault()
        if (!identifier.trim() || loading) return
        setLoading(true)
        setError(null)
        try {
            const found = await convex.query(api.moderation.resolveModerationUser, {
                identifier: identifier.trim()
            })
            if (found) {
                setIdentifier("")
                onFound(found.authUserId)
            } else {
                setError("No user found.")
            }
        } catch (error) {
            setError(
                error instanceof ConvexError && typeof error.data === "string"
                    ? error.data
                    : "Could not look up this user. Please try again."
            )
        } finally {
            setLoading(false)
        }
    }

    return (
        <form onSubmit={lookup} className="space-y-2">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        aria-label="Email address or user ID"
                        placeholder="Email address or user ID"
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={320}
                        className="pl-9"
                        value={identifier}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? "moderation-lookup-error" : undefined}
                        onChange={(event) => {
                            setIdentifier(event.target.value)
                            setError(null)
                        }}
                    />
                </div>
                <Button type="submit" disabled={!identifier.trim() || loading}>
                    {loading && <Loader2 className="size-4 animate-spin" />}
                    Look up
                </Button>
            </div>
            {error && (
                <p id="moderation-lookup-error" className="text-destructive text-sm">
                    {error}
                </p>
            )}
        </form>
    )
}

function ModerationSettingsRoute() {
    const { data: session } = useSession()
    const currentUser = useQuery(api.auth.getCurrentUser, session?.user ? {} : "skip")
    const { user: authUserId } = Route.useSearch()
    const navigate = useNavigate({ from: Route.fullPath })
    const openUser = (user?: string) => navigate({ search: user ? { user } : {} })

    return (
        <SettingsLayout title="Moderation" description="Accounts and appeals.">
            {currentUser === undefined ? null : !currentUser?.canModerate ? (
                <p className="text-muted-foreground text-sm">
                    You don't have access to moderation.
                </p>
            ) : (
                <div className="space-y-8">
                    <ModerationPriorityQueue onOpenUser={openUser} />

                    <section className="space-y-3" aria-labelledby="moderation-appeals-heading">
                        <h3 id="moderation-appeals-heading" className="font-semibold">
                            Pending appeals
                        </h3>
                        <ModerationAppealsQueue onOpenUser={openUser} />
                    </section>

                    <section className="space-y-3" aria-labelledby="moderation-account-heading">
                        <h3 id="moderation-account-heading" className="font-semibold">
                            Account
                        </h3>
                        {authUserId ? (
                            <ModerationUserPanel
                                key={authUserId}
                                authUserId={authUserId}
                                onClose={() => openUser()}
                            />
                        ) : (
                            <UserLookup onFound={openUser} />
                        )}
                    </section>
                </div>
            )}
        </SettingsLayout>
    )
}
