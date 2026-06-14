import { PrototypeCreditsCard } from "@/components/credits/prototype-credits"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
    useListSessions,
    useRevokeOtherSessions,
    useRevokeSession,
    useSession,
    useUpdateUser
} from "@/hooks/auth-hooks"
import { usePrototypeCredits } from "@/hooks/use-prototype-credits"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { queryClient } from "@/providers"
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import {
    Edit,
    Globe,
    Laptop,
    LogOut,
    Monitor,
    Save,
    Smartphone,
    Tablet,
    UserX,
    X
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { UAParser } from "ua-parser-js"

export const Route = createFileRoute("/settings/profile")({
    component: LegacyProfileRedirect
})

function LegacyProfileRedirect() {
    const navigate = useNavigate()

    useEffect(() => {
        navigate({
            to: "/settings/account",
            replace: true
        })
    }, [navigate])

    return null
}

export function AccountSettingsContent() {
    const { data: session, isLoading: sessionLoading } = useSession()
    const { data: sessions = [], isLoading: sessionsLoading } = useListSessions()
    const updateUser = useUpdateUser()
    const revokeSession = useRevokeSession()
    const revokeOtherSessions = useRevokeOtherSessions()
    const router = useRouter()
    const [isEditingName, setIsEditingName] = useState(false)
    const [nameValue, setNameValue] = useState("")
    const shouldShowDevCreditPlanToggle = import.meta.env.DEV && Boolean(session?.user?.id)
    const {
        summary: prototypeCreditSummary,
        isLoading: isCreditsLoading,
        isRefreshing: isRefreshingCredits,
        isUpdatingCreditPlan,
        refreshCredits,
        setCreditPlan
    } = usePrototypeCredits({
        userId: session?.user?.id,
        isAuthLoading: sessionLoading
    })

    // Initialize name value when session data loads
    const displayName = useMemo(() => {
        if (session?.user?.name?.trim()) {
            return session.user.name
        }
        return session?.user?.email?.split("@")[0] || null
    }, [session?.user?.name, session?.user?.email])

    const handleEditName = useCallback(() => {
        setNameValue(displayName || "")
        setIsEditingName(true)
    }, [displayName])

    const handleSaveName = useCallback(async () => {
        if (!nameValue.trim()) {
            toast.error("Name cannot be empty")
            return
        }

        try {
            await updateUser.mutateAsync({ name: nameValue.trim() })
            setIsEditingName(false)
            toast.success("Name updated successfully")
        } catch (error) {
            toast.error("Failed to update name")
            console.error("Error updating name:", error)
        }
    }, [nameValue, updateUser])

    const handleCancelEdit = useCallback(() => {
        setIsEditingName(false)
        setNameValue("")
    }, [])

    const handleRevokeSession = useCallback(
        async (sessionId: string) => {
            try {
                await revokeSession.mutateAsync({ sessionId })
                toast.success("Session revoked successfully")
            } catch (error) {
                toast.error("Failed to revoke session")
                console.error("Error revoking session:", error)
            }
        },
        [revokeSession]
    )

    const handleSignOut = useCallback(async () => {
        try {
            await authClient.signOut()
            await queryClient.resetQueries({ queryKey: ["session"] })
            await queryClient.resetQueries({ queryKey: ["token"] })
            const keys = Object.keys(localStorage)
            for (const key of keys) {
                if (key.includes("_CACHE")) {
                    localStorage.removeItem(key)
                }
            }
            toast.success("Signed out successfully")
            router.navigate({ to: "/" })
        } catch (error) {
            toast.error("Failed to sign out")
            console.error("Error signing out:", error)
        }
    }, [router])

    const handleRevokeOtherSessions = useCallback(async () => {
        try {
            await revokeOtherSessions.mutateAsync({})
            toast.success("All other sessions revoked successfully")
        } catch (error) {
            toast.error("Failed to revoke other sessions")
            console.error("Error revoking other sessions:", error)
        }
    }, [revokeOtherSessions])

    const getDeviceInfo = useCallback((userAgent: string | null | undefined) => {
        if (!userAgent) {
            return { name: "Unknown Device", icon: Globe }
        }

        const parser = new UAParser(userAgent)
        const device = parser.getDevice()
        const browser = parser.getBrowser()
        const os = parser.getOS()

        let icon = Globe
        let deviceType = "Unknown"

        if (device.type === "mobile") {
            icon = Smartphone
            deviceType = "Mobile"
        } else if (device.type === "tablet") {
            icon = Tablet
            deviceType = "Tablet"
        } else if (
            os.name?.toLowerCase().includes("mac") ||
            os.name?.toLowerCase().includes("windows") ||
            os.name?.toLowerCase().includes("linux")
        ) {
            icon = device.type === "console" ? Monitor : Laptop
            deviceType = "Desktop"
        }

        const name = `${deviceType} • ${browser.name || "Unknown Browser"}`

        return { name, icon, os: os.name, browser: browser.name }
    }, [])

    const formatLastSeen = useCallback((lastSeen: string | Date) => {
        const date = new Date(lastSeen)
        return new Intl.DateTimeFormat("en-US", {
            dateStyle: "short",
            timeStyle: "short"
        }).format(date)
    }, [])

    if (sessionLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Profile Information</CardTitle>
                        <CardDescription>Your personal account information</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center space-x-4">
                            <Avatar className="h-20 w-20">
                                <AvatarImage src={session?.user?.image || ""} />
                                <AvatarFallback className="text-lg">
                                    {displayName ? displayName.charAt(0).toUpperCase() : "?"}
                                </AvatarFallback>
                            </Avatar>
                        </div>

                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label
                                    htmlFor="name"
                                    className="font-medium text-muted-foreground text-sm"
                                >
                                    Name
                                </Label>
                                {isEditingName ? (
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                        <Input
                                            id="name"
                                            value={nameValue}
                                            onChange={(e) => setNameValue(e.target.value)}
                                            placeholder="Enter your name"
                                            className="flex-1"
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={handleSaveName}
                                                disabled={updateUser.isPending}
                                                size="sm"
                                                className="flex-1 sm:flex-none"
                                            >
                                                <Save className="h-4 w-4" />
                                                {updateUser.isPending ? "Saving..." : "Save"}
                                            </Button>
                                            <Button
                                                onClick={handleCancelEdit}
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 sm:flex-none"
                                            >
                                                <X className="h-4 w-4" />
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div
                                            className={cn(
                                                "text-sm",
                                                !displayName && "text-muted-foreground italic"
                                            )}
                                        >
                                            {displayName || "No name"}
                                        </div>
                                        <Button onClick={handleEditName} variant="ghost" size="sm">
                                            <Edit className="h-4 w-4" />
                                            Edit
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label className="font-medium text-muted-foreground text-sm">
                                    Email
                                </Label>
                                <div className="text-sm">{session?.user?.email}</div>
                            </div>

                            <div className="space-y-2">
                                <Label className="font-medium text-muted-foreground text-sm">
                                    User ID
                                </Label>
                                <div className="font-mono text-muted-foreground text-xs">
                                    {session?.user?.id}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <PrototypeCreditsCard
                    summary={prototypeCreditSummary}
                    isLoading={isCreditsLoading}
                    isRefreshing={isRefreshingCredits}
                    shouldShowDevCreditPlanToggle={shouldShowDevCreditPlanToggle}
                    isUpdatingCreditPlan={isUpdatingCreditPlan}
                    onSetCreditPlan={setCreditPlan}
                    onRefresh={refreshCredits}
                    upgradeUrl="/settings/billing"
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Active Sessions</CardTitle>
                    <CardDescription>
                        Manage your active login sessions across devices
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {sessionsLoading ? (
                        <div className="flex items-center justify-center p-4">
                            <div className="h-6 w-6 animate-spin rounded-full border-primary border-b-2" />
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3">
                                {sessions.map((sessionItem) => {
                                    const deviceInfo = getDeviceInfo(sessionItem.userAgent)
                                    const DeviceIcon = deviceInfo.icon
                                    const isCurrentSession = sessionItem.id === session?.session?.id

                                    return (
                                        <div
                                            key={sessionItem.id}
                                            className={cn(
                                                "flex flex-col justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center",
                                                isCurrentSession
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border"
                                            )}
                                        >
                                            <div className="flex flex-1 items-start gap-3">
                                                <div className="mt-0.5">
                                                    <DeviceIcon className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-medium text-sm">
                                                            {deviceInfo.name}
                                                        </span>
                                                        {isCurrentSession && (
                                                            <Badge
                                                                variant="secondary"
                                                                className="text-xs"
                                                            >
                                                                Current
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-muted-foreground text-xs">
                                                        Last seen:{" "}
                                                        {formatLastSeen(sessionItem.createdAt)}
                                                    </div>
                                                    {sessionItem.ipAddress && (
                                                        <div className="text-muted-foreground text-xs">
                                                            IP: {sessionItem.ipAddress}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex-shrink-0">
                                                {isCurrentSession ? (
                                                    <Button
                                                        onClick={handleSignOut}
                                                        variant="destructive"
                                                        size="sm"
                                                        className="w-full sm:w-auto"
                                                    >
                                                        <LogOut className="h-4 w-4" />
                                                        Sign Out
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        onClick={() =>
                                                            handleRevokeSession(sessionItem.id)
                                                        }
                                                        variant="destructive"
                                                        size="sm"
                                                        disabled={revokeSession.isPending}
                                                        className="w-full sm:w-auto"
                                                    >
                                                        <UserX className="h-4 w-4" />
                                                        Revoke
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {sessions.length > 1 && (
                                <>
                                    <Separator />
                                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                                        <div>
                                            <div className="font-medium text-sm">
                                                Security Action
                                            </div>
                                            <div className="text-muted-foreground text-xs">
                                                Sign out of all other devices
                                            </div>
                                        </div>
                                        <Button
                                            onClick={handleRevokeOtherSessions}
                                            variant="destructive"
                                            size="sm"
                                            disabled={revokeOtherSessions.isPending}
                                            className="w-full sm:w-auto"
                                        >
                                            <UserX className="h-4 w-4" />
                                            {revokeOtherSessions.isPending
                                                ? "Revoking..."
                                                : "Revoke All Other Sessions"}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
