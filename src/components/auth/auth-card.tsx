"use client"

import { GoogleIcon } from "@/components/brand-icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSession } from "@/hooks/auth-hooks"
import { authClient } from "@/lib/auth-client"
import type { RestrictionNotice } from "@/convex/lib/moderation"
import { trackGoogleAdsSignupConversion } from "@/lib/google-ads"
import type { AuthSearch } from "@/routes/auth/$pathname"
import { useMutation } from "@tanstack/react-query"
import { useRouter, useSearch } from "@tanstack/react-router"
import { Loader2, ShieldAlert } from "lucide-react"
import { MotionConfig, motion } from "motion/react"
import { useEffect } from "react"
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
            <div className="flex w-full max-w-sm flex-col gap-6 md:max-w-md">
                <Card className="inset-shadow-sm gap-4 overflow-hidden border-2 bg-card pt-3 pb-5">
                    <CardHeader className="flex justify-center border-b-2 [.border-b-2]:pb-2.5">
                        <CardTitle className="text-xl">Sign In to SilkChat</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-6">
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="grid gap-4"
                        >
                            <p className="text-center text-muted-foreground text-sm">
                                Continue with your Google account to access this workspace.
                            </p>
                            {search.error && (
                                <p role="alert" className="text-center text-destructive text-sm">
                                    Sign-in didn't complete ({search.error.replaceAll("_", " ")}).
                                    Please try again.
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
                        </motion.div>
                    </CardContent>
                </Card>
            </div>
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
        <div className="flex w-full max-w-sm flex-col gap-6 md:max-w-md">
            <Card className="inset-shadow-sm gap-4 overflow-hidden border-2 bg-card pt-3 pb-5">
                <CardHeader className="flex items-center justify-center gap-2 border-b-2 [.border-b-2]:pb-2.5">
                    <ShieldAlert className="size-5 text-destructive" />
                    <CardTitle className="text-xl">
                        {notice.endsAt ? "Account suspended" : "Account unavailable"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 text-sm">
                    <p className="text-muted-foreground">
                        {notice.endsAt
                            ? `This account is suspended until ${new Date(notice.endsAt).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" })} for violating our Terms of Service.`
                            : "This account was banned for violating our Terms of Service, so it can't sign in or be used to create a new account."}{" "}
                        We emailed the account address with the details.
                    </p>
                    {notice.caseId && (
                        <p>
                            Case ID: <span className="font-mono">{notice.caseId}</span>
                        </p>
                    )}
                    <p className="text-muted-foreground">
                        If you think we got this wrong, email{" "}
                        <a href={appealHref} className="text-primary underline underline-offset-2">
                            {SUPPORT_EMAIL}
                        </a>{" "}
                        {notice.caseId ? "with your case ID" : "from the account's email address"}.
                        A person will review every appeal.
                    </p>
                    <Button variant="outline" className="w-full" onClick={onBack}>
                        Back to sign in
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
