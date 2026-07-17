"use client"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Link } from "@tanstack/react-router"
import { ArrowRight, CreditCard, Sparkles } from "lucide-react"
import { MotionConfig, motion } from "motion/react"

interface PastDueRenewalDialogProps {
    isOpen: boolean
    renewalUrl?: string
    onDismiss: () => void
}

export function PastDueRenewalDialog({ isOpen, renewalUrl, onDismiss }: PastDueRenewalDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onDismiss()}>
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
                                    <div className="-right-2 -bottom-2 absolute grid size-9 place-items-center rounded-lg border-2 border-card bg-destructive text-destructive-foreground shadow-sm">
                                        <CreditCard className="size-4" />
                                    </div>
                                </div>

                                <div className="max-w-md space-y-2">
                                    <DialogTitle className="font-bold text-2xl text-foreground tracking-tight">
                                        Your Pro access is paused
                                    </DialogTitle>
                                    <DialogDescription className="text-sm leading-relaxed">
                                        Oops, we couldn&apos;t renew your subscription. Review your
                                        payment details to restore access to premium models and
                                        features.
                                    </DialogDescription>
                                </div>
                            </CardContent>

                            <CardFooter className="flex flex-col-reverse gap-2 border-t-2 px-4 pt-4 sm:flex-row sm:justify-between sm:px-6">
                                <Button
                                    variant="secondary"
                                    onClick={onDismiss}
                                    className="h-8 gap-2 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm"
                                >
                                    Not now
                                </Button>
                                <Button
                                    asChild
                                    onClick={onDismiss}
                                    className="h-8 gap-2 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm"
                                >
                                    {renewalUrl ? (
                                        <a href={renewalUrl} target="_blank" rel="noreferrer">
                                            Renew subscription
                                            <Sparkles className="size-3 sm:size-4" />
                                        </a>
                                    ) : (
                                        <Link to="/settings/billing">
                                            Renew subscription
                                            <ArrowRight className="size-3 sm:size-4" />
                                        </Link>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    </motion.div>
                </MotionConfig>
            </DialogContent>
        </Dialog>
    )
}
