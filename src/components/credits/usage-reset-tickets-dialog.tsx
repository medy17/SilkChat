"use client"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle
} from "@/components/ui/drawer"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { resetCoversLimit } from "@/convex/lib/usage_resets"
import { useCapAlignedIcon } from "@/hooks/use-cap-aligned-icon"
import { useSession } from "@/hooks/auth-hooks"
import { useIsMobile } from "@/hooks/use-mobile"
import { readCachedResetTicketCount } from "@/hooks/use-usage-reset-ticket-count"
import { useUsageResetTicketsStore } from "@/lib/usage-reset-tickets-store"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { ConvexError } from "convex/values"
import { Loader2, Ticket } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

type ResetTicket = NonNullable<
    FunctionReturnType<typeof api.usage_resets.getMyUsageResetTickets>
>[number]

const formatExpiry = (expiresAt: number | null) =>
    expiresAt === null
        ? "Never expires"
        : `Expires ${new Intl.DateTimeFormat(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric"
          }).format(new Date(expiresAt))}`

function TicketRow({
    ticket,
    usable,
    redeeming,
    disabled,
    onRedeem
}: {
    ticket: ResetTicket
    usable: boolean
    redeeming: boolean
    disabled: boolean
    onRedeem: () => void
}) {
    const { iconRef, textRef, marginTop } = useCapAlignedIcon<HTMLParagraphElement>()

    return (
        <li className="flex items-center gap-3 rounded-[var(--radius-lg)] border p-3">
            <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <Ticket
                    ref={iconRef}
                    className="size-4 shrink-0 text-muted-foreground"
                    style={{ marginTop }}
                />
                <div className="min-w-0 flex-1">
                    <p ref={textRef} className="font-medium text-sm leading-5">
                        {ticket.label}
                    </p>
                    <p className="text-muted-foreground text-xs">
                        {ticket.canRedeem
                            ? formatExpiry(ticket.expiresAt)
                            : `Usable at ${ticket.usableAtPercent}% used`}
                    </p>
                </div>
            </div>
            <Button size="sm" disabled={!usable || disabled} onClick={onRedeem}>
                {redeeming && <Loader2 className="size-4 animate-spin" />}
                Use
            </Button>
        </li>
    )
}

function TicketList({
    tickets,
    limit,
    skeletonCount,
    impersonating,
    onRedeemed
}: {
    tickets: ResetTicket[] | null | undefined
    skeletonCount: number
    impersonating: boolean
    limit: ReturnType<typeof useUsageResetTicketsStore.getState>["limit"]
    onRedeemed: () => void
}) {
    const redeem = useMutation(api.usage_resets.redeemUsageReset)
    const [redeemingId, setRedeemingId] = useState<Id<"usageResetGrants"> | null>(null)

    if (tickets === undefined) {
        return (
            <div className="space-y-2">
                {Array.from({ length: Math.max(1, skeletonCount) }, (_, index) => (
                    <Skeleton key={index} className="h-15 w-full rounded-[var(--radius-lg)]" />
                ))}
            </div>
        )
    }
    if (!tickets?.length) {
        return <p className="text-muted-foreground text-sm">You have no Banked Resets.</p>
    }

    const handleRedeem = async (ticket: ResetTicket) => {
        setRedeemingId(ticket.id)
        try {
            const result = await redeem({ grantId: ticket.id })
            toast.success(`${result.label} used`)
            onRedeemed()
        } catch (error) {
            toast.error(
                error instanceof ConvexError && typeof error.data === "string"
                    ? error.data
                    : "Couldn't use this reset. Please try again."
            )
        } finally {
            setRedeemingId(null)
        }
    }

    return (
        <ul className="space-y-2">
            {tickets.map((ticket) => (
                <TicketRow
                    key={ticket.id}
                    ticket={ticket}
                    usable={
                        !impersonating &&
                        ticket.canRedeem &&
                        (!limit || resetCoversLimit(ticket, limit))
                    }
                    redeeming={redeemingId === ticket.id}
                    disabled={redeemingId !== null}
                    onRedeem={() => void handleRedeem(ticket)}
                />
            ))}
        </ul>
    )
}

export function UsageResetTicketsDialog() {
    const isMobile = useIsMobile()
    const session = useSession()
    // Viewing as someone mustn't spend their Banked Resets; the server refuses too.
    const impersonating = Boolean(session.data?.session.impersonatedBy)
    const open = useUsageResetTicketsStore((state) => state.open)
    const limit = useUsageResetTicketsStore((state) => state.limit)
    const hide = useUsageResetTicketsStore((state) => state.hide)
    const tickets = useQuery(api.usage_resets.getMyUsageResetTickets, open ? {} : "skip")
    const onOpenChange = (next: boolean) => {
        if (!next) hide()
    }
    const title = "Banked Resets"
    const description = "Use a Banked Reset to reset your usage now."
    const list = (
        <TicketList
            tickets={tickets}
            limit={limit}
            skeletonCount={readCachedResetTicketCount(session.user?.id)}
            impersonating={impersonating}
            onRedeemed={hide}
        />
    )

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent className="z-[70]" overlayClassName="z-[70]">
                    <DrawerHeader>
                        <DrawerTitle>{title}</DrawerTitle>
                        <DrawerDescription className="sr-only">{description}</DrawerDescription>
                    </DrawerHeader>
                    <div className="max-h-[60dvh] overflow-y-auto px-4 pb-6">{list}</div>
                </DrawerContent>
            </Drawer>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="sr-only">{description}</DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto">{list}</div>
            </DialogContent>
        </Dialog>
    )
}
