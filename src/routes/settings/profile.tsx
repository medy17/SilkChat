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
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile"
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router"
import { useAction, useMutation as useConvexMutation, useQuery } from "convex/react"
import {
    Check,
    Copy,
    Download,
    Edit,
    Globe,
    Laptop,
    Loader2,
    LogOut,
    Monitor,
    Save,
    Smartphone,
    Tablet,
    Trash2,
    UserX,
    X
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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

const getExportStatusLabel = (status: string) => {
    switch (status) {
        case "reserved":
        case "building":
            return "being prepared"
        case "uploaded":
            return "ready to send"
        case "delivered":
            return "sent"
        case "failed":
            return "couldn’t be completed"
        default:
            return status
    }
}

export function AccountSettingsContent() {
    const { data: session, isLoading: sessionLoading } = useSession()
    const { data: sessions = [], isLoading: sessionsLoading } = useListSessions()
    const deletionRequest = useQuery(
        api.account_deletion.getMyAccountDeletionRequest,
        session?.user?.id ? {} : "skip"
    )
    const requestAccountDeletion = useConvexMutation(api.account_deletion.requestMyAccountDeletion)
    const requestAccountExport = useAction(api.account_exports_node.requestAccountExport)
    const latestAccountExport = useQuery(
        api.account_exports.getMyLatestAccountExport,
        session?.user?.id ? {} : "skip"
    )
    const accountExportAvailability = useQuery(
        api.account_exports.getAccountExportAvailability,
        session?.user?.id ? {} : "skip"
    )
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
    const [isExportingAccount, setIsExportingAccount] = useState(false)
    const [exportDialogOpen, setExportDialogOpen] = useState(false)
    const [acceptExportSensitiveData, setAcceptExportSensitiveData] = useState(false)
    const [acceptExportPasswordResponsibility, setAcceptExportPasswordResponsibility] =
        useState(false)
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
    const turnstileRef = useRef<TurnstileInstance>(null)
    const exportDialogResetTimerRef = useRef<number | null>(null)
    const [accountExportKey, setAccountExportKey] = useState<string | null>(null)
    const [accountExportKeyCopied, setAccountExportKeyCopied] = useState(false)
    const [exportNow, setExportNow] = useState(() => Date.now())

    useEffect(() => {
        if (!latestAccountExport) return

        const intervalId = window.setInterval(() => setExportNow(Date.now()), 60_000)
        return () => window.clearInterval(intervalId)
    }, [latestAccountExport])
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

    const resetExportDialog = useCallback(() => {
        setAcceptExportSensitiveData(false)
        setAcceptExportPasswordResponsibility(false)
        setTurnstileToken(null)
        setAccountExportKey(null)
        setAccountExportKeyCopied(false)
        turnstileRef.current?.reset()
    }, [])

    const handleExportDialogOpenChange = useCallback(
        (open: boolean) => {
            if (exportDialogResetTimerRef.current !== null) {
                window.clearTimeout(exportDialogResetTimerRef.current)
                exportDialogResetTimerRef.current = null
            }
            setExportDialogOpen(open)
            if (!open) {
                exportDialogResetTimerRef.current = window.setTimeout(() => {
                    resetExportDialog()
                    exportDialogResetTimerRef.current = null
                }, 200)
            }
        },
        [resetExportDialog]
    )

    const canRequestExport =
        acceptExportSensitiveData &&
        acceptExportPasswordResponsibility &&
        Boolean(turnstileToken) &&
        !isExportingAccount
    const isExportCooldownActive = Boolean(
        latestAccountExport && latestAccountExport.nextRequestAt > exportNow
    )
    const shouldShowExportStatus = Boolean(latestAccountExport && isExportCooldownActive)

    const handleExportAccount = useCallback(async () => {
        if (!session?.user || !canRequestExport || !turnstileToken) return

        setIsExportingAccount(true)
        try {
            const reservation = await requestAccountExport({
                turnstileToken,
                consentSensitiveDataLinksAccepted: acceptExportSensitiveData,
                consentOneTimePasswordAccepted: acceptExportPasswordResponsibility
            })
            if (!reservation.accepted) {
                throw new Error(
                    `You can request another export after ${new Date(reservation.nextRequestAt).toLocaleString()}`
                )
            }
            setAccountExportKey(reservation.password)
            toast.success("Export requested. A download link will be emailed to you.")
        } catch (error) {
            console.error("Failed to export account data:", error)
            toast.error(error instanceof Error ? error.message : "Failed to export account data")
            setTurnstileToken(null)
            turnstileRef.current?.reset()
        } finally {
            setIsExportingAccount(false)
        }
    }, [
        canRequestExport,
        acceptExportPasswordResponsibility,
        acceptExportSensitiveData,
        requestAccountExport,
        session?.user,
        turnstileToken
    ])

    const handleCopyAccountExportKey = useCallback(async () => {
        if (!accountExportKey) return
        await navigator.clipboard.writeText(accountExportKey)
        setAccountExportKeyCopied(true)
        window.setTimeout(() => setAccountExportKeyCopied(false), 2000)
    }, [accountExportKey])

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
                        {/* <CardDescription>Your personal account information</CardDescription> */}
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

            <Card>
                <CardHeader className="flex flex-col sm:grid sm:grid-cols-[1fr_auto] sm:grid-rows-[auto_auto]">
                    <CardTitle>Export your data</CardTitle>
                    <CardDescription className="max-w-2xl space-y-1">
                        <p>
                            We’ll email you a link to a password-protected ZIP. You can request one
                            export every 24 hours.
                        </p>
                        {shouldShowExportStatus && latestAccountExport && (
                            <p className="text-xs">
                                Your last export was{" "}
                                {getExportStatusLabel(latestAccountExport.status)}. You can request
                                another after{" "}
                                {new Date(latestAccountExport.nextRequestAt).toLocaleString()}.
                            </p>
                        )}
                        {accountExportAvailability?.configured === false && (
                            <p className="text-destructive text-xs">
                                Exports aren’t available right now. Try again later.
                            </p>
                        )}
                    </CardDescription>
                    <CardAction className="order-3 mt-3 w-full self-stretch justify-self-stretch sm:order-none sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:w-auto sm:self-center sm:justify-self-end">
                        <Button
                            type="button"
                            size="sm"
                            className="w-full shrink-0 sm:w-auto"
                            onClick={() => setExportDialogOpen(true)}
                            disabled={
                                isExportingAccount ||
                                !session?.user ||
                                accountExportAvailability?.configured !== true ||
                                Boolean(isExportCooldownActive)
                            }
                        >
                            {isExportingAccount ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4" />
                            )}
                            {isExportingAccount ? "Preparing export..." : "Request export"}
                        </Button>
                    </CardAction>
                </CardHeader>
            </Card>

            <AlertDialog open={exportDialogOpen} onOpenChange={handleExportDialogOpenChange}>
                <AlertDialogContent className="min-w-0 overflow-hidden rounded-[var(--radius-xl)]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {accountExportKey
                                ? "Save your ZIP password"
                                : "Export your SilkChat data"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {accountExportKey
                                ? "This is the only time we’ll show it. SilkChat can’t recover it for you."
                                : "Your archive may include private conversations and personal files. Please review these details before continuing."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {accountExportKey ? (
                        <div className="min-w-0 space-y-4">
                            <div className="flex min-w-0 items-center gap-2">
                                <code
                                    className="block w-0 min-w-0 flex-1 truncate whitespace-nowrap rounded-[var(--radius-md)] bg-muted p-3 text-xs"
                                    title={accountExportKey}
                                >
                                    {accountExportKey}
                                </code>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="shrink-0 rounded-[var(--radius-md)]"
                                            aria-label="Copy ZIP password"
                                            onClick={() => void handleCopyAccountExportKey()}
                                        >
                                            {accountExportKeyCopied ? (
                                                <Check className="h-4 w-4" />
                                            ) : (
                                                <Copy className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="z-[80]">
                                        {accountExportKeyCopied ? "Copied!" : "Copy password"}
                                    </TooltipContent>
                                </Tooltip>
                            </div>

                            <div className="flex min-w-0 items-start gap-3 rounded-[var(--radius-lg)] border p-3">
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                <div className="min-w-0 space-y-1 text-sm">
                                    <div className="font-medium">Your export is on its way</div>
                                    <p className="text-muted-foreground">
                                        We’ll email the download link to you shortly. You can close
                                        this page while we prepare it.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <label
                                    htmlFor="export-sensitive-data-consent"
                                    className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] border p-3 text-sm"
                                >
                                    <Checkbox
                                        id="export-sensitive-data-consent"
                                        checked={acceptExportSensitiveData}
                                        onCheckedChange={(checked) =>
                                            setAcceptExportSensitiveData(checked === true)
                                        }
                                        className="mt-0.5 rounded-[var(--radius-sm)]"
                                    />
                                    <span>
                                        I understand that my export may contain private
                                        conversations and links to files I’ve uploaded or created.
                                    </span>
                                </label>

                                <label
                                    htmlFor="export-password-consent"
                                    className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-lg)] border p-3 text-sm"
                                >
                                    <Checkbox
                                        id="export-password-consent"
                                        checked={acceptExportPasswordResponsibility}
                                        onCheckedChange={(checked) =>
                                            setAcceptExportPasswordResponsibility(checked === true)
                                        }
                                        className="mt-0.5 rounded-[var(--radius-sm)]"
                                    />
                                    <span>
                                        I’ll save the one-time password shown after I request my
                                        export. SilkChat can’t recover it for me.
                                    </span>
                                </label>
                            </div>

                            {accountExportAvailability?.siteKey && (
                                <div className="space-y-2">
                                    <div>
                                        <div className="font-medium text-sm">Security check</div>
                                        <p className="text-muted-foreground text-xs">
                                            Confirm you’re human to continue.
                                        </p>
                                    </div>
                                    <div className="overflow-hidden rounded-[var(--radius-lg)] border p-3">
                                        <Turnstile
                                            ref={turnstileRef}
                                            siteKey={accountExportAvailability.siteKey}
                                            options={{
                                                action: "account_export",
                                                appearance: "always",
                                                execution: "render",
                                                size: "flexible",
                                                theme: "auto"
                                            }}
                                            onSuccess={setTurnstileToken}
                                            onExpire={() => setTurnstileToken(null)}
                                            onError={() => setTurnstileToken(null)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <AlertDialogFooter>
                        {accountExportKey ? (
                            <AlertDialogCancel>Done</AlertDialogCancel>
                        ) : (
                            <>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <Button
                                    type="button"
                                    className="rounded-[var(--radius-md)]"
                                    disabled={!canRequestExport}
                                    onClick={() => void handleExportAccount()}
                                >
                                    <Download className="h-4 w-4" />
                                    Request export
                                </Button>
                            </>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
