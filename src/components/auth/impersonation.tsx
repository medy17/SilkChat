import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type FormEvent } from "react"
import { ArrowLeft, Loader2, Search } from "lucide-react"
import { useConvex } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ConvexError } from "convex/values"
import { api } from "../../../convex/_generated/api"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { switchImpersonation, useAccountSwitch } from "@/lib/impersonation-client"
import {
    ACCOUNT_STORAGE_OWNER,
    ACCOUNT_SWITCH_EVENT,
    clearAccountSessionStorage,
    switchAccountStorage
} from "@/lib/impersonation-storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"

export function ImpersonationBoundary({ children }: { children: ReactNode }) {
    const switching = useAccountSwitch((state) => state.switching)
    const switchError = useAccountSwitch((state) => state.error)
    const { data, isPending } = authClient.useSession()
    const userId = data?.user.id ?? "signed-out"
    const [storageOwner] = useState(() => {
        try {
            return localStorage.getItem(ACCOUNT_STORAGE_OWNER)
        } catch {
            return null
        }
    })
    // Also cover sign-out, expiry and signing back in after impersonation. Persisted
    // Zustand stores hydrate at import time, so an identity change needs a full reload.
    useLayoutEffect(() => {
        if (isPending || switching) return
        try {
            if (storageOwner && storageOwner !== userId) {
                useAccountSwitch.setState({ switching: true })
                switchAccountStorage(localStorage, storageOwner, userId)
                clearAccountSessionStorage(sessionStorage)
                window.location.replace("/")
            }
        } catch {
            useAccountSwitch.setState({
                switching: true,
                error: "Could not prepare account storage. Free some browser storage, then reload."
            })
        }
    }, [isPending, switching, storageOwner, userId])
    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key !== ACCOUNT_SWITCH_EVENT || !event.newValue) return
            const { state } = JSON.parse(event.newValue)
            useAccountSwitch.setState({ switching: true })
            if (state === "complete" || state === "failed") {
                clearAccountSessionStorage(sessionStorage)
                window.location.replace("/")
            }
        }
        window.addEventListener("storage", onStorage)
        return () => window.removeEventListener("storage", onStorage)
    }, [])
    if (switching || (storageOwner && (isPending || storageOwner !== userId))) {
        return (
            <div
                role="status"
                className="flex min-h-dvh items-center justify-center gap-2 bg-background text-foreground"
            >
                {switchError ? (
                    <div className="space-y-3 px-4 text-center">
                        <p>{switchError}</p>
                        <Button onClick={() => window.location.reload()}>Reload</Button>
                    </div>
                ) : (
                    <>
                        <Loader2 className="size-4 animate-spin" />
                        {switching ? "Switching accounts…" : "Loading account…"}
                    </>
                )}
            </div>
        )
    }
    return children
}

type UserResult = NonNullable<FunctionReturnType<typeof api.auth.lookupImpersonationUser>>

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 24 * 60 * 60 * 1000],
    ["month", 30 * 24 * 60 * 60 * 1000],
    ["day", 24 * 60 * 60 * 1000],
    ["hour", 60 * 60 * 1000],
    ["minute", 60 * 1000]
]

const formatLastActive = (timestamp: number | null) => {
    if (timestamp == null) return "No recorded activity"
    const elapsed = Date.now() - timestamp
    const [unit, size] = RELATIVE_UNITS.find(([, size]) => elapsed >= size) ?? []
    if (!unit || !size) return "Active just now"
    const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
    return `Active ${relative.format(-Math.floor(elapsed / size), unit)}`
}

// Only surface the subscription status when it needs attention.
const formatSubscriptionIssue = (status: string | null) => {
    if (!status || status === "active") return null
    const label = status.replaceAll("_", " ")
    return `${label[0].toUpperCase()}${label.slice(1)}`
}

function UserAvatar({ user }: { user: UserResult }) {
    const [imageStatus, setImageStatus] = useState("loading")
    const initials =
        user.name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join("") || "?"
    return (
        <Avatar className="size-20 rounded-full border border-foreground/10 bg-secondary shadow-inner">
            <AvatarImage
                src={user.image ?? undefined}
                onLoadingStatusChange={setImageStatus}
                alt=""
                className="rounded-full object-cover"
            />
            <AvatarFallback className="rounded-full border-0 bg-secondary text-xl shadow-none">
                {user.image && imageStatus !== "error" ? (
                    <Skeleton className="size-full rounded-full" />
                ) : (
                    initials
                )}
            </AvatarFallback>
        </Avatar>
    )
}

// Mirrors the personalization header: centered avatar over the name. Every line has a
// fixed height shared with its skeleton so the card does not shift when data arrives.
function UserPreview({ user }: { user: UserResult | null }) {
    if (!user) {
        return (
            <div role="status" aria-busy className="flex flex-col items-center gap-4 py-2">
                <span className="sr-only">Loading user</span>
                <Skeleton className="size-20 rounded-full" />
                <div aria-hidden className="flex w-full flex-col items-center gap-1">
                    <div className="flex h-7 items-center">
                        <Skeleton className="h-5 w-40" />
                    </div>
                    <div className="flex h-5 items-center">
                        <Skeleton className="h-4 w-52 max-w-full" />
                    </div>
                    <div className="flex h-4 items-center">
                        <Skeleton className="h-3 w-56 max-w-full" />
                    </div>
                </div>
                <div aria-hidden className="flex h-5 items-center">
                    <Skeleton className="h-4 w-28" />
                </div>
            </div>
        )
    }
    const subscriptionIssue = formatSubscriptionIssue(user.subscriptionStatus)
    return (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
            <UserAvatar user={user} />
            <div className="flex w-full flex-col items-center gap-1">
                <p className="max-w-full truncate font-semibold text-lg leading-7">{user.name}</p>
                <p className="max-w-full truncate text-muted-foreground text-sm leading-5">
                    {user.email}
                </p>
                <p
                    title={user.id}
                    className="max-w-full truncate font-mono text-muted-foreground/80 text-xs leading-4"
                >
                    {user.id}
                </p>
            </div>
            <p className="flex h-5 items-center gap-1.5 text-muted-foreground text-sm">
                {subscriptionIssue && (
                    <>
                        <span className="text-warning">{subscriptionIssue}</span>
                        <span aria-hidden>·</span>
                    </>
                )}
                <span
                    title={
                        user.lastActiveAt != null
                            ? new Date(user.lastActiveAt).toLocaleString()
                            : undefined
                    }
                >
                    {formatLastActive(user.lastActiveAt)}
                </span>
            </p>
        </div>
    )
}

export function ImpersonationPicker({
    open,
    onOpenChange,
    currentUserId
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    currentUserId: string
}) {
    const convex = useConvex()
    const switching = useAccountSwitch((state) => state.switching)
    const [identifier, setIdentifier] = useState("")
    const [user, setUser] = useState<UserResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const requestId = useRef(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const confirmRef = useRef<HTMLButtonElement>(null)
    // The input unmounts while the card is shown, so hand focus to the next action:
    // Enter confirms the found user, and Back returns to the input with its text selected.
    useEffect(() => {
        if (user) confirmRef.current?.focus()
    }, [user])
    useEffect(() => {
        if (!open) {
            setIdentifier("")
            setUser(null)
            setLoading(false)
            setError(null)
        }
        return () => {
            requestId.current += 1
        }
    }, [open])

    const back = () => {
        requestId.current += 1
        setUser(null)
        setLoading(false)
        setError(null)
        requestAnimationFrame(() => inputRef.current?.select())
    }
    const lookup = async (event: FormEvent) => {
        event.preventDefault()
        if (!identifier.trim() || loading) return
        const request = ++requestId.current
        setLoading(true)
        setError(null)
        try {
            const found = await convex.query(api.auth.lookupImpersonationUser, {
                identifier: identifier.trim()
            })
            if (request !== requestId.current) return
            setUser(found)
            if (!found) setError("No user found. Check the email address or user ID.")
        } catch (error) {
            if (request !== requestId.current) return
            setError(
                error instanceof ConvexError && typeof error.data === "string"
                    ? error.data
                    : "Could not load this user. Please try again."
            )
        } finally {
            if (request === requestId.current) setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                onOpenAutoFocus={() => inputRef.current?.focus()}
                className="top-[30%] max-h-[calc(70dvh-1rem)] translate-y-0 overflow-y-auto rounded-lg outline-none"
            >
                <DialogHeader>
                    <DialogTitle>Impersonate user</DialogTitle>
                    <DialogDescription>Log-in as a different user.</DialogDescription>
                </DialogHeader>
                {loading || user ? (
                    <>
                        <UserPreview user={user} />
                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                            <Button variant="outline" onClick={back} disabled={switching}>
                                <ArrowLeft className="size-4" /> Back
                            </Button>
                            <Button
                                ref={confirmRef}
                                disabled={!user || loading || switching}
                                onClick={() => {
                                    if (user)
                                        void switchImpersonation(currentUserId, user.id).catch(
                                            (error) => toast.error(error.message)
                                        )
                                }}
                            >
                                Continue as this user
                            </Button>
                        </div>
                    </>
                ) : (
                    <form onSubmit={lookup} className="space-y-4">
                        <div className="relative">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                ref={inputRef}
                                aria-label="Email address or user ID"
                                placeholder="Enter an email address or user ID"
                                autoComplete="off"
                                spellCheck={false}
                                maxLength={320}
                                className="pl-9"
                                value={identifier}
                                aria-describedby={error ? "impersonation-error" : undefined}
                                aria-invalid={!!error}
                                onChange={(event) => {
                                    setIdentifier(event.target.value)
                                    setError(null)
                                }}
                            />
                        </div>
                        {error && (
                            <p
                                id="impersonation-error"
                                role="alert"
                                className="text-destructive text-sm"
                            >
                                {error}
                            </p>
                        )}
                        <div className="flex justify-end">
                            <Button type="submit" disabled={!identifier.trim()}>
                                Find user
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    )
}
