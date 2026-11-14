"use client"

import { VisualReferences } from "@/components/visual-references"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import {
    SPOTLIGHT_CARD_CLASS,
    SPOTLIGHT_ICON_BUTTON_CLASS
} from "@/components/renderers/spotlight-frame"
import {
    TIMER_CHIP_CLASS,
    TimerReadout,
    formatTimerClock
} from "@/components/renderers/spotlight-timer"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    type ParsedRecipe,
    type RecipeInlineToken,
    type RecipeMeasurementSystem,
    formatRecipeNumber,
    formatRecipeQuantity,
    getRecipeUnitSystem
} from "@/lib/recipe"
import { cn } from "@/lib/utils"
import {
    Check,
    ChefHat,
    ChevronLeft,
    ChevronRight,
    Flame,
    Minus,
    Pause,
    Play,
    Plus,
    Printer,
    RotateCcw,
    Timer,
    X
} from "lucide-react"
import {
    type Dispatch,
    Fragment,
    type ReactNode,
    type SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react"
import { toast } from "sonner"

export type TimerState = {
    total: number
    remaining: number
    running: boolean
    finished: boolean
    startedAt?: number
}

export const advanceRecipeTimer = (timer: TimerState, now = Date.now()): TimerState => {
    if (!timer.running || timer.startedAt === undefined) return timer

    const elapsedSeconds = Math.floor((now - timer.startedAt) / 1000)
    if (elapsedSeconds <= 0) return timer

    const remaining = Math.max(0, timer.remaining - elapsedSeconds)
    const finished = remaining === 0
    return {
        ...timer,
        remaining,
        running: !finished,
        finished,
        startedAt: finished ? undefined : timer.startedAt + elapsedSeconds * 1000
    }
}

const SECTION_HEADING_CLASS = "font-bold text-xl tracking-tight"
// The servings stepper sits beside the unit switch, so it takes the stock Tabs track and thumb.
const STEPPER_TRACK_CLASS =
    "inline-flex h-7 items-center rounded-[var(--radius-md)] bg-black/5 p-0.5 dark:bg-black/20"
const STEPPER_BUTTON_CLASS =
    "flex h-full w-6 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-input/30"

const UNIT_OPTIONS = [
    ["original", "Original"],
    ["metric", "Metric"],
    ["imperial", "Imperial"]
] as const

const cleanInlineText = (value: string) => value.replace(/\*\*|__/g, "")

const TimerChip = ({
    id,
    token,
    state,
    onToggle,
    onReset
}: {
    id: string
    token: Extract<RecipeInlineToken, { type: "timer" }>
    state?: TimerState
    onToggle: (id: string, duration: number) => void
    onReset: (id: string) => void
}) => {
    const label = state ? formatTimerClock(state.remaining) : token.display

    return (
        <span className="not-prose mx-1 inline-flex items-center align-baseline">
            <button
                type="button"
                data-recipe-print-timer-control
                className={cn(
                    TIMER_CHIP_CLASS,
                    "transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                aria-label={`${state?.running ? "Pause" : "Start"} ${token.display} timer`}
                onClick={() => onToggle(id, token.durationSeconds)}
            >
                {state?.running ? <Pause className="size-3" /> : <Play className="size-3" />}
                {label}
            </button>
            <span data-recipe-print-only className="hidden">
                {token.display}
            </span>
            {state && state.remaining !== state.total && (
                <button
                    type="button"
                    data-recipe-print-timer-control
                    className="ml-1 inline-flex size-6.5 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Reset ${token.display} timer`}
                    onClick={() => onReset(id)}
                >
                    <RotateCcw className="size-3" />
                </button>
            )}
        </span>
    )
}

const RecipeRichText = ({
    tokens,
    tokenPrefix,
    multiplier,
    measurementSystem,
    timers,
    onToggleTimer,
    onResetTimer
}: {
    tokens: RecipeInlineToken[]
    tokenPrefix: string
    multiplier: number
    measurementSystem?: RecipeMeasurementSystem
    timers: Record<string, TimerState>
    onToggleTimer: (id: string, duration: number) => void
    onResetTimer: (id: string) => void
}) => (
    <>
        {tokens.map((token, index) => {
            const id = `${tokenPrefix}-${index}`
            if (token.type === "quantity") {
                return (
                    <span key={id} className="font-semibold">
                        {formatRecipeQuantity(token, multiplier, measurementSystem)}
                    </span>
                )
            }
            if (token.type === "timer") {
                return (
                    <TimerChip
                        key={id}
                        id={id}
                        token={token}
                        state={timers[id]}
                        onToggle={onToggleTimer}
                        onReset={onResetTimer}
                    />
                )
            }
            return <Fragment key={id}>{cleanInlineText(token.text)}</Fragment>
        })}
    </>
)

const CookModeRichText = ({
    tokens,
    multiplier,
    measurementSystem
}: {
    tokens: RecipeInlineToken[]
    multiplier: number
    measurementSystem?: RecipeMeasurementSystem
}) => (
    <>
        {tokens.map((token, index) => {
            if (token.type === "quantity") {
                return (
                    <span key={index} className="font-semibold text-foreground">
                        {formatRecipeQuantity(token, multiplier, measurementSystem)}
                    </span>
                )
            }
            if (token.type === "timer") {
                return (
                    <span key={index} className="font-semibold text-primary">
                        {token.display}
                    </span>
                )
            }
            return <Fragment key={index}>{cleanInlineText(token.text)}</Fragment>
        })}
    </>
)

const CookModeTimer = ({
    id,
    token,
    state,
    onToggle,
    onReset
}: {
    id: string
    token: Extract<RecipeInlineToken, { type: "timer" }>
    state?: TimerState
    onToggle: (id: string, duration: number) => void
    onReset: (id: string) => void
}) => {
    const remaining = state?.remaining ?? token.durationSeconds
    const action = state?.running
        ? "Pause"
        : state?.finished
          ? "Restart"
          : state
            ? "Resume"
            : "Start"

    return (
        <div className="flex min-w-48 flex-col items-center gap-3 px-8 py-2">
            <TimerReadout seconds={remaining} label={token.display} />
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant={state?.running ? "outline" : "default"}
                    className="rounded-[var(--radius-md)] px-5"
                    aria-label={`${state?.running ? "Pause" : "Start"} ${token.display} timer`}
                    onClick={() => onToggle(id, token.durationSeconds)}
                >
                    {state?.running ? (
                        <Pause className="mr-1.5 size-3.5" />
                    ) : (
                        <Play className="mr-1.5 size-3.5" />
                    )}
                    {action}
                </Button>
                {state && state.remaining !== state.total && (
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8 rounded-[var(--radius-md)]"
                        aria-label={`Reset ${token.display} timer`}
                        onClick={() => onReset(id)}
                    >
                        <RotateCcw className="size-3.5" />
                    </Button>
                )}
            </div>
        </div>
    )
}

export const RecipeCard = ({ recipe }: { recipe: ParsedRecipe }) => {
    const [servings, setServings] = useState(recipe.servings)
    const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(() => new Set())
    const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => new Set())
    const [timers, setTimers] = useState<Record<string, TimerState>>({})
    const [cookingOpen, setCookingOpen] = useState(false)
    const [cookingStarted, setCookingStarted] = useState(false)
    const [cookingStep, setCookingStep] = useState(0)
    const printRootRef = useRef<HTMLElement>(null)
    const announcedTimersRef = useRef(new Set<string>())
    const multiplier = servings / recipe.servings

    const availableMeasurementSystems = useMemo(() => {
        const systems = new Set<RecipeMeasurementSystem>()
        const items = [...recipe.ingredients, ...recipe.steps]
        for (const item of items) {
            for (const token of item.tokens) {
                if (token.type !== "quantity") continue
                const system = getRecipeUnitSystem(token.unit)
                if (system) systems.add(system)
            }
        }
        return systems
    }, [recipe.ingredients, recipe.steps])

    const [measurementSystem, setMeasurementSystem] = useState<RecipeMeasurementSystem>()
    const runningTimerCount = Object.values(timers).filter((timer) => timer.running).length
    const hasProgress = checkedIngredients.size > 0 || completedSteps.size > 0

    useEffect(() => {
        const interval = window.setInterval(() => {
            setTimers((current) => {
                let next: Record<string, TimerState> | undefined
                const now = Date.now()
                for (const [id, timer] of Object.entries(current)) {
                    const advanced = advanceRecipeTimer(timer, now)
                    if (advanced === timer) continue
                    next ??= { ...current }
                    next[id] = advanced
                }
                return next ?? current
            })
        }, 1000)
        return () => window.clearInterval(interval)
    }, [])

    useEffect(() => {
        const announced = announcedTimersRef.current
        for (const [id, timer] of Object.entries(timers)) {
            if (timer.finished && !announced.has(id)) {
                announced.add(id)
                toast.success("Recipe timer finished")
            } else if (!timer.finished) {
                announced.delete(id)
            }
        }
        for (const id of announced) {
            if (!(id in timers)) announced.delete(id)
        }
    }, [timers])

    const toggleTimer = useCallback((id: string, duration: number) => {
        setTimers((current) => {
            const now = Date.now()
            const existing = current[id] ? advanceRecipeTimer(current[id], now) : undefined
            if (!existing || existing.finished) {
                return {
                    ...current,
                    [id]: {
                        total: duration,
                        remaining: duration,
                        running: true,
                        finished: false,
                        startedAt: now
                    }
                }
            }
            return {
                ...current,
                [id]: existing.running
                    ? { ...existing, running: false, startedAt: undefined }
                    : { ...existing, running: true, startedAt: now }
            }
        })
    }, [])

    const resetTimer = useCallback((id: string) => {
        setTimers((current) => {
            const { [id]: _removed, ...rest } = current
            return rest
        })
    }, [])

    const toggleSetValue = useCallback(
        (setter: Dispatch<SetStateAction<Set<number>>>, value: number) =>
            setter((current) => {
                const next = new Set(current)
                if (next.has(value)) next.delete(value)
                else next.add(value)
                return next
            }),
        []
    )

    const printRecipe = () => {
        const root = printRootRef.current
        if (!root) return

        const printRoot = root.cloneNode(true) as HTMLElement
        printRoot.setAttribute("data-recipe-print-root", "true")
        for (const control of printRoot.querySelectorAll(
            "[data-recipe-print-hide], [data-recipe-print-timer-control]"
        )) {
            control.remove()
        }
        document.body.appendChild(printRoot)
        document.documentElement.classList.add("recipe-printing")
        const cleanup = () => {
            window.clearTimeout(fallbackCleanup)
            printRoot.remove()
            document.documentElement.classList.remove("recipe-printing")
            window.removeEventListener("afterprint", cleanup)
        }
        window.addEventListener("afterprint", cleanup)
        const fallbackCleanup = window.setTimeout(cleanup, 60_000)
        window.print()
    }

    const resetProgress = () => {
        setCheckedIngredients(new Set())
        setCompletedSteps(new Set())
    }

    const openCookMode = () => {
        const firstIncompleteStep = recipe.steps.findIndex(
            (_step, index) => !completedSteps.has(index)
        )
        setCookingStep(firstIncompleteStep >= 0 ? firstIncompleteStep : 0)
        setCookingStarted(false)
        setCookingOpen(true)
    }

    const advanceCookingStep = useCallback(() => {
        setCompletedSteps((current) => {
            if (current.has(cookingStep)) return current
            const next = new Set(current)
            next.add(cookingStep)
            return next
        })
        if (cookingStep >= recipe.steps.length - 1) {
            setCookingOpen(false)
        } else {
            setCookingStep((current) => current + 1)
        }
    }, [cookingStep, recipe.steps.length])

    const retreatCookingStep = useCallback(() => {
        if (cookingStep === 0) setCookingStarted(false)
        else setCookingStep((current) => current - 1)
    }, [cookingStep])

    useEffect(() => {
        if (!cookingOpen) return

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return
            const target = event.target
            if (
                target instanceof HTMLElement &&
                target.matches("input, textarea, select, [contenteditable='true']")
            ) {
                return
            }

            if (event.key === "Escape") {
                event.preventDefault()
                setCookingOpen(false)
                return
            }

            if (!cookingStarted) {
                if (
                    event.key === "ArrowRight" ||
                    (event.key === "Enter" &&
                        !(target instanceof HTMLElement && target.closest("button, a")))
                ) {
                    event.preventDefault()
                    setCookingStarted(true)
                }
                return
            }

            if (event.key === "ArrowLeft") {
                event.preventDefault()
                retreatCookingStep()
            } else if (event.key === "ArrowRight") {
                event.preventDefault()
                advanceCookingStep()
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [advanceCookingStep, cookingOpen, cookingStarted, retreatCookingStep])

    const currentStep = recipe.steps[cookingStep]
    const currentStepTimers = currentStep?.tokens.flatMap((token, index) =>
        token.type === "timer" ? [{ id: `step-${cookingStep}-${index}`, token }] : []
    )
    // Servings and units change the amounts, so they sit on the first heading above them.
    const quantityControls = (
        <div data-recipe-print-hide className="flex items-center gap-2">
            <div className={STEPPER_TRACK_CLASS}>
                <button
                    type="button"
                    className={STEPPER_BUTTON_CLASS}
                    aria-label="Decrease servings"
                    disabled={servings <= 1}
                    onClick={() => setServings((current) => Math.max(1, current - 1))}
                >
                    <Minus className="size-3" />
                </button>
                <span className="px-1.5 font-medium text-xs tabular-nums">
                    Serves {formatRecipeNumber(servings)}
                </span>
                <button
                    type="button"
                    className={STEPPER_BUTTON_CLASS}
                    aria-label="Increase servings"
                    onClick={() => setServings((current) => current + 1)}
                >
                    <Plus className="size-3" />
                </button>
            </div>

            {availableMeasurementSystems.size > 0 && (
                <Tabs
                    value={measurementSystem ?? "original"}
                    onValueChange={(value) =>
                        setMeasurementSystem(
                            value === "original" ? undefined : (value as RecipeMeasurementSystem)
                        )
                    }
                >
                    <TabsList className="h-7 p-0.5" aria-label="Units">
                        {UNIT_OPTIONS.map(([value, label]) => (
                            <TabsTrigger
                                key={value}
                                value={value}
                                className="h-6 px-2 text-xs shadow-none"
                            >
                                {label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            )}
        </div>
    )

    const sectionHeading = (title: string, controls?: ReactNode) => (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <h4 className={SECTION_HEADING_CLASS}>{title}</h4>
            {controls}
        </div>
    )

    return (
        <>
            <article
                ref={printRootRef}
                data-recipe-card
                className={cn(
                    "@container not-prose my-5 w-full overflow-hidden",
                    SPOTLIGHT_CARD_CLASS
                )}
            >
                {/* The dish leads: its pictures run edge to edge as the card's cover. */}
                {recipe.visualCue && (
                    <VisualReferences cue={recipe.visualCue} limit={3} variant="gallery" cover />
                )}

                {/* The cover sits on top of the card's accent wash, so the body carries
                    its own and the title is tinted with or without pictures above it. */}
                <div className="spotlight-surface @md:px-8 px-5 pt-7 pb-8">
                    <header>
                        <div className="flex items-start gap-4">
                            <h3 className="min-w-0 flex-1 text-balance font-extrabold @md:text-4xl text-2xl tracking-tight">
                                {recipe.title}
                            </h3>
                            <div
                                data-recipe-print-hide
                                className="flex shrink-0 items-center gap-1.5 pt-1"
                            >
                                {/* Appears with the first tick, so an untouched card stays quiet. */}
                                {hasProgress && (
                                    <button
                                        type="button"
                                        className={cn("inline-flex", SPOTLIGHT_ICON_BUTTON_CLASS)}
                                        aria-label="Reset recipe progress"
                                        onClick={resetProgress}
                                    >
                                        <RotateCcw className="size-4" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className={cn("inline-flex", SPOTLIGHT_ICON_BUTTON_CLASS)}
                                    aria-label="Print recipe"
                                    onClick={printRecipe}
                                >
                                    <Printer className="size-4" />
                                </button>
                                {recipe.steps.length > 0 && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="rounded-[var(--radius-md)] font-semibold"
                                        onClick={openCookMode}
                                    >
                                        <Flame className="size-3.5" />
                                        <span className="sr-only @md:not-sr-only">Cook Mode</span>
                                    </Button>
                                )}
                            </div>
                        </div>
                        {recipe.description && (
                            <p className="mt-3 max-w-prose text-pretty text-base text-muted-foreground leading-relaxed">
                                {recipe.description}
                            </p>
                        )}
                    </header>

                    {recipe.ingredients.length > 0 && (
                        <section className="mt-9">
                            {sectionHeading("Ingredients", quantityControls)}

                            <div className="grid @md:grid-cols-2 gap-x-10">
                                {recipe.ingredients.map((ingredient, index) => {
                                    const isChecked = checkedIngredients.has(index)
                                    const prevGroup =
                                        index > 0 ? recipe.ingredients[index - 1].group : undefined
                                    const showGroup =
                                        ingredient.group && ingredient.group !== prevGroup

                                    return (
                                        <Fragment key={`${ingredient.raw}-${index}`}>
                                            {showGroup && (
                                                <div className="col-span-full pt-4 pb-1 font-semibold text-muted-foreground text-sm">
                                                    {ingredient.group}
                                                </div>
                                            )}
                                            <label
                                                data-recipe-print-item
                                                className="group flex cursor-pointer select-none items-start gap-3 py-1.5"
                                            >
                                                <input
                                                    type="checkbox"
                                                    className="peer sr-only"
                                                    checked={isChecked}
                                                    onChange={() =>
                                                        toggleSetValue(setCheckedIngredients, index)
                                                    }
                                                />
                                                <span
                                                    aria-hidden="true"
                                                    className={cn(
                                                        "mt-[0.3125rem] inline-flex size-4 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                                                        isChecked
                                                            ? "border-primary bg-primary text-primary-foreground"
                                                            : "border-muted-foreground/40 group-hover:border-foreground/70"
                                                    )}
                                                >
                                                    {isChecked && (
                                                        <Check className="size-3 stroke-[3]" />
                                                    )}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "min-w-0 flex-1 text-[0.9375rem] leading-[1.625rem] transition-colors",
                                                        isChecked &&
                                                            "text-muted-foreground/70 line-through decoration-muted-foreground/40"
                                                    )}
                                                >
                                                    <RecipeRichText
                                                        tokens={ingredient.tokens}
                                                        tokenPrefix={`ingredient-${index}`}
                                                        multiplier={multiplier}
                                                        measurementSystem={measurementSystem}
                                                        timers={timers}
                                                        onToggleTimer={toggleTimer}
                                                        onResetTimer={resetTimer}
                                                    />
                                                </span>
                                            </label>
                                        </Fragment>
                                    )
                                })}
                            </div>
                        </section>
                    )}

                    {recipe.steps.length > 0 && (
                        <section className="mt-10">
                            {sectionHeading(
                                "Method",
                                recipe.ingredients.length === 0 ? quantityControls : undefined
                            )}

                            <div className="space-y-5">
                                {recipe.steps.map((step, index) => {
                                    const isDone = completedSteps.has(index)
                                    return (
                                        <div
                                            key={`${step.raw}-${index}`}
                                            data-recipe-print-item
                                            className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3"
                                        >
                                            {/* The numeral is the step's tick box: set as large
                                                as the title is bold, it turns into a check. */}
                                            <button
                                                type="button"
                                                aria-label={`Mark step ${index + 1} ${isDone ? "incomplete" : "complete"}`}
                                                aria-pressed={isDone}
                                                onClick={() =>
                                                    toggleSetValue(setCompletedSteps, index)
                                                }
                                                className={cn(
                                                    "flex h-7 items-center justify-start rounded-[var(--radius-sm)] font-extrabold text-2xl tabular-nums tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                    isDone
                                                        ? "text-primary"
                                                        : "text-foreground/30 hover:text-foreground"
                                                )}
                                            >
                                                {isDone ? (
                                                    <Check className="size-5 stroke-[3]" />
                                                ) : (
                                                    index + 1
                                                )}
                                            </button>

                                            <div className="grid items-start gap-4 @md:has-[>:nth-child(2)]:grid-cols-[minmax(0,1fr)_10rem]">
                                                <p
                                                    className={cn(
                                                        "max-w-prose text-base leading-7 transition-colors",
                                                        isDone && "text-muted-foreground/60"
                                                    )}
                                                >
                                                    <RecipeRichText
                                                        tokens={step.tokens}
                                                        tokenPrefix={`step-${index}`}
                                                        multiplier={multiplier}
                                                        measurementSystem={measurementSystem}
                                                        timers={timers}
                                                        onToggleTimer={toggleTimer}
                                                        onResetTimer={resetTimer}
                                                    />
                                                </p>
                                                {(step.visualCue ||
                                                    step.visualRefs !== undefined) && (
                                                    <VisualReferences
                                                        cue={step.visualCue ?? ""}
                                                        refs={step.visualRefs}
                                                        limit={1}
                                                        variant="step"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </section>
                    )}

                    {recipe.notes && (
                        <section className="mt-10">
                            {sectionHeading("Notes")}
                            <p className="-mt-2 max-w-prose text-[0.9375rem] text-muted-foreground leading-[1.625rem]">
                                {recipe.notes}
                            </p>
                        </section>
                    )}
                </div>
            </article>

            {/* Cook Mode Modal */}
            <Dialog open={cookingOpen} onOpenChange={setCookingOpen}>
                <DialogContent
                    showCloseButton={false}
                    overlayClassName="bg-background"
                    className="spotlight-surface inset-0 top-0 left-0 flex h-[100dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 shadow-none sm:max-w-none"
                >
                    <DialogHeader className="flex h-16 shrink-0 flex-row items-center gap-3 border-border/60 border-b px-4 text-left sm:h-18 sm:px-6">
                        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-primary/10 text-primary">
                            <ChefHat className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <DialogTitle className="truncate font-semibold text-sm sm:text-base">
                                {recipe.title}
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                {cookingStarted
                                    ? `Cooking step ${cookingStep + 1} of ${recipe.steps.length}`
                                    : `Cooking overview with ${recipe.steps.length} steps`}
                            </DialogDescription>
                        </div>
                        {runningTimerCount > 0 && (
                            <span className="hidden items-center gap-1.5 rounded-[var(--radius-md)] bg-primary/10 px-2.5 py-1 font-medium text-primary text-xs sm:inline-flex">
                                <Timer className="size-3.5" />
                                {runningTimerCount} active
                            </span>
                        )}
                        <DialogClose asChild>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-9 rounded-[var(--radius-md)]"
                                aria-label="Close"
                                aria-keyshortcuts="Escape"
                            >
                                <X className="size-4" />
                            </Button>
                        </DialogClose>
                    </DialogHeader>

                    {!cookingStarted ? (
                        <div className="flex flex-1 items-center overflow-y-auto px-5 py-10 sm:px-10">
                            <div
                                className={`mx-auto grid w-full max-w-6xl items-center gap-10 lg:gap-16 ${
                                    recipe.visualCue
                                        ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]"
                                        : "max-w-2xl"
                                }`}
                            >
                                {recipe.visualCue && (
                                    <div className="overflow-hidden rounded-[var(--radius-xl)]">
                                        <VisualReferences
                                            cue={recipe.visualCue}
                                            limit={3}
                                            variant="gallery"
                                        />
                                    </div>
                                )}
                                <div className="space-y-7 text-center lg:text-left">
                                    <div className="space-y-4">
                                        <h2 className="font-bold text-3xl text-foreground tracking-tight sm:text-5xl">
                                            {recipe.title}
                                        </h2>
                                        {recipe.description && (
                                            <p className="text-base text-muted-foreground leading-relaxed sm:text-lg">
                                                {recipe.description}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-muted-foreground text-sm lg:justify-start">
                                        <span>{recipe.steps.length} steps</span>
                                        <span aria-hidden="true">·</span>
                                        <span>{formatRecipeNumber(servings)} servings</span>
                                        {completedSteps.size > 0 && (
                                            <>
                                                <span aria-hidden="true">·</span>
                                                <span>{completedSteps.size} completed</span>
                                            </>
                                        )}
                                    </div>
                                    <Button
                                        type="button"
                                        size="lg"
                                        className="rounded-[var(--radius-md)] px-7 font-semibold"
                                        onClick={() => setCookingStarted(true)}
                                        aria-keyshortcuts="Enter ArrowRight"
                                    >
                                        {completedSteps.size > 0
                                            ? "Resume cooking"
                                            : "Start cooking"}
                                        <ChevronRight className="ml-1 size-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {currentStep && (
                                <div className="flex flex-1 overflow-y-auto px-5 py-8 sm:px-10 sm:py-12">
                                    <div
                                        className={`mx-auto grid min-h-full w-full max-w-6xl items-center gap-10 ${
                                            currentStep.visualCue
                                                ? "lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]"
                                                : "max-w-3xl"
                                        }`}
                                    >
                                        <section className="space-y-7 text-center">
                                            <div className="space-y-4">
                                                <span className="inline-flex items-center rounded-[var(--radius-md)] bg-primary/10 px-3 py-1 font-semibold text-primary text-xs uppercase tracking-[0.14em]">
                                                    Step {cookingStep + 1}
                                                </span>
                                                <h2 className="sr-only">
                                                    Step {cookingStep + 1} instructions
                                                </h2>
                                                <div className="text-balance font-medium text-2xl text-foreground leading-relaxed sm:text-3xl sm:leading-relaxed lg:text-4xl lg:leading-relaxed">
                                                    <CookModeRichText
                                                        tokens={currentStep.tokens}
                                                        multiplier={multiplier}
                                                        measurementSystem={measurementSystem}
                                                    />
                                                </div>
                                            </div>

                                            {currentStepTimers && currentStepTimers.length > 0 && (
                                                <div className="flex flex-wrap justify-center gap-3">
                                                    {currentStepTimers.map(({ id, token }) => (
                                                        <CookModeTimer
                                                            key={id}
                                                            id={id}
                                                            token={token}
                                                            state={timers[id]}
                                                            onToggle={toggleTimer}
                                                            onReset={resetTimer}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </section>

                                        {(currentStep.visualCue ||
                                            currentStep.visualRefs !== undefined) && (
                                            <div className="overflow-hidden rounded-[var(--radius-xl)]">
                                                <VisualReferences
                                                    cue={currentStep.visualCue ?? ""}
                                                    refs={currentStep.visualRefs}
                                                    limit={1}
                                                    variant="step"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <footer className="grid h-20 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-border/60 border-t px-4 sm:px-8">
                                <div className="justify-self-start">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="rounded-[var(--radius-md)]"
                                        aria-keyshortcuts="ArrowLeft"
                                        onClick={retreatCookingStep}
                                    >
                                        <ChevronLeft className="mr-1 size-4" />
                                        <span className="hidden sm:inline">
                                            {cookingStep === 0 ? "Overview" : "Back"}
                                        </span>
                                    </Button>
                                </div>

                                <div className="text-center font-medium text-muted-foreground text-xs sm:text-sm">
                                    Step {cookingStep + 1} of {recipe.steps.length}
                                </div>

                                <Button
                                    type="button"
                                    className="justify-self-end rounded-[var(--radius-md)] px-5 font-semibold sm:px-7"
                                    aria-keyshortcuts="ArrowRight"
                                    onClick={advanceCookingStep}
                                >
                                    {cookingStep >= recipe.steps.length - 1 ? "Complete" : "Next"}
                                    {cookingStep < recipe.steps.length - 1 && (
                                        <ChevronRight className="ml-1 size-4" />
                                    )}
                                </Button>
                            </footer>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
