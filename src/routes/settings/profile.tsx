import { PrototypeCreditsCard } from "@/components/credits/prototype-credits"
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { api } from "@/convex/_generated/api"
import {
    useListSessions,
    useRevokeOtherSessions,
    useRevokeSession,
    useSession,
    useUpdateUser
} from "@/hooks/auth-hooks"
import { usePrototypeCredits } from "@/hooks/use-prototype-credits"
import { authClient } from "@/lib/auth-client"
import { useShowContextualDevTools } from "@/lib/dev-tools"
import { cn } from "@/lib/utils"
import { queryClient } from "@/providers"
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import { useMutation as useConvexMutation, useQuery } from "convex/react"
import {
    Edit,
    Globe,
    Laptop,
    LogOut,
    Monitor,
    Save,
    Smartphone,
    Tablet,
    Trash2,
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
    const deletionRequest = useQuery(
        api.account_deletion.getMyAccountDeletionRequest,
        session?.user?.id ? {} : "skip"
    )
    const requestAccountDeletion = useConvexMutation(api.account_deletion.requestMyAccountDeletion)
    const updateUser = useUpdateUser()
    const revokeSession = useRevokeSession()
    const revokeOtherSessions = useRevokeOtherSessions()
    const router = useRouter()
    const [isEditingName, setIsEditingName] = useState(false)
    const [nameValue, setNameValue] = useState("")
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deleteConfirmationPhrase, setDeleteConfirmationPhrase] = useState("")
    const [acceptPermanentErasure, setAcceptPermanentErasure] = useState(false)
    const [acceptFraudRetention, setAcceptFraudRetention] = useState(false)
    const [isRequestingDeletion, setIsRequestingDeletion] = useState(false)
    const showContextualDevTools = useShowContextualDevTools()
    const shouldShowDevCreditPlanToggle = showContextualDevTools && Boolean(session?.user?.id)
    const {
        summary: prototypeCreditSummary,
        isLoading: isCreditsLoading,
        isRefreshing: isRefreshingCredits,
        devCreditState,
        isUpdatingDevCreditState,
        refreshCredits,
        setDevCreditState
    } = usePrototypeCredits({
        userId: session?.user?.id,
        isAuthLoading: sessionLoading,
        enableDevCreditState: shouldShowDevCreditPlanToggle
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

    const resetDeleteDialog = useCallback(() => {
        setDeleteConfirmationPhrase("")
        setAcceptPermanentErasure(false)
        setAcceptFraudRetention(false)
    }, [])

    const handleDeleteDialogOpenChange = useCallback(
        (open: boolean) => {
            setDeleteDialogOpen(open)
            if (!open) {
                resetDeleteDialog()
            }
        },
        [resetDeleteDialog]
    )

    const canRequestDeletion =
        deleteConfirmationPhrase === "Delete my account" &&
        acceptPermanentErasure &&
        acceptFraudRetention &&
        !isRequestingDeletion

    const handleRequestAccountDeletion = useCallback(async () => {
        if (!canRequestDeletion) return

        setIsRequestingDeletion(true)
        try {
            await requestAccountDeletion({
                confirmationPhrase: deleteConfirmationPhrase,
                consentPermanentErasureAccepted: acceptPermanentErasure,
                consentFraudPreventionRetentionAccepted: acceptFraudRetention
            })
            toast.success("Account deletion request recorded")
            handleDeleteDialogOpenChange(false)
            await handleSignOut()
        } catch (error) {
            toast.error("Failed to request account deletion")
            console.error("Error requesting account deletion:", error)
        } finally {
            setIsRequestingDeletion(false)
        }
    }, [
        acceptFraudRetention,
        acceptPermanentErasure,
        canRequestDeletion,
        deleteConfirmationPhrase,
        handleDeleteDialogOpenChange,
        handleSignOut,
        requestAccountDeletion
    ])

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
                    devCreditState={devCreditState}
                    isUpdatingDevCreditState={isUpdatingDevCreditState}
                    onSetDevCreditState={setDevCreditState}
                    onRefresh={refreshCredits}
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

            <Card className="border-destructive/40">
                <CardHeader>
                    <CardTitle>Danger Zone</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <div className="font-medium text-sm">Delete account</div>
                            <div className="max-w-2xl text-muted-foreground text-sm">
                                Permanently delete your SilkChat account and all associated data.
                                This action cannot be undone.
                            </div>
                            {deletionRequest?.status && (
                                <div className="text-destructive text-xs">
                                    Deletion request status: {deletionRequest.status}
                                </div>
                            )}
                        </div>
                        <Button
                            type="button"
                            variant="destructive"
                            className="w-full shrink-0 rounded-[var(--radius-md)] sm:w-auto"
                            onClick={() => setDeleteDialogOpen(true)}
                            disabled={
                                deletionRequest?.status === "pending" ||
                                deletionRequest?.status === "purging" ||
                                deletionRequest?.status === "retrying"
                            }
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete Account
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogOpenChange}>
                <AlertDialogContent className="rounded-[var(--radius-xl)]">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive text-xl">
                            Are you sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <p>
                                This will permanently delete your SilkChat account and associated
                                user data. This action cannot be undone.
                            </p>
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="delete-confirmation-phrase">Confirmation phrase</Label>
                            <Input
                                id="delete-confirmation-phrase"
                                value={deleteConfirmationPhrase}
                                onChange={(event) =>
                                    setDeleteConfirmationPhrase(event.target.value)
                                }
                                placeholder="Type 'Delete my account' to confirm"
                                autoComplete="off"
                            />
                        </div>

                        <div className="space-y-3">
                            <label
                                htmlFor="delete-permanent-erasure-consent"
                                className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] border p-3 text-sm"
                            >
                                <Checkbox
                                    id="delete-permanent-erasure-consent"
                                    checked={acceptPermanentErasure}
                                    onCheckedChange={(checked) =>
                                        setAcceptPermanentErasure(checked === true)
                                    }
                                    className="mt-0.5 rounded-[var(--radius-sm)]"
                                />
                                <span>
                                    I understand that deleting my SilkChat account will permanently
                                    erase my user data with no recovery guarantee.
                                </span>
                            </label>

                            <label
                                htmlFor="delete-fraud-retention-consent"
                                className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] border p-3 text-sm"
                            >
                                <Checkbox
                                    id="delete-fraud-retention-consent"
                                    checked={acceptFraudRetention}
                                    onCheckedChange={(checked) =>
                                        setAcceptFraudRetention(checked === true)
                                    }
                                    className="mt-0.5 rounded-[var(--radius-sm)]"
                                />
                                <span>
                                    I understand SilkChat may retain limited records where required
                                    for fraud prevention, security, legal compliance, or abuse
                                    prevention.
                                </span>
                            </label>
                        </div>
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isRequestingDeletion}>
                            Cancel
                        </AlertDialogCancel>
                        <Button
                            type="button"
                            variant="destructive"
                            className="rounded-[var(--radius-md)]"
                            disabled={!canRequestDeletion}
                            onClick={handleRequestAccountDeletion}
                        >
                            <Trash2 className="h-4 w-4" />
                            {isRequestingDeletion ? "Requesting..." : "Request deletion"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
