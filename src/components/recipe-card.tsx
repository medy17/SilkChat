"use client"

import { RecipeVisuals } from "@/components/recipe-visuals"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
    type ParsedRecipe,
    type RecipeInlineToken,
    type RecipeMeasurementSystem,
    formatRecipeNumber,
    formatRecipeQuantity,
    getRecipeUnitSystem
} from "@/lib/recipe"
import {
    Check,
    ChefHat,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Flame,
    Minus,
    Pause,
    Play,
    Plus,
    Printer,
    RotateCcw,
    Ruler,
    Sparkles,
    Timer,
    X
} from "lucide-react"
import {
    type Dispatch,
    Fragment,
    type SetStateAction,
    useCallback,
    useEffect,
    useId,
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

const cleanInlineText = (value: string) => value.replace(/\*\*|__/g, "")

const formatClock = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainder = seconds % 60
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    }
    return `${minutes}:${String(remainder).padStart(2, "0")}`
}

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
    const label = state ? formatClock(state.remaining) : token.display

    return (
        <span className="not-prose mx-1 inline-flex items-center align-baseline">
            <button
                type="button"
                data-recipe-print-timer-control
                className="inline-flex h-6.5 items-center gap-1.5 rounded-[var(--radius-md)] bg-primary/10 px-2.5 font-medium text-primary text-xs transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                    <span
                        key={id}
                        className="font-semibold text-foreground underline decoration-primary/40 underline-offset-4"
                    >
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
            <div className="text-center">
                <div className="font-semibold text-4xl text-primary tabular-nums tracking-tight sm:text-5xl">
                    {formatClock(remaining)}
                </div>
                <div className="mt-1 text-muted-foreground text-xs">{token.display}</div>
            </div>
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
    const [unitPopoverOpen, setUnitPopoverOpen] = useState(false)
    const unitControlId = useId()
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
    const measurementSystemLabel = measurementSystem
        ? `${measurementSystem[0]?.toLocaleUpperCase()}${measurementSystem.slice(1)}`
        : "Original"
    const runningTimerCount = Object.values(timers).filter((timer) => timer.running).length

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

    return (
        <>
            <article
                ref={printRootRef}
                data-recipe-card
                className="not-prose mx-auto my-10 max-w-4xl rounded-[var(--radius-xl)] border border-border/80 bg-background p-6 sm:p-12"
            >
                {/* Hero Header */}
                <header className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-primary/10 px-3 py-1 font-medium text-primary text-xs uppercase tracking-wider">
                            <ChefHat className="size-3.5" />
                            Recipe
                        </span>
                        <div data-recipe-print-hide className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 rounded-[var(--radius-md)] text-muted-foreground hover:text-foreground"
                                aria-label="Print recipe"
                                onClick={printRecipe}
                            >
                                <Printer className="size-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                className="h-8 gap-1.5 rounded-[var(--radius-md)] px-2.5 text-muted-foreground text-xs hover:text-foreground"
                                aria-label="Reset recipe progress"
                                disabled={
                                    checkedIngredients.size === 0 && completedSteps.size === 0
                                }
                                onClick={resetProgress}
                            >
                                <RotateCcw className="size-3.5" />
                                Reset
                            </Button>
                            {recipe.steps.length > 0 && (
                                <Button
                                    type="button"
                                    className="h-8 gap-1.5 rounded-[var(--radius-md)] px-3.5 font-semibold text-xs shadow-sm"
                                    onClick={() => {
                                        const firstIncompleteStep = recipe.steps.findIndex(
                                            (_step, index) => !completedSteps.has(index)
                                        )
                                        setCookingStep(
                                            firstIncompleteStep >= 0 ? firstIncompleteStep : 0
                                        )
                                        setCookingStarted(false)
                                        setCookingOpen(true)
                                    }}
                                >
                                    <Flame className="size-3.5" />
                                    Cook Mode
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h1 className="font-extrabold text-3xl text-foreground tracking-tight sm:text-5xl">
                            {recipe.title}
                        </h1>
                        {recipe.description && (
                            <p className="text-base text-muted-foreground leading-relaxed sm:text-lg">
                                {recipe.description}
                            </p>
                        )}
                    </div>

                    {recipe.visualCue && (
                        <RecipeVisuals cue={recipe.visualCue} limit={3} variant="gallery" />
                    )}

                    {/* Serving and unit controls */}
                    <div data-recipe-print-hide className="flex flex-wrap items-center gap-3 pt-2">
                        <div className="inline-flex items-center rounded-[var(--radius-lg)] border border-border/70 bg-muted/30 p-1">
                            <button
                                type="button"
                                className="inline-flex size-6 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-30"
                                aria-label="Decrease servings"
                                disabled={servings <= 1}
                                onClick={() => setServings((current) => Math.max(1, current - 1))}
                            >
                                <Minus className="size-3" />
                            </button>
                            <span className="px-3 font-medium text-xs">
                                <strong className="font-bold text-foreground">
                                    {formatRecipeNumber(servings)}
                                </strong>{" "}
                                servings
                            </span>
                            <button
                                type="button"
                                className="inline-flex size-6 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                                aria-label="Increase servings"
                                onClick={() => setServings((current) => current + 1)}
                            >
                                <Plus className="size-3" />
                            </button>
                        </div>

                        {availableMeasurementSystems.size > 0 && (
                            <Popover open={unitPopoverOpen} onOpenChange={setUnitPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-2 rounded-[var(--radius-lg)] border-border/70 bg-muted/30 px-3 font-medium text-xs shadow-none hover:bg-muted/60"
                                        aria-label={`Units: ${measurementSystemLabel}`}
                                    >
                                        <Ruler className="size-3.5 text-muted-foreground" />
                                        <span>{measurementSystemLabel}</span>
                                        <ChevronDown className="size-3 text-muted-foreground" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    align="start"
                                    className="w-60 rounded-[var(--radius-lg)] border-border/70 p-2 shadow-lg"
                                >
                                    <div className="px-2 pt-1 pb-2">
                                        <p className="font-semibold text-sm">Measurement units</p>
                                        <p className="text-muted-foreground text-xs">
                                            Choose how quantities are displayed.
                                        </p>
                                    </div>
                                    <RadioGroup
                                        value={measurementSystem ?? "original"}
                                        className="gap-1"
                                        onValueChange={(value) => {
                                            setMeasurementSystem(
                                                value === "original"
                                                    ? undefined
                                                    : (value as RecipeMeasurementSystem)
                                            )
                                            setUnitPopoverOpen(false)
                                        }}
                                    >
                                        {(
                                            [
                                                ["original", "Original", "As written"],
                                                ["metric", "Metric", "Grams and millilitres"],
                                                ["imperial", "Imperial", "Ounces and US cups"]
                                            ] as const
                                        ).map(([value, label, description]) => (
                                            <label
                                                key={value}
                                                htmlFor={`${unitControlId}-${value}`}
                                                className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 transition-colors hover:bg-muted/60"
                                            >
                                                <RadioGroupItem
                                                    id={`${unitControlId}-${value}`}
                                                    value={value}
                                                />
                                                <span className="min-w-0">
                                                    <span className="block font-medium text-sm">
                                                        {label}
                                                    </span>
                                                    <span className="block text-muted-foreground text-xs">
                                                        {description}
                                                    </span>
                                                </span>
                                            </label>
                                        ))}
                                    </RadioGroup>
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>
                </header>

                {/* Ingredients: Two-column Checklist */}
                {recipe.ingredients.length > 0 && (
                    <section className="mt-12 border-border/60 border-t pt-10">
                        <div className="mb-6 flex items-baseline justify-between">
                            <div>
                                <h2 className="font-bold text-foreground text-xl tracking-tight sm:text-2xl">
                                    Ingredients
                                </h2>
                                <p className="text-muted-foreground text-xs sm:text-sm">
                                    Tick off items as you prepare
                                </p>
                            </div>
                            <span
                                data-recipe-print-hide
                                className="rounded-[var(--radius-md)] bg-muted/50 px-2.5 py-0.5 font-medium text-muted-foreground text-xs"
                            >
                                {checkedIngredients.size} of {recipe.ingredients.length} checked
                            </span>
                        </div>

                        <div className="grid gap-x-12 sm:grid-cols-2">
                            {recipe.ingredients.map((ingredient, index) => {
                                const isChecked = checkedIngredients.has(index)
                                const prevGroup =
                                    index > 0 ? recipe.ingredients[index - 1].group : undefined
                                const showGroup = ingredient.group && ingredient.group !== prevGroup

                                return (
                                    <Fragment key={`${ingredient.raw}-${index}`}>
                                        {showGroup && (
                                            <div className="col-span-full border-border/40 border-b pt-6 pb-2 first:pt-0">
                                                <span className="font-bold text-muted-foreground text-xs uppercase tracking-wider">
                                                    {ingredient.group}
                                                </span>
                                            </div>
                                        )}
                                        <label
                                            data-recipe-print-item
                                            className="group flex cursor-pointer select-none items-start gap-3.5 border-border/30 border-b py-3 transition-colors hover:border-border/80"
                                        >
                                            <input
                                                type="checkbox"
                                                className="sr-only"
                                                checked={isChecked}
                                                onChange={() =>
                                                    toggleSetValue(setCheckedIngredients, index)
                                                }
                                            />
                                            <span
                                                className={`mt-1 inline-flex size-4.5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border transition-all ${
                                                    isChecked
                                                        ? "scale-100 border-primary bg-primary text-primary-foreground"
                                                        : "border-muted-foreground/30 bg-transparent group-hover:border-foreground/60"
                                                }`}
                                            >
                                                {isChecked && (
                                                    <Check className="size-2.5 stroke-[3]" />
                                                )}
                                            </span>
                                            <span
                                                className={`flex-1 text-sm leading-relaxed transition-opacity ${
                                                    isChecked
                                                        ? "text-muted-foreground line-through decoration-muted-foreground/40 opacity-60"
                                                        : "text-foreground"
                                                }`}
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

                {/* Method: Connected Timeline */}
                {recipe.steps.length > 0 && (
                    <section className="mt-14 border-border/60 border-t pt-10">
                        <div className="mb-8">
                            <h2 className="font-bold text-foreground text-xl tracking-tight sm:text-2xl">
                                Method
                            </h2>
                            <p className="text-muted-foreground text-xs sm:text-sm">
                                Follow step by step
                            </p>
                        </div>

                        <div className="relative space-y-8 pl-8 sm:pl-10">
                            {/* Running vertical guide line */}
                            <div className="-translate-x-1/2 absolute top-4 bottom-4 left-3.5 w-px bg-border sm:left-4" />

                            {recipe.steps.map((step, index) => {
                                const isDone = completedSteps.has(index)
                                return (
                                    <div
                                        key={`${step.raw}-${index}`}
                                        data-recipe-print-item
                                        className="group relative"
                                    >
                                        <button
                                            type="button"
                                            aria-label={`Mark step ${index + 1} ${isDone ? "incomplete" : "complete"}`}
                                            aria-pressed={isDone}
                                            onClick={() => toggleSetValue(setCompletedSteps, index)}
                                            className={`-left-8 sm:-left-10 absolute inline-flex size-7 items-center justify-center rounded-[var(--radius-lg)] border font-bold text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-8 ${
                                                isDone
                                                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                                    : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
                                            }`}
                                        >
                                            {isDone ? (
                                                <Check className="size-3.5 stroke-[2.5]" />
                                            ) : (
                                                index + 1
                                            )}
                                        </button>

                                        <div
                                            className={
                                                step.visualCue
                                                    ? "grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]"
                                                    : undefined
                                            }
                                        >
                                            <div
                                                className={`pt-0.5 text-base leading-relaxed transition-opacity sm:text-lg sm:leading-relaxed ${
                                                    isDone
                                                        ? "text-muted-foreground line-through decoration-muted-foreground/30 opacity-60"
                                                        : "text-foreground"
                                                }`}
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
                                            </div>
                                            {step.visualCue && (
                                                <RecipeVisuals
                                                    cue={step.visualCue}
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

                {/* Notes: Subtle Banner */}
                {recipe.notes && (
                    <footer className="mt-14 border-border/60 border-t pt-8">
                        <div className="flex gap-3.5 rounded-[var(--radius-lg)] border border-border/40 bg-muted/20 p-5 sm:p-6">
                            <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
                            <div className="space-y-1">
                                <h3 className="font-semibold text-foreground text-sm">
                                    Chef&apos;s Notes
                                </h3>
                                <p className="text-muted-foreground text-sm leading-relaxed">
                                    {recipe.notes}
                                </p>
                            </div>
                        </div>
                    </footer>
                )}
            </article>

            {/* Cook Mode Modal */}
            <Dialog open={cookingOpen} onOpenChange={setCookingOpen}>
                <DialogContent
                    showCloseButton={false}
                    overlayClassName="bg-background"
                    className="inset-0 top-0 left-0 flex h-[100dvh] max-h-none w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-[var(--radius-xl)] border-0 bg-background p-0 shadow-none sm:max-w-none"
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
                                        <RecipeVisuals
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

                                        {currentStep.visualCue && (
                                            <div className="overflow-hidden rounded-[var(--radius-xl)]">
                                                <RecipeVisuals
                                                    cue={currentStep.visualCue}
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
