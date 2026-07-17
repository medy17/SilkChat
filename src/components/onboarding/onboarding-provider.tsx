"use client"

import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { useOnboarding } from "@/hooks/use-onboarding"
import { optionalBrowserEnv } from "@/lib/browser-env"
import {
    clearPastDueRenewalDismissal,
    dismissPastDueRenewalNudge,
    shouldShowPastDueRenewalNudge
} from "@/lib/past-due-renewal"
import { dismissProWelcome, shouldShowProWelcome } from "@/lib/pro-welcome"
import { useQuery } from "convex/react"
import { useEffect, useState } from "react"
import {
    DEV_OPEN_ONBOARDING_EVENT,
    DEV_OPEN_PRO_WELCOME_EVENT,
    DEV_OPEN_RENEWAL_NUDGE_EVENT
} from "./dev-onboarding"
import { OnboardingDialog } from "./onboarding-dialog"
import { PastDueRenewalDialog } from "./past-due-renewal-dialog"
import { ProWelcomeDialog } from "./pro-welcome-dialog"

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

        document.addEventListener(DEV_OPEN_ONBOARDING_EVENT, openDevDialog)
        document.addEventListener(DEV_OPEN_RENEWAL_NUDGE_EVENT, openDevRenewalDialog)
        document.addEventListener(DEV_OPEN_PRO_WELCOME_EVENT, openDevProWelcomeDialog)

        const searchParams = new URLSearchParams(window.location.search)
        if (searchParams.get("onboarding") === "1" || searchParams.has("showOnboarding")) {
            openDevDialog()
        }

        return () => {
            document.removeEventListener(DEV_OPEN_ONBOARDING_EVENT, openDevDialog)
            document.removeEventListener(DEV_OPEN_RENEWAL_NUDGE_EVENT, openDevRenewalDialog)
            document.removeEventListener(DEV_OPEN_PRO_WELCOME_EVENT, openDevProWelcomeDialog)
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

        if (isLoading || shouldShowOnboarding || isStatusDialogOpen || isDevDialogOpen) {
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
            isDevRenewalDialogOpen
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
        </>
    )
}
