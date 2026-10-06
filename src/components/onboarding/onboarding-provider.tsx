"use client"

import {
    type ModerationNotice,
    ModerationNoticeDialog
} from "@/components/moderation/moderation-notice-dialog"
import { api } from "@/convex/_generated/api"
import {
    DEFAULT_STRIKE_EXPIRY_DAYS,
    MODERATION_STRIKE_LIMIT,
    addDays
} from "@/convex/lib/moderation"
import { useSession } from "@/hooks/auth-hooks"
import { useOnboarding } from "@/hooks/use-onboarding"
import { optionalBrowserEnv } from "@/lib/browser-env"
import {
    clearPastDueRenewalDismissal,
    dismissPastDueRenewalNudge,
    shouldShowPastDueRenewalNudge
} from "@/lib/past-due-renewal"
import { dismissProWelcome, shouldShowProWelcome } from "@/lib/pro-welcome"
import { useMutation, useQuery } from "convex/react"
import { useEffect, useState } from "react"
import {
    DEV_OPEN_MODERATION_NOTICE_EVENT,
    DEV_OPEN_ONBOARDING_EVENT,
    DEV_OPEN_PRO_WELCOME_EVENT,
    DEV_OPEN_RENEWAL_NUDGE_EVENT,
    type DevModerationNoticeAction
} from "./dev-onboarding"
import { OnboardingDialog } from "./onboarding-dialog"
import { PastDueRenewalDialog } from "./past-due-renewal-dialog"
import { ProWelcomeDialog } from "./pro-welcome-dialog"

const buildDevModerationNotice = (action: DevModerationNoticeAction): ModerationNotice => {
    const now = Date.now()
    const isStrike = action === "strike"
    return {
        moderationCase: {
            caseId: "SC-DEV2K7QX",
            action,
            violation: isStrike
                ? "Automated bulk extraction of model responses."
                : "Repeated attempts to generate content that harasses a named person.",
            policyReference: isStrike
                ? "Terms of Service §5.1 Restrictions"
                : "Terms of Service §5.2 Prohibited conduct",
            policyAnchor: isStrike ? "section-5-1" : "section-5-2",
            contentAction: isStrike ? null : "The affected messages were removed.",
            strikeNumber: isStrike ? 2 : null,
            strikeLimit: isStrike ? MODERATION_STRIKE_LIMIT : null,
            expiresAt: isStrike ? addDays(now, DEFAULT_STRIKE_EXPIRY_DAYS) : null,
            endsAt: null,
            state: "active",
            createdAt: now,
            canAppeal: true,
            appeal: null,
            updates: []
        },
        activeStrikes: isStrike ? 2 : 0,
        strikeLimit: MODERATION_STRIKE_LIMIT
    }
}

interface OnboardingProviderProps {
    children: React.ReactNode
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
    const { data: session } = useSession()
    const { shouldShowOnboarding, isLoading, completeOnboarding } = useOnboarding()
    const billingSummary = useQuery(
        api.billing.getMyBillingSummary,
        session?.user?.id ? {} : "skip"
    )
    const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
    const [isDevDialogOpen, setIsDevDialogOpen] = useState(false)
    const [isRenewalDialogOpen, setIsRenewalDialogOpen] = useState(false)
    const [isDevRenewalDialogOpen, setIsDevRenewalDialogOpen] = useState(false)
    const [isProWelcomeDialogOpen, setIsProWelcomeDialogOpen] = useState(false)
    const [isDevProWelcomeDialogOpen, setIsDevProWelcomeDialogOpen] = useState(false)
    const moderationNotices = useQuery(
        api.moderation.getMyModerationNotices,
        session?.user?.id ? {} : "skip"
    )
    const acknowledgeModerationCase = useMutation(api.moderation.acknowledgeModerationCase)
    // Hides a notice as soon as it's acknowledged, and for the rest of the session when the
    // mutation is a no-op because an operator is viewing as this user.
    const [acknowledgedCaseIds, setAcknowledgedCaseIds] = useState<string[]>([])
    const [devModerationNotice, setDevModerationNotice] = useState<ModerationNotice | null>(null)

    const pendingModerationCase = moderationNotices?.cases.find(
        (moderationCase) => !acknowledgedCaseIds.includes(moderationCase.id)
    )
    const moderationNotice: ModerationNotice | null =
        devModerationNotice ??
        (pendingModerationCase && moderationNotices && !isStatusDialogOpen && !isDevDialogOpen
            ? {
                  moderationCase: pendingModerationCase,
                  activeStrikes: moderationNotices.standing.activeStrikes,
                  strikeLimit: moderationNotices.standing.strikeLimit
              }
            : null)
    const isModerationNoticeOpen = moderationNotice !== null

    useEffect(() => {
        if (!isLoading && shouldShowOnboarding) {
            // Add a small delay to ensure the app is fully loaded
            const timer = setTimeout(() => {
                setIsStatusDialogOpen(true)
            }, 1000)

            return () => clearTimeout(timer)
        }

        if (!isLoading && !shouldShowOnboarding) {
            // If onboarding is complete, make sure dialog is closed
            setIsStatusDialogOpen(false)
        }
    }, [isLoading, shouldShowOnboarding])

    useEffect(() => {
        if (!import.meta.env.DEV) return

        const openDevDialog = () => {
            setIsDevDialogOpen(true)
        }
        const openDevRenewalDialog = () => {
            setIsDevRenewalDialogOpen(true)
        }
        const openDevProWelcomeDialog = () => {
            setIsDevProWelcomeDialogOpen(true)
        }
        const openDevModerationNotice = (event: Event) => {
            const action = (event as CustomEvent<DevModerationNoticeAction>).detail
            setDevModerationNotice(buildDevModerationNotice(action))
        }

        document.addEventListener(DEV_OPEN_ONBOARDING_EVENT, openDevDialog)
        document.addEventListener(DEV_OPEN_RENEWAL_NUDGE_EVENT, openDevRenewalDialog)
        document.addEventListener(DEV_OPEN_PRO_WELCOME_EVENT, openDevProWelcomeDialog)
        document.addEventListener(DEV_OPEN_MODERATION_NOTICE_EVENT, openDevModerationNotice)

        const searchParams = new URLSearchParams(window.location.search)
        if (searchParams.get("onboarding") === "1" || searchParams.has("showOnboarding")) {
            openDevDialog()
        }

        return () => {
            document.removeEventListener(DEV_OPEN_ONBOARDING_EVENT, openDevDialog)
            document.removeEventListener(DEV_OPEN_RENEWAL_NUDGE_EVENT, openDevRenewalDialog)
            document.removeEventListener(DEV_OPEN_PRO_WELCOME_EVENT, openDevProWelcomeDialog)
            document.removeEventListener(DEV_OPEN_MODERATION_NOTICE_EVENT, openDevModerationNotice)
        }
    }, [])

    useEffect(() => {
        const userId = session?.user?.id
        if (!userId || !billingSummary) return

        const subscription = billingSummary.subscription
        if (subscription?.status !== "past_due") {
            clearPastDueRenewalDismissal({ userId })
            setIsRenewalDialogOpen(false)
            return
        }

        if (
            isLoading ||
            shouldShowOnboarding ||
            isStatusDialogOpen ||
            isDevDialogOpen ||
            isModerationNoticeOpen
        ) {
            setIsRenewalDialogOpen(false)
            return
        }

        if (
            !shouldShowPastDueRenewalNudge({
                userId,
                status: subscription.status,
                subscriptionId: subscription.lemonSqueezySubscriptionId
            })
        ) {
            setIsRenewalDialogOpen(false)
            return
        }

        const timer = setTimeout(() => setIsRenewalDialogOpen(true), 1000)
        return () => clearTimeout(timer)
    }, [
        billingSummary,
        isDevDialogOpen,
        isLoading,
        isModerationNoticeOpen,
        isStatusDialogOpen,
        session?.user?.id,
        shouldShowOnboarding
    ])

    useEffect(() => {
        const userId = session?.user?.id
        if (!userId || !billingSummary) return

        const subscription = billingSummary.subscription
        if (
            isLoading ||
            shouldShowOnboarding ||
            isStatusDialogOpen ||
            isDevDialogOpen ||
            isRenewalDialogOpen ||
            isDevRenewalDialogOpen ||
            isModerationNoticeOpen
        ) {
            setIsProWelcomeDialogOpen(false)
            return
        }

        if (
            !shouldShowProWelcome({
                userId,
                plan: billingSummary.plan,
                status: subscription?.status,
                subscriptionId: subscription?.lemonSqueezySubscriptionId,
                createdAt: subscription?.createdAt
            })
        ) {
            setIsProWelcomeDialogOpen(false)
            return
        }

        const timer = setTimeout(() => setIsProWelcomeDialogOpen(true), 1000)
        return () => clearTimeout(timer)
    }, [
        billingSummary,
        isDevDialogOpen,
        isDevRenewalDialogOpen,
        isLoading,
        isModerationNoticeOpen,
        isRenewalDialogOpen,
        isStatusDialogOpen,
        session?.user?.id,
        shouldShowOnboarding
    ])

    const handleOnboardingComplete = async () => {
        setIsStatusDialogOpen(false)
        setIsDevDialogOpen(false)
        await completeOnboarding()
    }

    const handleRenewalDismiss = () => {
        if (isDevRenewalDialogOpen) {
            setIsDevRenewalDialogOpen(false)
            return
        }

        const userId = session?.user?.id
        const subscription = billingSummary?.subscription

        if (userId && subscription?.lemonSqueezySubscriptionId) {
            dismissPastDueRenewalNudge({
                userId,
                subscriptionId: subscription.lemonSqueezySubscriptionId
            })
        }
        setIsRenewalDialogOpen(false)
    }

    const handleProWelcomeDismiss = () => {
        if (isDevProWelcomeDialogOpen) {
            setIsDevProWelcomeDialogOpen(false)
            return
        }

        const userId = session?.user?.id
        const subscription = billingSummary?.subscription

        if (userId && subscription?.lemonSqueezySubscriptionId) {
            dismissProWelcome({
                userId,
                subscriptionId: subscription.lemonSqueezySubscriptionId
            })
        }
        setIsProWelcomeDialogOpen(false)
    }

    const handleModerationNoticeAcknowledge = () => {
        if (devModerationNotice) {
            setDevModerationNotice(null)
            return
        }
        if (!pendingModerationCase) return

        const caseId = pendingModerationCase.id
        setAcknowledgedCaseIds((ids) => [...ids, caseId])
        void acknowledgeModerationCase({ caseId }).catch(() => {
            // The notice comes back on the next visit, so there's nothing to surface here.
        })
    }

    return (
        <>
            {children}
            <OnboardingDialog
                isOpen={isStatusDialogOpen || isDevDialogOpen}
                onComplete={handleOnboardingComplete}
            />
            <PastDueRenewalDialog
                isOpen={isRenewalDialogOpen || isDevRenewalDialogOpen}
                renewalUrl={optionalBrowserEnv("VITE_LEMONSQUEEZY_CUSTOMER_PORTAL_URL")}
                onDismiss={handleRenewalDismiss}
            />
            <ProWelcomeDialog
                isOpen={isProWelcomeDialogOpen || isDevProWelcomeDialogOpen}
                onDismiss={handleProWelcomeDismiss}
            />
            <ModerationNoticeDialog
                notice={moderationNotice}
                onAcknowledge={handleModerationNoticeAcknowledge}
            />
        </>
    )
}
