"use client"

import {
    type CaseDetailsData,
    StrikeMeter,
    formatModerationDate
} from "@/components/moderation/case-details"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { getRemainingStrikesCopy } from "@/convex/lib/moderation"
import { useSession } from "@/hooks/auth-hooks"
import { cn } from "@/lib/utils"
import { Link } from "@tanstack/react-router"
import { ChevronRight, ShieldAlert, UserIcon } from "lucide-react"
import { MotionConfig, motion } from "motion/react"
import { useEffect, useState } from "react"

export type ModerationNotice = {
    moderationCase: CaseDetailsData & { canAppeal: boolean }
    activeStrikes: number
    strikeLimit: number
}

interface ModerationNoticeDialogProps {
    notice: ModerationNotice | null
    onAcknowledge: () => void
}

const getInitials = (name: string) =>
    name
        .trim()
        .split(/s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()

export function ModerationNoticeDialog({ notice, onAcknowledge }: ModerationNoticeDialogProps) {
    const { data: session } = useSession()
    const user = session?.user
    const initials = user?.name ? getInitials(user.name) : ""
    // Keeps the last notice on screen while the dialog animates out.
    const [lastNotice, setLastNotice] = useState(notice)
    useEffect(() => {
        if (notice) setLastNotice(notice)
    }, [notice])
    const current = notice ?? lastNotice
    const moderationCase = current?.moderationCase
    const isStrike = moderationCase?.action === "strike"

    return (
        <Dialog open={notice !== null} onOpenChange={() => {}}>
            <DialogContent
                className="w-[95vw] max-w-2xl border-0 bg-transparent p-0 shadow-none sm:w-full"
                showCloseButton={false}
            >
                {current && moderationCase && (
                    <MotionConfig transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}>
                        <motion.div
                            key={moderationCase.caseId}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            <Card className="inset-shadow-sm w-full max-w-none overflow-hidden border-2 bg-card pt-3 pb-5">
                                <CardContent className="flex flex-col items-center px-4 py-6 text-center sm:px-6 sm:py-8">
                                    <div className="relative mb-5 h-24 w-24">
                                        <Avatar className="size-24 rounded-full border-2 border-primary/20 bg-secondary">
                                            <AvatarImage
                                                src={user?.image || undefined}
                                                alt=""
                                                className="rounded-full object-cover"
                                            />
                                            <AvatarFallback className="rounded-full border-0 bg-secondary text-2xl shadow-none">
                                                {initials || <UserIcon className="size-8" />}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div
                                            className={cn(
                                                "absolute -right-2 -bottom-2 grid size-9 place-items-center rounded-lg border-2 border-card shadow-sm",
                                                isStrike
                                                    ? "bg-warning text-warning-foreground"
                                                    : "bg-secondary text-secondary-foreground"
                                            )}
                                        >
                                            <ShieldAlert className="size-4" />
                                        </div>
                                    </div>

                                    <DialogTitle className="max-w-md font-bold text-2xl text-foreground tracking-tight">
                                        Your account received a {isStrike ? "strike" : "warning"}
                                    </DialogTitle>

                                    <Card className="mt-6 w-full max-w-md gap-2 p-4 text-left shadow-none">
                                        <DialogDescription className="text-foreground text-sm leading-relaxed">
                                            {moderationCase.violation}
                                        </DialogDescription>
                                        <p className="text-muted-foreground text-xs">
                                            {[
                                                moderationCase.policyReference,
                                                moderationCase.expiresAt !== null &&
                                                    `Expires ${formatModerationDate(moderationCase.expiresAt)}`
                                            ]
                                                .filter(Boolean)
                                                .join(" · ")}
                                        </p>
                                    </Card>

                                    {isStrike && (
                                        <div className="mt-5 flex flex-col items-center gap-2">
                                            <StrikeMeter
                                                active={current.activeStrikes}
                                                limit={current.strikeLimit}
                                            />
                                            <p className="text-muted-foreground text-xs">
                                                {getRemainingStrikesCopy(
                                                    current.activeStrikes,
                                                    current.strikeLimit
                                                )}
                                            </p>
                                        </div>
                                    )}
                                </CardContent>

                                <CardFooter className="flex flex-col-reverse gap-2 border-t-2 px-4 pt-4 sm:flex-row sm:justify-between sm:px-6">
                                    <Button
                                        asChild
                                        variant="secondary"
                                        onClick={onAcknowledge}
                                        className="h-8 gap-2 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm"
                                    >
                                        <Link to="/settings/safety">
                                            {moderationCase.canAppeal ? "Appeal" : "View in Safety"}
                                        </Link>
                                    </Button>
                                    <Button
                                        onClick={onAcknowledge}
                                        className="h-8 gap-2 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm"
                                    >
                                        I understand
                                        <ChevronRight className="size-3 sm:size-4" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    </MotionConfig>
                )}
            </DialogContent>
        </Dialog>
    )
}
