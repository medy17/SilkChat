import {
    COMPUTER_STATE_LABELS,
    COMPUTER_STATE_TONES,
    ComputerStatusMark
} from "@/components/computer-ui"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { api } from "@/convex/_generated/api"
import { Link } from "@tanstack/react-router"
import { useAction, useQuery } from "convex/react"
import { useState } from "react"
import { toast } from "sonner"

const AWAKE_STATES = new Set(["setting_up", "awake", "working", "stuck", "busy"])

/** Only appears while the computer is awake, so the composer stays quiet the rest of the time. */
export function ComputerComposerControl({ enabled }: { enabled: boolean }) {
    const computer = useQuery(api.computers.getMyComputer, enabled ? {} : "skip")
    const sleep = useAction(api.computers_node.sleepMyComputer)
    const restart = useAction(api.computers_node.restartMyComputer)
    const [acting, setActing] = useState(false)

    if (!computer || !AWAKE_STATES.has(computer.state)) return null

    const act = async (run: () => Promise<unknown>) => {
        setActing(true)
        try {
            await run()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Something went wrong")
        } finally {
            setActing(false)
        }
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 min-w-0 shrink gap-2 rounded-[var(--radius-md)] bg-glass-control hover:bg-glass-control-hover"
                    aria-label={`${computer.name}: ${COMPUTER_STATE_LABELS[computer.state]}`}
                >
                    <ComputerStatusMark tone={COMPUTER_STATE_TONES[computer.state]} />
                    <span className="@4xl:inline hidden max-w-40 truncate">{computer.name}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 space-y-3">
                <div className="space-y-1">
                    <p className="truncate font-medium text-sm">{computer.name}</p>
                    <p className="flex items-center gap-2 text-muted-foreground text-xs">
                        <ComputerStatusMark tone={COMPUTER_STATE_TONES[computer.state]} />
                        {COMPUTER_STATE_LABELS[computer.state]}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {(computer.state === "awake" || computer.state === "working") && (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-[var(--radius-md)]"
                            disabled={acting}
                            onClick={() => void act(() => sleep({}))}
                        >
                            Put to sleep
                        </Button>
                    )}
                    {computer.state === "stuck" && (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-[var(--radius-md)]"
                            disabled={acting}
                            onClick={() => void act(() => restart({}))}
                        >
                            Restart
                        </Button>
                    )}
                    <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="rounded-[var(--radius-md)]"
                    >
                        <Link to="/settings/computer">Manage</Link>
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
