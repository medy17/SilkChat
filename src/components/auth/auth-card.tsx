"use client"

import { GoogleIcon } from "@/components/brand-icons"
import { Button } from "@/components/ui/button"
import { LogoSymbol } from "@/components/logo"
import { useSession } from "@/hooks/auth-hooks"
import { authClient } from "@/lib/auth-client"
import type { RestrictionNotice } from "@/convex/lib/moderation"
import { trackGoogleAdsSignupConversion } from "@/lib/google-ads"
import type { AuthSearch } from "@/routes/auth/$pathname"
import { useMutation } from "@tanstack/react-query"
import { Link, useRouter, useSearch } from "@tanstack/react-router"
import { ArrowLeft, Loader2, Mail, ShieldAlert } from "lucide-react"
import { MotionConfig, motion } from "motion/react"
import { type ReactNode, useEffect } from "react"
import { toast } from "sonner"

export function AuthCard() {
    const router = useRouter()
    const { data: session } = useSession()
    const search = useSearch({ strict: false }) as AuthSearch
    const redirectTarget =
        search.redirect?.startsWith("/") && !search.redirect.startsWith("//")
            ? search.redirect
            : "/"

    useEffect(() => {
        if (session?.user) {
            trackGoogleAdsSignupConversion(session.user)
        }

        if (session?.user?.name) {
            router.navigate({ to: redirectTarget })
        }
    }, [session, router, redirectTarget])

    const googleSignInMutation = useMutation({
        mutationFn: async () =>
            authClient.signIn.social({
                provider: "google",
                callbackURL: redirectTarget,
                // Refused sign-ins (e.g. banned accounts) come back here instead of Better
                // Auth's bare error page.
                errorCallbackURL: `${window.location.pathname}${
                    redirectTarget !== "/"
                        ? `?${new URLSearchParams({ redirect: redirectTarget })}`
                        : ""
                }`
            }),
        onError: (error) => {
            toast.error(error.message ?? "Failed to sign in with Google")
        }
    })

    if (search.restriction) {
        return (
            <RestrictedAccountCard
                notice={search.restriction}
                onBack={() =>
                    router.navigate({
                        to: ".",
                        search: search.redirect ? { redirect: search.redirect } : {},
                        replace: true
                    })
                }
            />
        )
    }

    return (
        <MotionConfig
            transition={{
                type: "tween",
                duration: 0.15,
                ease: [0.25, 0.46, 0.45, 0.94]
            }}
        >
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex w-full max-w-xs flex-col gap-8"
            >
                <AuthHeading icon={<LogoSymbol className="size-12 text-foreground" />}>
                    Sign in to SilkChat
                </AuthHeading>
                <div className="grid gap-6">
                    {search.error && (
                        <p role="alert" className="text-center text-destructive text-sm">
                            Sign-in didn't complete ({search.error.replaceAll("_", " ")}). Please
                            try again.
                        </p>
                    )}
                    <Button
                        variant="outline"
                        className="h-10 w-full gap-2"
                        onClick={() => googleSignInMutation.mutate()}
                        disabled={googleSignInMutation.isPending}
                    >
                        {googleSignInMutation.isPending ? (
                            <Loader2 className="size-4 shrink-0 animate-spin" />
                        ) : (
                            <GoogleIcon className="size-4 shrink-0" />
                        )}
                        Continue with Google
                    </Button>
                    <p className="text-center text-muted-foreground text-xs">
                        By continuing, you agree to our{" "}
                        <Link
                            to="/terms-of-service"
                            className="underline underline-offset-2 hover:text-foreground"
                        >
                            Terms
                        </Link>{" "}
                        and{" "}
                        <Link
                            to="/privacy-policy"
                            className="underline underline-offset-2 hover:text-foreground"
                        >
                            Privacy Policy
                        </Link>
                        .
                    </p>
                </div>
            </motion.div>
        </MotionConfig>
    )
}

const SUPPORT_EMAIL = "support@silkchat.dev"

function RestrictedAccountCard({
    notice,
    onBack
}: {
    notice: RestrictionNotice
    onBack: () => void
}) {
    const appealHref = `mailto:${SUPPORT_EMAIL}${
        notice.caseId ? `?subject=${encodeURIComponent(`Appeal: case ${notice.caseId}`)}` : ""
    }`

    return (
        <div className="flex w-full max-w-xs flex-col gap-8">
            <AuthHeading icon={<ShieldAlert className="size-12 text-destructive" />}>
                {notice.endsAt ? "Account suspended" : "Account unavailable"}
            </AuthHeading>
            <div className="grid gap-4 text-sm">
                <p className="text-center text-muted-foreground">
                    {notice.endsAt
                        ? `This account is suspended until ${new Date(notice.endsAt).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })} for violating our Terms of Service.`
                        : "This account was banned for violating our Terms of Service, so it can't sign in or be used to create a new account."}
                </p>
                {notice.caseId && (
                    <p className="text-center">
                        Case ID: <span className="font-mono">{notice.caseId}</span>
                    </p>
                )}
                <Button variant="outline" className="w-full" onClick={onBack}>
                    <ArrowLeft />
                    Back to sign in
                </Button>
                <Button asChild variant="outline" className="w-full">
                    <a href={appealHref}>
                        <Mail />
                        Contact support
                    </a>
                </Button>
            </div>
        </div>
    )
}

function AuthHeading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-4 text-center">
            {icon}
            <h1 className="font-semibold text-2xl tracking-tight">{children}</h1>
        </div>
    )
}
