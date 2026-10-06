import { AppealDialog } from "@/components/moderation/appeal-dialog"
import {
    ACTION_LABELS,
    CaseDetails,
    CaseHeader,
    StrikeMeter,
    describeStanding
} from "@/components/moderation/case-details"
import { SettingsLayout } from "@/components/settings/settings-layout"
import { SettingsSkeleton, SkeletonCardRow } from "@/components/settings/settings-skeletons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { cn } from "@/lib/utils"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ShieldAlert, ShieldCheck } from "lucide-react"
import { useState } from "react"

export const Route = createFileRoute("/settings/safety")({
    component: SafetySettingsRoute
})

type SafetyCase = NonNullable<
    FunctionReturnType<typeof api.moderation.getMySafety>
>["cases"][number]

function SafetySkeleton() {
    return (
        <SettingsSkeleton label="Loading account standing">
            <SkeletonCardRow />
            <SkeletonCardRow leading="none" />
        </SettingsSkeleton>
    )
}

function AppealAction({
    moderationCase,
    supportEmail,
    impersonating,
    onAppeal
}: {
    moderationCase: SafetyCase
    supportEmail: string
    impersonating: boolean
    onAppeal: () => void
}) {
    if (moderationCase.appeal || moderationCase.state !== "active") return null
    if (!moderationCase.canAppeal) {
        return (
            <a
                href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Appeal: case ${moderationCase.caseId}`)}`}
                className="text-muted-foreground text-xs underline underline-offset-2 hover:text-primary"
            >
                Appeal by email
            </a>
        )
    }
    if (!impersonating) {
        return (
            <Button size="sm" variant="outline" onClick={onAppeal}>
                Appeal
            </Button>
        )
    }
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                {/* aria-disabled rather than disabled, so the tooltip still gets hover and focus. */}
                <Button
                    size="sm"
                    variant="outline"
                    aria-disabled="true"
                    className="cursor-not-allowed opacity-50"
                    onClick={(event) => event.preventDefault()}
                >
                    Appeal
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                Appeals are turned off while you're viewing as this user.
            </TooltipContent>
        </Tooltip>
    )
}

function SafetySettingsRoute() {
    const { data: session } = useSession()
    const safety = useQuery(api.moderation.getMySafety, session?.user?.id ? {} : "skip")
    const [appealing, setAppealing] = useState<SafetyCase | null>(null)
    const impersonating = Boolean(session?.session.impersonatedBy)

    return (
        <SettingsLayout
            title="Safety"
            description="Your account standing, and any warnings, strikes, or appeals on your account."
        >
            {!safety ? (
                <SafetySkeleton />
            ) : (
                <div className="space-y-6">
                    <StandingCard standing={safety.standing} />

                    <section className="space-y-3" aria-labelledby="safety-history-heading">
                        <h3 id="safety-history-heading" className="font-semibold">
                            History
                        </h3>
                        {safety.cases.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                We haven't taken any action on your account.
                            </p>
                        ) : (
                            safety.cases.map((moderationCase) => (
                                <Card key={moderationCase.id} className="gap-4 py-4 shadow-none">
                                    <CardContent className="space-y-4 px-4">
                                        <CaseHeader
                                            data={moderationCase}
                                            action={
                                                <AppealAction
                                                    moderationCase={moderationCase}
                                                    supportEmail={safety.supportEmail}
                                                    impersonating={impersonating}
                                                    onAppeal={() => setAppealing(moderationCase)}
                                                />
                                            }
                                        />
                                        <CaseDetails data={moderationCase} />
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </section>

                    <p className="text-muted-foreground text-xs">
                        Questions about your account's standing? Email{" "}
                        <a
                            href={`mailto:${safety.supportEmail}`}
                            className="underline underline-offset-2 hover:text-primary"
                        >
                            {safety.supportEmail}
                        </a>
                        .
                    </p>
                </div>
            )}
            {appealing && (
                <AppealDialog
                    caseId={appealing.id}
                    caseLabel={`${ACTION_LABELS[appealing.action].toLowerCase()} ${appealing.caseId}`}
                    open={Boolean(appealing)}
                    onOpenChange={(open) => !open && setAppealing(null)}
                />
            )}
        </SettingsLayout>
    )
}

function StandingCard({
    standing
}: {
    standing: NonNullable<FunctionReturnType<typeof api.moderation.getMySafety>>["standing"]
}) {
    const { title, detail } = describeStanding(standing)
    const good = standing.status === "good"
    const Icon = good ? ShieldCheck : ShieldAlert

    return (
        <Card className="gap-3 py-5">
            <CardHeader className="flex items-start gap-3 px-5">
                <Icon
                    className={cn(
                        "mt-0.5 size-5 shrink-0",
                        good
                            ? "text-primary"
                            : standing.status === "strikes"
                              ? "text-warning"
                              : "text-destructive"
                    )}
                />
                <div className="min-w-0 space-y-1">
                    <CardTitle>{title}</CardTitle>
                    {detail && <CardDescription>{detail}</CardDescription>}
                </div>
            </CardHeader>
            <CardContent className="px-5 pl-13">
                <StrikeMeter active={standing.activeStrikes} limit={standing.strikeLimit} />
            </CardContent>
        </Card>
    )
}
