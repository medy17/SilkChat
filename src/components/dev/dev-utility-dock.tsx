import { useThemeAuditResultStore } from "@/components/dev/dev-runtime"
import { LogoSymbol } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSession } from "@/hooks/auth-hooks"
import { optionalBrowserEnv } from "@/lib/browser-env"
import { RING_TONE_CLASSES } from "@/components/context-usage-ring"
import {
    CONTEXT_RING_TONES,
    type ContextRingLevel,
    type ContextRingTone,
    type ContextRingVisibility,
    DEFAULT_CONTEXT_RING_LEVELS
} from "@/lib/composer-context"
import { useAreDevOverridesActive, useDevOverridesStore } from "@/lib/dev-overrides"
import { serializeReproBundle, useReproRecorderStore } from "@/lib/dev-repro-recorder"
import {
    useComposerContextDiagnosticsStore,
    useThreadDiagnosticsStore
} from "@/lib/dev-thread-diagnostics"
import {
    type DevDockCorner,
    type DevStorageScope,
    canUseDevTools,
    clearDevStorageScope,
    getDevStorageKeysForScope,
    useDevToolsStore
} from "@/lib/dev-tools"
import {
    LOCAL_IMAGE_OPTIMIZER_PURGE_PATH,
    isLocalImageOptimizerEnabled
} from "@/lib/local-image-optimizer"
import { useModelStore } from "@/lib/model-store"
import { cn } from "@/lib/utils"
import { useLocation, useParams } from "@tanstack/react-router"
import {
    Bug,
    Circle,
    Copy,
    Database,
    FileText,
    Gavel,
    ImageOff,
    Plus,
    RefreshCcw,
    ScanEye,
    Wrench,
    X
} from "lucide-react"
import {
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent,
    Suspense,
    lazy,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import { toast } from "sonner"

// Each tool opens in its own dialog and loads on first use, so none of them weigh on the app.
const ExportBuilderDialog = lazy(() =>
    import("@/components/dev/export-builder-dialog").then((module) => ({
        default: module.ExportBuilderDialog
    }))
)
const ModerationSeedDialog = lazy(() =>
    import("@/components/dev/moderation-seed-dialog").then((module) => ({
        default: module.ModerationSeedDialog
    }))
)

type DevDialog = "export-builder" | "moderation-seed"

const DEV_DIALOGS: Array<{ id: DevDialog; label: string; icon: typeof FileText }> = [
    { id: "export-builder", label: "Export builder", icon: FileText },
    { id: "moderation-seed", label: "Moderation seed", icon: Gavel }
]

type CreditDevState = {
    account?: {
        plan?: "free" | "pro"
    }
    access?: {
        isStaff?: boolean
        bypassLimits?: boolean
        bypassToolCallLimits?: boolean
    }
}

const storageActions: Array<{ scope: DevStorageScope; label: string }> = [
    { scope: "convex", label: "Convex cache" },
    { scope: "model", label: "Model prefs" },
    { scope: "theme", label: "Theme" },
    { scope: "credits", label: "Credit cache" },
    { scope: "library", label: "Library state" },
    { scope: "all-app-state", label: "All app state" }
]

const getStorageCount = (scope: DevStorageScope) => {
    if (typeof window === "undefined") return 0
    return getDevStorageKeysForScope(window.localStorage, scope).length
}

// Floating trigger geometry. The dock rests against one of the four viewport
// corners; a drag projects the release velocity to the nearest corner and springs
// to it, matching the feel of the Next.js dev tools indicator.
const DOCK_EDGE_MARGIN = 16
const DOCK_DRAG_THRESHOLD = 5
const DOCK_SNAP_DURATION_MS = 491.22
// Spring easing generated from https://www.easing.dev/spring (same curve Next.js uses).
const DOCK_SNAP_EASING =
    "linear(0 0%, 0.005871 1%, 0.022058 2%, 0.046612 3%, 0.077823 4%, 0.114199 5%, 0.154441 6%, 0.197431 7.000000000000001%, 0.242208 8%, 0.287959 9%, 0.333995 10%, 0.379743 11%, 0.424732 12%, 0.46858 13%, 0.510982 14.000000000000002%, 0.551702 15%, 0.590564 16%, 0.627445 17%, 0.662261 18%, 0.694971 19%, 0.725561 20%, 0.754047 21%, 0.780462 22%, 0.804861 23%, 0.82731 24%, 0.847888 25%, 0.866679 26%, 0.883775 27%, 0.899272 28.000000000000004%, 0.913267 28.999999999999996%, 0.925856 30%, 0.937137 31%, 0.947205 32%, 0.956153 33%, 0.96407 34%, 0.971043 35%, 0.977153 36%, 0.982479 37%, 0.987094 38%, 0.991066 39%, 0.994462 40%, 0.997339 41%, 0.999755 42%, 1.001761 43%, 1.003404 44%, 1.004727 45%, 1.00577 46%, 1.006569 47%, 1.007157 48%, 1.007563 49%, 1.007813 50%, 1.007931 51%, 1.007939 52%, 1.007855 53%, 1.007697 54%, 1.007477 55.00000000000001%, 1.00721 56.00000000000001%, 1.006907 56.99999999999999%, 1.006576 57.99999999999999%, 1.006228 59%, 1.005868 60%, 1.005503 61%, 1.005137 62%, 1.004776 63%, 1.004422 64%, 1.004078 65%, 1.003746 66%, 1.003429 67%, 1.003127 68%, 1.00284 69%, 1.002571 70%, 1.002318 71%, 1.002082 72%, 1.001863 73%, 1.00166 74%, 1.001473 75%, 1.001301 76%, 1.001143 77%, 1.001 78%, 1.000869 79%, 1.000752 80%, 1.000645 81%, 1.00055 82%, 1.000464 83%, 1.000388 84%, 1.000321 85%, 1.000261 86%, 1.000209 87%, 1.000163 88%, 1.000123 89%, 1.000088 90%)"

const DOCK_CORNERS: DevDockCorner[] = ["top-left", "top-right", "bottom-left", "bottom-right"]

type DockPoint = { x: number; y: number }

const cornerAnchorStyle = (corner: DevDockCorner): CSSProperties => {
    const [vertical, horizontal] = corner.split("-") as ["top" | "bottom", "left" | "right"]
    return {
        [vertical]: DOCK_EDGE_MARGIN,
        [horizontal]: DOCK_EDGE_MARGIN,
        [vertical === "top" ? "bottom" : "top"]: "auto",
        [horizontal === "left" ? "right" : "left"]: "auto"
    }
}

// iOS-style momentum projection: where a flick with this velocity would settle.
const projectVelocity = (velocity: number, decay = 0.999) =>
    ((velocity / 1000) * decay) / (1 - decay)

// The four corner destinations expressed as translate() deltas from the element's
// current corner anchor. Padding cancels out, so left/top corners map to 0 and
// right/bottom corners to the far edge minus the trigger size.
const getCornerTranslations = (
    el: HTMLElement,
    current: DevDockCorner
): Record<DevDockCorner, DockPoint> => {
    const offset = DOCK_EDGE_MARGIN * 2
    const width = el.offsetWidth
    const height = el.offsetHeight
    const scrollbar = window.innerWidth - document.documentElement.clientWidth

    const absolute = (corner: DevDockCorner): DockPoint => ({
        x: corner.includes("right") ? window.innerWidth - scrollbar - offset - width : 0,
        y: corner.includes("bottom") ? window.innerHeight - offset - height : 0
    })

    const base = absolute(current)
    const rel = (point: DockPoint): DockPoint => ({ x: point.x - base.x, y: point.y - base.y })

    return {
        "top-left": rel(absolute("top-left")),
        "top-right": rel(absolute("top-right")),
        "bottom-left": rel(absolute("bottom-left")),
        "bottom-right": rel(absolute("bottom-right"))
    }
}

const getNearestCorner = (
    target: DockPoint,
    translations: Record<DevDockCorner, DockPoint>
): DevDockCorner => {
    let nearest: DevDockCorner = "bottom-right"
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const corner of DOCK_CORNERS) {
        const translation = translations[corner]
        const distance = (target.x - translation.x) ** 2 + (target.y - translation.y) ** 2
        if (distance < nearestDistance) {
            nearestDistance = distance
            nearest = corner
        }
    }
    return nearest
}

const calculateDockVelocity = (
    history: Array<{ position: DockPoint; timestamp: number }>
): DockPoint => {
    if (history.length < 2) return { x: 0, y: 0 }
    const first = history[0]
    const last = history[history.length - 1]
    const dt = last.timestamp - first.timestamp
    if (dt === 0) return { x: 0, y: 0 }
    return {
        x: ((last.position.x - first.position.x) / dt) * 1000,
        y: ((last.position.y - first.position.y) / dt) * 1000
    }
}

/**
 * Pointer-driven drag for the floating dock. Movement is written straight to the
 * element's `translate` (GPU-composited, no layout, no per-frame React/persist
 * churn); on release it projects the flick to the nearest corner, springs there,
 * then commits the corner exactly once.
 */
function useDockCornerDrag({
    corner,
    disabled,
    onCommit
}: {
    corner: DevDockCorner
    disabled: boolean
    onCommit: (corner: DevDockCorner) => void
}) {
    const ref = useRef<HTMLDivElement>(null)
    const didDragRef = useRef(false)
    const stateRef = useRef<"idle" | "press" | "drag" | "drag-end">("idle")
    const originRef = useRef<DockPoint>({ x: 0, y: 0 })
    const translationRef = useRef<DockPoint>({ x: 0, y: 0 })
    const pointerIdRef = useRef<number | null>(null)
    const velocitiesRef = useRef<Array<{ position: DockPoint; timestamp: number }>>([])
    const lastSampleRef = useRef(0)
    // Tears down an in-flight snap animation so a re-grab mid-spring tracks instantly.
    const cancelSnapRef = useRef<(() => void) | null>(null)

    const applyTranslate = (point: DockPoint) => {
        const el = ref.current
        if (!el) return
        translationRef.current = point
        el.style.translate = `${point.x}px ${point.y}px`
    }

    const snapToNearestCorner = (startCorner: DevDockCorner, velocity: DockPoint) => {
        const el = ref.current
        if (!el) {
            stateRef.current = "idle"
            return
        }
        const translation = translationRef.current
        if (translation.x === 0 && translation.y === 0) {
            el.style.removeProperty("translate")
            stateRef.current = "idle"
            return
        }

        const projected = {
            x: translation.x + projectVelocity(velocity.x),
            y: translation.y + projectVelocity(velocity.y)
        }
        const translations = getCornerTranslations(el, startCorner)
        const target = getNearestCorner(projected, translations)

        const handleTransitionEnd = (event: TransitionEvent) => {
            if (event.propertyName !== "translate") return
            el.removeEventListener("transitionend", handleTransitionEnd)
            cancelSnapRef.current = null
            el.style.transition = ""
            translationRef.current = { x: 0, y: 0 }
            // Clear the translate and re-anchor to the new corner in the same task
            // so the element stays visually put (no flash back to the old corner).
            setTimeout(() => {
                el.style.removeProperty("translate")
                stateRef.current = "idle"
                onCommit(target)
            })
        }

        cancelSnapRef.current = () => {
            el.removeEventListener("transitionend", handleTransitionEnd)
            // Freeze at the current interpolated position (read before clearing the
            // transition, which would otherwise snap straight to the target) so a
            // re-grab continues from where the spring was, not from its destination.
            const computed = getComputedStyle(el).translate
            el.style.transition = ""
            const [rawX, rawY] = computed.split(" ")
            const x = Number.parseFloat(rawX ?? "")
            if (!Number.isNaN(x)) {
                const y = Number.parseFloat(rawY ?? "")
                applyTranslate({ x, y: Number.isNaN(y) ? 0 : y })
            }
        }
        el.addEventListener("transitionend", handleTransitionEnd)
        el.style.transition = `translate ${DOCK_SNAP_DURATION_MS}ms ${DOCK_SNAP_EASING}`
        applyTranslate(translations[target])
    }

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (disabled || event.button !== 0) return

        // Cancel any spring still running from a previous release before re-grabbing.
        cancelSnapRef.current?.()
        cancelSnapRef.current = null

        const startCorner = corner
        originRef.current = { x: event.clientX, y: event.clientY }
        stateRef.current = "press"
        didDragRef.current = false
        velocitiesRef.current = []

        const handlePointerMove = (moveEvent: PointerEvent) => {
            if (stateRef.current === "press") {
                const dx = moveEvent.clientX - originRef.current.x
                const dy = moveEvent.clientY - originRef.current.y
                if (Math.hypot(dx, dy) < DOCK_DRAG_THRESHOLD) return
                stateRef.current = "drag"
                didDragRef.current = true
                pointerIdRef.current = moveEvent.pointerId
                ref.current?.setPointerCapture(moveEvent.pointerId)
                document.body.style.userSelect = "none"
            }
            if (stateRef.current !== "drag") return

            const current = { x: moveEvent.clientX, y: moveEvent.clientY }
            const dx = current.x - originRef.current.x
            const dy = current.y - originRef.current.y
            originRef.current = current
            applyTranslate({
                x: translationRef.current.x + dx,
                y: translationRef.current.y + dy
            })

            // Sample recent positions (>=10ms apart, last few) for release velocity.
            const now = Date.now()
            if (now - lastSampleRef.current >= 10) {
                velocitiesRef.current = [
                    ...velocitiesRef.current.slice(-5),
                    { position: current, timestamp: now }
                ]
            }
            lastSampleRef.current = now
        }

        const handlePointerUp = () => {
            window.removeEventListener("pointermove", handlePointerMove)
            window.removeEventListener("pointerup", handlePointerUp)
            document.body.style.removeProperty("user-select")
            if (pointerIdRef.current !== null) {
                ref.current?.releasePointerCapture(pointerIdRef.current)
                pointerIdRef.current = null
            }
            if (stateRef.current !== "drag") {
                stateRef.current = "idle"
                return
            }
            stateRef.current = "drag-end"
            const velocity = calculateDockVelocity(velocitiesRef.current)
            velocitiesRef.current = []
            snapToNearestCorner(startCorner, velocity)
        }

        window.addEventListener("pointermove", handlePointerMove)
        window.addEventListener("pointerup", handlePointerUp)
    }

    return { ref, didDragRef, handlePointerDown }
}

export function DevUtilityDock() {
    const mode = useDevToolsStore((state) => state.mode)
    const setMode = useDevToolsStore((state) => state.setMode)
    const showUtilityDock = useDevToolsStore((state) => state.showUtilityDock)
    const showContextualDevTools = useDevToolsStore((state) => state.showContextualDevTools)
    const setShowContextualDevTools = useDevToolsStore((state) => state.setShowContextualDevTools)
    const dockCorner = useDevToolsStore((state) => state.dockCorner)
    const setDockCorner = useDevToolsStore((state) => state.setDockCorner)
    const overridesActive = useAreDevOverridesActive()
    const disableAnimations = useDevOverridesStore((state) => state.disableAnimations)
    const setDisableAnimations = useDevOverridesStore((state) => state.setDisableAnimations)
    const rawMarkdown = useDevOverridesStore((state) => state.rawMarkdown)
    const setRawMarkdown = useDevOverridesStore((state) => state.setRawMarkdown)
    const themeAudit = useDevOverridesStore((state) => state.themeAudit)
    const setThemeAudit = useDevOverridesStore((state) => state.setThemeAudit)
    const hostedContextLimitOverride = useDevOverridesStore(
        (state) => state.hostedContextLimitOverride
    )
    const setHostedContextLimitOverride = useDevOverridesStore(
        (state) => state.setHostedContextLimitOverride
    )
    const modelContextLimitOverride = useDevOverridesStore(
        (state) => state.modelContextLimitOverride
    )
    const setModelContextLimitOverride = useDevOverridesStore(
        (state) => state.setModelContextLimitOverride
    )
    const auditResult = useThemeAuditResultStore((state) => state.result)
    const threadDiagnostics = useThreadDiagnosticsStore((state) => state.diagnostics)
    const recording = useReproRecorderStore((state) => state.recording)
    const setRecording = useReproRecorderStore((state) => state.setRecording)
    const reproEvents = useReproRecorderStore((state) => state.events)
    const clearReproEvents = useReproRecorderStore((state) => state.clear)
    const selectedModel = useModelStore((state) => state.selectedModel)
    const { data: session } = useSession()
    const location = useLocation()
    const params = useParams({ strict: false }) as { threadId?: string }
    const [creditState, setCreditState] = useState<CreditDevState | null>(null)
    const [storageVersion, setStorageVersion] = useState(0)
    const [section, setSection] = useState<"tools" | "cache" | "info" | "repro">("tools")
    const [open, setOpen] = useState(false)
    const [dialog, setDialog] = useState<DevDialog | null>(null)
    // Stays mounted after closing so a dialog can animate out and keeps its state.
    const [loadedDialogs, setLoadedDialogs] = useState<DevDialog[]>([])
    const openDialog = (id: DevDialog) => {
        setOpen(false)
        setLoadedDialogs((loaded) => (loaded.includes(id) ? loaded : [...loaded, id]))
        setDialog(id)
    }
    const dialogProps = (id: DevDialog) => ({
        open: dialog === id,
        onOpenChange: (next: boolean) => setDialog(next ? id : null)
    })
    // Drag is disabled while the popover is open so the trigger and panel never desync.
    const {
        ref: wrapperRef,
        didDragRef,
        handlePointerDown: handleDockPointerDown
    } = useDockCornerDrag({ corner: dockCorner, disabled: open, onCommit: setDockCorner })

    useEffect(() => {
        if (!canUseDevTools()) return

        let cancelled = false
        const loadCreditState = async () => {
            try {
                const response = await fetch("/api/dev/credit-state", {
                    cache: "no-store"
                })
                if (!response.ok) return
                const data = (await response.json()) as CreditDevState
                if (!cancelled) {
                    setCreditState(data)
                }
            } catch {}
        }

        void loadCreditState()
        return () => {
            cancelled = true
        }
    }, [])

    const diagnostics = useMemo(
        () => ({
            route: location.pathname,
            threadId: params.threadId ?? null,
            userId: session?.user?.id ?? null,
            model: selectedModel,
            plan: creditState?.account?.plan ?? null,
            isStaff: creditState?.access?.isStaff ?? false,
            bypassLimits: creditState?.access?.bypassLimits ?? false,
            bypassToolCallLimits: creditState?.access?.bypassToolCallLimits ?? false,
            convexUrl: optionalBrowserEnv("VITE_CONVEX_URL") ?? null,
            convexApiUrl: optionalBrowserEnv("VITE_CONVEX_API_URL") ?? null,
            localImageOptimizer: optionalBrowserEnv("VITE_LOCAL_IMAGE_OPTIMIZER_ENABLED") === "1"
        }),
        [
            creditState?.access?.bypassLimits,
            creditState?.access?.bypassToolCallLimits,
            creditState?.access?.isStaff,
            creditState?.account?.plan,
            location.pathname,
            params.threadId,
            selectedModel,
            session?.user?.id
        ]
    )

    if (!canUseDevTools() || !showUtilityDock) {
        return null
    }

    // Swallow the click that follows a drag so the popover doesn't open on drop.
    const handleDockClickCapture = (event: ReactMouseEvent) => {
        if (didDragRef.current) {
            event.preventDefault()
            event.stopPropagation()
            didDragRef.current = false
        }
    }

    const handleClearStorage = (scope: DevStorageScope) => {
        const clearedKeys = clearDevStorageScope(window.localStorage, scope)
        setStorageVersion((version) => version + 1)
        toast.success(
            clearedKeys.length === 1 ? "Cleared 1 key" : `Cleared ${clearedKeys.length} keys`
        )
    }

    const handleCopyDebugBundle = async () => {
        await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2))
        toast.success("Copied debug bundle")
    }

    const handleExportRepro = async () => {
        const bundle = serializeReproBundle(reproEvents, diagnostics)
        await navigator.clipboard.writeText(bundle)
        toast.success(`Copied repro bundle (${reproEvents.length} events)`)
    }

    const handlePurgeOptimizerCache = async () => {
        try {
            const response = await fetch(LOCAL_IMAGE_OPTIMIZER_PURGE_PATH, {
                method: "DELETE",
                cache: "no-store"
            })
            if (!response.ok) throw new Error("Purge failed")
            const data = (await response.json()) as { removed?: number }
            toast.success(`Purged optimizer cache (${data.removed ?? 0} files)`)
        } catch {
            toast.error("Optimizer cache purge failed")
        }
    }

    const [dockVertical, dockHorizontal] = dockCorner.split("-") as [
        "top" | "bottom",
        "left" | "right"
    ]

    return (
        <>
            <div
                ref={wrapperRef}
                className="pointer-events-auto fixed z-[80] touch-none"
                style={cornerAnchorStyle(dockCorner)}
                data-dev-audit-ignore
                onClickCapture={handleDockClickCapture}
                onPointerDown={handleDockPointerDown}
            >
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            size="icon"
                            variant={mode === "dev" ? "default" : "secondary"}
                            className="size-10 cursor-grab overflow-hidden rounded-[var(--radius-xl)] p-0 shadow-lg active:cursor-grabbing"
                            aria-label="Open dev utility dock (drag to move)"
                        >
                            {mode === "dev" ? (
                                <img
                                    src="/dev_logo.png"
                                    alt=""
                                    draggable={false}
                                    className="size-full object-cover"
                                />
                            ) : (
                                <span className="flex size-full items-center justify-center">
                                    <LogoSymbol className="size-6" />
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        side={dockVertical === "top" ? "bottom" : "top"}
                        align={dockHorizontal === "left" ? "start" : "end"}
                        sideOffset={8}
                        data-dev-audit-ignore
                        className="max-h-[80vh] w-80 overflow-y-auto rounded-[var(--radius-xl)] p-3"
                    >
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-medium text-sm">Dev Utility Dock</p>
                                    <p className="text-muted-foreground text-xs">
                                        Local utilities and diagnostics
                                    </p>
                                </div>
                                <Tabs
                                    value={mode}
                                    onValueChange={(value) => setMode(value as typeof mode)}
                                >
                                    <TabsList className="h-8">
                                        <TabsTrigger value="user" className="px-3 text-xs">
                                            User
                                        </TabsTrigger>
                                        <TabsTrigger value="dev" className="px-3 text-xs">
                                            Dev
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>

                            <Tabs
                                value={section}
                                onValueChange={(value) => setSection(value as typeof section)}
                            >
                                <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="tools" className="gap-1 px-1 text-xs">
                                        <Wrench className="size-3.5" />
                                        Tools
                                    </TabsTrigger>
                                    <TabsTrigger value="cache" className="gap-1 px-1 text-xs">
                                        <Database className="size-3.5" />
                                        Cache
                                    </TabsTrigger>
                                    <TabsTrigger value="info" className="gap-1 px-1 text-xs">
                                        <ScanEye className="size-3.5" />
                                        Info
                                    </TabsTrigger>
                                    <TabsTrigger value="repro" className="gap-1 px-1 text-xs">
                                        <Bug className="size-3.5" />
                                        Repro
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent
                                    value="tools"
                                    className="mt-3 h-[22rem] flex-none space-y-2 overflow-y-auto pr-1"
                                >
                                    <div className="grid grid-cols-2 gap-2">
                                        {DEV_DIALOGS.map(({ id, label, icon: Icon }) => (
                                            <Button
                                                key={id}
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="justify-start rounded-[var(--radius-md)] text-xs"
                                                onClick={() => openDialog(id)}
                                            >
                                                <Icon className="size-3.5" />
                                                {label}
                                            </Button>
                                        ))}
                                    </div>

                                    <div className="flex items-center justify-between rounded-[var(--radius-lg)] border p-3">
                                        <div className="space-y-0.5">
                                            <p className="font-medium text-xs">
                                                Contextual dev controls
                                            </p>
                                            <p className="text-muted-foreground text-xs">
                                                Show controls in their workflows
                                            </p>
                                        </div>
                                        <Switch
                                            checked={showContextualDevTools}
                                            onCheckedChange={setShowContextualDevTools}
                                            disabled={mode !== "dev"}
                                        />
                                    </div>

                                    <div className="space-y-2 rounded-[var(--radius-lg)] border p-2">
                                        <DevToggleRow
                                            label="Disable animations"
                                            hint="Kill CSS + motion transitions"
                                            checked={disableAnimations}
                                            disabled={!overridesActive}
                                            onCheckedChange={setDisableAnimations}
                                        />
                                        <DevToggleRow
                                            label="Raw markdown"
                                            hint="Show message source, no rendering"
                                            checked={rawMarkdown}
                                            disabled={!overridesActive}
                                            onCheckedChange={setRawMarkdown}
                                        />
                                        <DevToggleRow
                                            label="Theme audit"
                                            hint={
                                                auditResult
                                                    ? `${auditResult.elements} el · ${auditResult.radius} radius · ${auditResult.color} color`
                                                    : "Flag hardcoded radius/color"
                                            }
                                            checked={themeAudit}
                                            disabled={!overridesActive}
                                            onCheckedChange={setThemeAudit}
                                        />
                                        <div className="space-y-1 border-t pt-2">
                                            <p className="font-medium text-xs">
                                                Context limits (OTF)
                                            </p>
                                            <p className="text-muted-foreground text-xs">
                                                Tokens; blank = real limit. Applies to your next
                                                send.
                                            </p>
                                            <div className="grid grid-cols-2 gap-2 pt-1">
                                                <DevNumberField
                                                    label="Hosted"
                                                    value={hostedContextLimitOverride}
                                                    disabled={!overridesActive}
                                                    onChange={setHostedContextLimitOverride}
                                                />
                                                <DevNumberField
                                                    label="Model"
                                                    value={modelContextLimitOverride}
                                                    disabled={!overridesActive}
                                                    onChange={setModelContextLimitOverride}
                                                />
                                            </div>
                                        </div>
                                        <ContextRingDevControls disabled={!overridesActive} />
                                    </div>
                                    {!overridesActive && (
                                        <p className="text-muted-foreground text-xs">
                                            Switch to Dev mode to apply overrides.
                                        </p>
                                    )}
                                </TabsContent>

                                <TabsContent
                                    value="cache"
                                    className="mt-3 h-[22rem] flex-none space-y-2 overflow-y-auto pr-1"
                                >
                                    <div className="grid grid-cols-2 gap-2" key={storageVersion}>
                                        {storageActions.map((action) => (
                                            <Button
                                                key={action.scope}
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="justify-between rounded-[var(--radius-md)] text-xs"
                                                onClick={() => handleClearStorage(action.scope)}
                                            >
                                                {action.label}
                                                <span className="text-muted-foreground">
                                                    {getStorageCount(action.scope)}
                                                </span>
                                            </Button>
                                        ))}
                                    </div>
                                    {isLocalImageOptimizerEnabled() && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="w-full justify-start rounded-[var(--radius-md)] text-xs"
                                            onClick={() => void handlePurgeOptimizerCache()}
                                        >
                                            <ImageOff className="size-3.5" />
                                            Purge optimizer image cache
                                        </Button>
                                    )}
                                </TabsContent>

                                <TabsContent
                                    value="info"
                                    className="mt-3 h-[22rem] flex-none space-y-3 overflow-y-auto pr-1"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-xs">Diagnostics</span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 rounded-[var(--radius-md)] text-xs"
                                                onClick={() => void handleCopyDebugBundle()}
                                            >
                                                <Copy className="size-3.5" />
                                                Copy
                                            </Button>
                                        </div>
                                        <div className="space-y-1 rounded-[var(--radius-lg)] bg-muted/40 p-2 text-xs">
                                            <DiagnosticRow
                                                label="Route"
                                                value={diagnostics.route}
                                            />
                                            <DiagnosticRow
                                                label="Thread"
                                                value={diagnostics.threadId}
                                            />
                                            <DiagnosticRow
                                                label="User"
                                                value={diagnostics.userId}
                                            />
                                            <DiagnosticRow
                                                label="Model"
                                                value={diagnostics.model}
                                            />
                                            <DiagnosticRow label="Plan" value={diagnostics.plan} />
                                            <DiagnosticRow
                                                label="Access"
                                                value={[
                                                    diagnostics.isStaff ? "staff" : "not staff",
                                                    diagnostics.bypassLimits
                                                        ? "usage bypass"
                                                        : "usage limited",
                                                    diagnostics.bypassToolCallLimits
                                                        ? "tool bypass"
                                                        : "tool limited"
                                                ].join(", ")}
                                            />
                                            <DiagnosticRow
                                                label="Optimizer"
                                                value={
                                                    diagnostics.localImageOptimizer ? "on" : "off"
                                                }
                                            />
                                            <DiagnosticRow
                                                label="Ctx override"
                                                value={
                                                    hostedContextLimitOverride == null &&
                                                    modelContextLimitOverride == null
                                                        ? "off"
                                                        : `hosted ${hostedContextLimitOverride ?? "—"} / model ${
                                                              modelContextLimitOverride ?? "—"
                                                          }`
                                                }
                                            />
                                        </div>
                                    </div>

                                    {threadDiagnostics?.threadId && (
                                        <ThreadDiagnosticsSection diagnostics={threadDiagnostics} />
                                    )}
                                    <ComposerContextSection />
                                </TabsContent>

                                <TabsContent
                                    value="repro"
                                    className="mt-3 h-[22rem] flex-none space-y-2 overflow-y-auto pr-1"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-xs">Repro recorder</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground text-xs">
                                                {reproEvents.length}
                                            </span>
                                            <Switch
                                                checked={recording}
                                                onCheckedChange={setRecording}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="rounded-[var(--radius-md)] text-xs"
                                            disabled={reproEvents.length === 0}
                                            onClick={() => void handleExportRepro()}
                                        >
                                            <Copy className="size-3.5" />
                                            Export
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="rounded-[var(--radius-md)] text-xs"
                                            disabled={reproEvents.length === 0}
                                            onClick={() => clearReproEvents()}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                </TabsContent>
                            </Tabs>

                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-full rounded-[var(--radius-md)] text-xs"
                                onClick={() => window.location.reload()}
                            >
                                <RefreshCcw className="size-3.5" />
                                Reload app
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
            {/* Outside the wrapper: React events bubble through portals into its drag handlers. */}
            <Suspense fallback={null}>
                {loadedDialogs.includes("export-builder") && (
                    <ExportBuilderDialog {...dialogProps("export-builder")} />
                )}
                {loadedDialogs.includes("moderation-seed") && (
                    <ModerationSeedDialog {...dialogProps("moderation-seed")} />
                )}
            </Suspense>
        </>
    )
}

function DevToggleRow({
    label,
    hint,
    checked,
    disabled,
    onCheckedChange
}: {
    label: string
    hint: string
    checked: boolean
    disabled: boolean
    onCheckedChange: (checked: boolean) => void
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
                <p className="font-medium text-xs">{label}</p>
                <p className="text-muted-foreground text-xs">{hint}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
        </div>
    )
}

function ThreadDiagnosticsSection({
    diagnostics
}: {
    diagnostics: NonNullable<ReturnType<typeof useThreadDiagnosticsStore.getState>["diagnostics"]>
}) {
    const { persona, stats } = diagnostics
    const fmt = (value: number) => value.toLocaleString()
    const attachments = stats.attachments

    return (
        <div className="space-y-2">
            <span className="font-medium text-xs">Thread</span>
            <div className="space-y-1 rounded-[var(--radius-lg)] bg-muted/40 p-2 text-xs">
                <DiagnosticRow
                    label="Persona"
                    value={
                        persona.isPersonaThread
                            ? `${persona.name ?? "—"}${persona.kind ? ` (${persona.kind})` : ""}`
                            : "none"
                    }
                />
                {persona.isPersonaThread && (
                    <>
                        <DiagnosticRow
                            label="Persona default model"
                            value={persona.defaultModelId}
                        />
                        <DiagnosticRow label="Selected model" value={persona.currentModelId} />
                        <DiagnosticRow label="Avatar key" value={persona.avatarKey} />
                        <DiagnosticRow label="Persona id" value={persona.id} />
                    </>
                )}
                <DiagnosticRow
                    label="Attachments"
                    value={`${attachments.total} (${attachments.pdf} pdf · ${attachments.textCode} txt · ${attachments.image} img · ${attachments.other} other)`}
                />
                <DiagnosticRow
                    label="Messages"
                    value={`${stats.messages} (${stats.userMessages} user · ${stats.assistantMessages} asst)`}
                />
                <DiagnosticRow
                    label="Canonical tok"
                    value={`${fmt(stats.canonicalTotalTokens)} (${fmt(stats.canonicalInputTokens)} in · ${fmt(stats.canonicalOutputTokens)} out)`}
                />
                <DiagnosticRow
                    label="Estimator tok (excl. sys)"
                    value={`${fmt(stats.estimatorTotalTokens)} (${fmt(stats.estimatorInputTokens)} in · ${fmt(stats.estimatorOutputTokens)} out)`}
                />
                <DiagnosticRow label="Thread cost" value={`${stats.totalCostUsd.toFixed(4)}`} />
            </div>
        </div>
    )
}

function DevNumberField({
    label,
    value,
    disabled,
    onChange,
    ariaLabel = `${label} context limit override`,
    placeholder = "real",
    min = 1
}: {
    label: string
    value: number | null
    disabled: boolean
    onChange: (value: number | null) => void
    ariaLabel?: string
    placeholder?: string
    min?: number
}) {
    return (
        <div className="space-y-1">
            <span className="text-[0.625rem] text-muted-foreground">{label}</span>
            <Input
                type="number"
                min={min}
                value={value ?? ""}
                placeholder={placeholder}
                aria-label={ariaLabel}
                disabled={disabled}
                className="h-8 rounded-[var(--radius-sm)] text-xs"
                onChange={(event) => {
                    const raw = event.target.value.trim()
                    if (raw === "") {
                        onChange(null)
                        return
                    }
                    const parsed = Number.parseInt(raw, 10)
                    onChange(Number.isNaN(parsed) ? null : Math.max(min, parsed))
                }}
            />
        </div>
    )
}

function DiagnosticRow({ label, value }: { label: string; value: string | null }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className="truncate text-right">{value ?? "none"}</span>
        </div>
    )
}

function ContextRingDevControls({ disabled }: { disabled: boolean }) {
    const visibility = useDevOverridesStore((state) => state.contextRingVisibility)
    const setVisibility = useDevOverridesStore((state) => state.setContextRingVisibility)
    const showFromPercent = useDevOverridesStore((state) => state.contextRingShowFromPercent)
    const setShowFromPercent = useDevOverridesStore((state) => state.setContextRingShowFromPercent)
    const storedLevels = useDevOverridesStore((state) => state.contextRingLevels)
    const setLevels = useDevOverridesStore((state) => state.setContextRingLevels)
    const levels = storedLevels ?? DEFAULT_CONTEXT_RING_LEVELS

    const updateLevel = (index: number, patch: Partial<ContextRingLevel>) =>
        setLevels(levels.map((level, i) => (i === index ? { ...level, ...patch } : level)))
    const addLevel = () => {
        const highest = Math.max(0, ...levels.map((level) => level.fromPercent))
        setLevels([...levels, { fromPercent: highest + 10, tone: "primary" }])
    }

    return (
        <div className="space-y-2 border-t pt-2">
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <p className="font-medium text-xs">Context ring</p>
                    <p className="text-muted-foreground text-xs">
                        Composer ring visibility and tones
                    </p>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-[var(--radius-md)] text-xs"
                    disabled={disabled}
                    onClick={() => {
                        setVisibility("auto")
                        setShowFromPercent(null)
                        setLevels(null)
                    }}
                >
                    Reset
                </Button>
            </div>
            <Tabs
                value={visibility}
                onValueChange={(value) => setVisibility(value as ContextRingVisibility)}
            >
                <TabsList className="grid h-8 w-full grid-cols-3">
                    {(["auto", "always", "never"] as const).map((option) => (
                        <TabsTrigger
                            key={option}
                            value={option}
                            disabled={disabled}
                            className="px-2 text-xs capitalize"
                        >
                            {option}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            <DevNumberField
                label="Show from % (auto)"
                ariaLabel="Context ring show-from percentage"
                placeholder="75"
                min={0}
                value={showFromPercent}
                disabled={disabled || visibility !== "auto"}
                onChange={setShowFromPercent}
            />
            <div className="space-y-1">
                <span className="text-[0.625rem] text-muted-foreground">Levels (tone from %)</span>
                {levels.map((level, index) => (
                    // Levels have no identity beyond their position while being edited.
                    <div key={index} className="flex items-center gap-2">
                        <Input
                            type="number"
                            min={0}
                            value={level.fromPercent}
                            aria-label={`Level ${index + 1} start percentage`}
                            disabled={disabled}
                            className="h-8 w-20 rounded-[var(--radius-sm)] text-xs"
                            onChange={(event) => {
                                const parsed = Number.parseInt(event.target.value, 10)
                                if (!Number.isNaN(parsed)) {
                                    updateLevel(index, { fromPercent: Math.max(0, parsed) })
                                }
                            }}
                        />
                        <Select
                            value={level.tone}
                            disabled={disabled}
                            onValueChange={(tone) =>
                                updateLevel(index, { tone: tone as ContextRingTone })
                            }
                        >
                            <SelectTrigger
                                size="sm"
                                aria-label={`Level ${index + 1} tone`}
                                className="h-8 flex-1 text-xs"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CONTEXT_RING_TONES.map((tone) => (
                                    <SelectItem key={tone} value={tone} className="text-xs">
                                        <Circle
                                            className={cn(
                                                "size-2.5 fill-current",
                                                RING_TONE_CLASSES[tone]
                                            )}
                                        />
                                        {tone}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove level ${index + 1}`}
                            disabled={disabled || levels.length <= 1}
                            className="size-8 shrink-0"
                            style={{ borderRadius: "var(--radius-md)" }}
                            onClick={() => setLevels(levels.filter((_, i) => i !== index))}
                        >
                            <X className="size-3.5" />
                        </Button>
                    </div>
                ))}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full rounded-[var(--radius-md)] text-xs"
                    disabled={disabled}
                    onClick={addLevel}
                >
                    <Plus className="size-3.5" />
                    Add level
                </Button>
            </div>
        </div>
    )
}

function ComposerContextSection() {
    const diagnostics = useComposerContextDiagnosticsStore((state) => state.diagnostics)
    if (!diagnostics) return null

    const { usage, limitTokens, limitKind, overrideActive } = diagnostics
    const fmt = (value: number) => Math.round(value).toLocaleString()
    const percent = limitTokens > 0 ? Math.round((usage.usedTokens / limitTokens) * 100) : 0
    const anchor = usage.anchor

    return (
        <div className="space-y-2">
            <span className="font-medium text-xs">Composer context</span>
            <div className="space-y-1 rounded-[var(--radius-lg)] bg-muted/40 p-2 text-xs">
                <DiagnosticRow
                    label="Next send"
                    value={`${fmt(usage.usedTokens)} / ${fmt(limitTokens)} · ${percent}%${
                        overrideActive ? " · OTF" : ""
                    }`}
                />
                <DiagnosticRow
                    label="Limit"
                    value={limitKind === "model" ? "model window" : "hosted cap"}
                />
                <DiagnosticRow label="Tokenizer" value={usage.family} />
                <DiagnosticRow
                    label="Counted from"
                    value={
                        anchor
                            ? `${anchor.modelId} · real ${fmt(anchor.realTokens)}${
                                  anchor.family === usage.family
                                      ? ""
                                      : ` → ${fmt(anchor.tokens)} (${anchor.family}→${usage.family})`
                              }`
                            : "estimate (no anchor)"
                    }
                />
                <DiagnosticRow
                    label="Estimated on top"
                    value={
                        anchor
                            ? `${fmt(anchor.tailTokens)} tail · ${fmt(usage.draftTokens)} draft`
                            : `${fmt(usage.draftTokens)} draft`
                    }
                />
            </div>
        </div>
    )
}
