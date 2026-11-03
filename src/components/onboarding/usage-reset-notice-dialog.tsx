"use client"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { UsageResetEffect } from "@/convex/lib/usage_resets"
import { RotateCcw } from "lucide-react"
import { MotionConfig, motion } from "motion/react"
import { useRef } from "react"

export type UsageResetNotice = UsageResetEffect & { createdAt: number }

const describeNotice = (notice: UsageResetEffect) => {
    if (notice.window === "five_hour") return "Your 5-hour limit is full again."
    if (notice.window === "weekly") {
        return notice.includesFiveHour
            ? "Up to a quarter of your monthly limit is back, and your 5-hour limit is full again."
            : "Up to a quarter of your monthly limit is back."
    }
    return notice.includesFiveHour
        ? "Your monthly and 5-hour limits are full again."
        : "Your monthly limit is full again."
}

export function UsageResetNoticeDialog({
    notice,
    onDismiss
}: {
    notice: UsageResetNotice | null
    onDismiss: () => void
}) {
    // Keep the text while the dialog fades out.
    const shownNotice = useRef(notice)
    if (notice) shownNotice.current = notice

    return (
        <Dialog open={notice !== null} onOpenChange={(open) => !open && onDismiss()}>
            <DialogContent
                className="w-[95vw] max-w-2xl border-0 bg-transparent p-0 shadow-none sm:w-full"
                showCloseButton={false}
            >
                <MotionConfig transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}>
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                        <Card className="inset-shadow-sm w-full max-w-none overflow-hidden border-2 bg-card pt-3 pb-5">
                            <CardContent className="flex flex-col items-center px-4 py-6 text-center sm:px-6 sm:py-8">
                                <div className="relative mb-5 grid h-24 w-24 place-items-center rounded-full border-2 border-primary/20">
                                    <Logo />
                                    <div className="absolute -right-2 -bottom-2 grid size-9 place-items-center rounded-[var(--radius-lg)] border-2 border-card bg-primary text-primary-foreground shadow-sm">
                                        <RotateCcw className="size-4" />
                                    </div>
                                </div>

                                <div className="max-w-md space-y-2">
                                    <DialogTitle className="font-bold text-2xl text-foreground tracking-tight">
                                        Your usage has been reset
                                    </DialogTitle>
                                    <DialogDescription className="text-sm leading-relaxed">
                                        {shownNotice.current
                                            ? describeNotice(shownNotice.current)
                                            : null}
                                    </DialogDescription>
                                </div>
                            </CardContent>

                            <CardFooter className="flex justify-end border-t-2 px-4 pt-4 sm:px-6">
                                <Button
                                    onClick={onDismiss}
                                    className="h-8 gap-2 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm"
                                >
                                    Got it
                                </Button>
                            </CardFooter>
                        </Card>
                    </motion.div>
                </MotionConfig>
            </DialogContent>
        </Dialog>
    )
}
