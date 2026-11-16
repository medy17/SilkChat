import { AnimatedCollapsible } from "@/components/ui/animated-collapsible"
import { CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Switch } from "@/components/ui/switch"
import { MAX_SKILLS_PER_CHAT } from "@/convex/lib/skill_bundle"
import { cn } from "@/lib/utils"
import { ArrowUpRight, ChevronLeft, ChevronRight, Lock } from "lucide-react"
import { type ReactNode, useLayoutEffect, useRef, useState } from "react"
import { summarizeSkillNames } from "./skill-types"

// Same motion as the image sidebar opening one model's settings.
const PAGE_MOTION_CLASS =
    "duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
const PAGE_TRANSITION_CLASS = `transition-[opacity,translate] ${PAGE_MOTION_CLASS}`
const PAGE_HIDDEN_CLASS = "pointer-events-none invisible absolute inset-x-0 top-0"
const PAGE_MOTION_MS = 300

/**
 * Two pages sharing the flyout: the one it opens on, and a detail page that takes its place.
 * The page arriving slides and fades in, as in the image sidebar. The flyout has no fixed
 * height, unlike the sidebar, so its height moves from one page's to the other's alongside.
 */
export function FlyoutPageSwap({
    detailOpen,
    detail,
    children
}: {
    detailOpen: boolean
    detail: ReactNode
    children: ReactNode
}) {
    const frameRef = useRef<HTMLDivElement>(null)
    const mainRef = useRef<HTMLDivElement>(null)
    const detailRef = useRef<HTMLDivElement>(null)
    const shownRef = useRef(detailOpen)
    // What opened the detail page, to hand focus back to when it closes.
    const openerRef = useRef<HTMLElement | null>(null)

    useLayoutEffect(() => {
        if (shownRef.current === detailOpen) return
        shownRef.current = detailOpen
        const frame = frameRef.current
        const arriving = (detailOpen ? detailRef : mainRef).current
        const leaving = (detailOpen ? mainRef : detailRef).current
        if (!frame || !arriving || !leaving) return

        if (detailOpen) {
            openerRef.current =
                document.activeElement instanceof HTMLElement ? document.activeElement : null
            arriving.querySelector<HTMLElement>("button")?.focus({ preventScroll: true })
        } else {
            openerRef.current?.focus({ preventScroll: true })
            openerRef.current = null
        }

        // Mid-swap the frame is wherever its height has got to; otherwise it has already
        // taken the arriving page's height, and the page that left still has its own.
        const from = frame.style.height
            ? frame.getBoundingClientRect().height
            : leaving.offsetHeight
        frame.style.height = `${from}px`
        // Read back so the starting height is in place before the target is set.
        frame.getBoundingClientRect()
        frame.style.height = `${arriving.offsetHeight}px`
        const settle = () => {
            frame.style.height = ""
        }
        const timer = window.setTimeout(settle, PAGE_MOTION_MS + 50)
        return () => window.clearTimeout(timer)
    }, [detailOpen])

    return (
        <div
            ref={frameRef}
            className={cn("relative overflow-clip transition-[height]", PAGE_MOTION_CLASS)}
        >
            <div
                ref={mainRef}
                aria-hidden={detailOpen}
                className={cn(detailOpen && PAGE_HIDDEN_CLASS)}
            >
                <div
                    className={cn(
                        PAGE_TRANSITION_CLASS,
                        detailOpen ? "-translate-x-4 opacity-0" : "translate-x-0 opacity-100"
                    )}
                >
                    {children}
                </div>
            </div>
            <div
                ref={detailRef}
                aria-hidden={!detailOpen}
                className={cn(!detailOpen && PAGE_HIDDEN_CLASS)}
            >
                <div
                    className={cn(
                        PAGE_TRANSITION_CLASS,
                        detailOpen ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"
                    )}
                >
                    {detail}
                </div>
            </div>
        </div>
    )
}

/** Marks a line that was settled when the chat started and only reports it now. */
export function FlyoutLock() {
    return (
        <Lock
            role="img"
            aria-label="Set when the chat started"
            className="size-4 shrink-0 text-muted-foreground"
        />
    )
}

/**
 * The Magic line once the chat has started. Magic picks tools from a chat's first message
 * only, so from then on the line says whether it did.
 */
export function MagicFlyoutLockedRow({ used }: { used: boolean | undefined }) {
    return (
        <div className={cn(FLYOUT_ROW_CLASS, "border-border border-b")}>
            <span className="min-w-0">
                <span className="block font-medium text-sm">Magic</span>
                <span className="block text-muted-foreground text-xs">
                    {used === undefined
                        ? "\u00a0"
                        : used
                          ? "Picked the tools for this chat"
                          : "Not used in this chat"}
                </span>
            </span>
            <FlyoutLock />
        </div>
    )
}

/** As much of a library skill as the flyout needs. */
export type FlyoutSkill = { slug: string; enabled: boolean }

const FLYOUT_ROW_CLASS = "flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
const FLYOUT_ROW_ACTION_CLASS =
    "outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50"

/**
 * The Skills line in the tool flyout, under Magic and in its format: a name and what is on.
 * A new chat opens the picker. Once the chat has started its skills are fixed, so the line
 * only reports them.
 */
export function SkillsFlyoutRow({
    selectedNames,
    locked,
    onOpen
}: {
    selectedNames: string[]
    locked: boolean
    onOpen: () => void
}) {
    const label = (
        <span className="min-w-0">
            <span className="block font-medium text-sm">Skills</span>
            <span className="line-clamp-2 text-muted-foreground text-xs">
                {summarizeSkillNames(selectedNames) ??
                    (locked ? "None in this chat" : "None for this chat")}
            </span>
        </span>
    )

    if (locked) {
        return (
            <div className={cn(FLYOUT_ROW_CLASS, "border-border border-b")}>
                {label}
                <FlyoutLock />
            </div>
        )
    }

    return (
        <button
            type="button"
            onClick={onOpen}
            className={cn(FLYOUT_ROW_CLASS, FLYOUT_ROW_ACTION_CLASS, "border-border border-b")}
        >
            {label}
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </button>
    )
}

/** Shown once a chat has as many skills as it can take. */
export const SKILL_LIMIT_NOTE = `A chat can use up to ${MAX_SKILLS_PER_CHAT} skills.`

function SkillSwitchRow({
    skill,
    checked,
    disabled,
    onToggle
}: {
    skill: FlyoutSkill
    checked: boolean
    disabled: boolean
    onToggle: (slug: string, on: boolean) => void
}) {
    return (
        // The whole line switches the skill: nothing else on it can be pressed.
        <CommandItem
            value={skill.slug}
            disabled={disabled}
            onSelect={() => onToggle(skill.slug, !checked)}
            className="flex cursor-pointer items-center justify-between gap-3 p-3"
        >
            <span className="min-w-0 truncate text-sm">{skill.slug}</span>
            <Switch
                aria-label={`Use ${skill.slug} in this chat`}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(on) => onToggle(skill.slug, on)}
                // The line's own press would switch it straight back.
                onClick={(event) => event.stopPropagation()}
            />
        </CommandItem>
    )
}

/**
 * The picker the Skills line opens, in place of the tool list. Skills that are on for new
 * chats come first; the rest of the library waits behind one line.
 */
export function SkillsFlyoutPage({
    skills,
    selectedSlugs,
    atLimit = false,
    onToggle,
    onBack,
    onBrowse
}: {
    skills: FlyoutSkill[]
    selectedSlugs: ReadonlySet<string>
    // The chat has all the skills it can take, so the rest can't be switched on.
    atLimit?: boolean
    onToggle: (slug: string, on: boolean) => void
    onBack: () => void
    onBrowse: () => void
}) {
    const usual = skills.filter((skill) => skill.enabled)
    const others = skills.filter((skill) => !skill.enabled)
    // With nothing on by default there is no short list to lead with.
    const leading = usual.length > 0 ? usual : others
    const trailing = usual.length > 0 ? others : []
    const [showOthers, setShowOthers] = useState(false)

    return (
        <>
            <button
                type="button"
                onClick={onBack}
                className={cn(
                    FLYOUT_ROW_CLASS,
                    FLYOUT_ROW_ACTION_CLASS,
                    "justify-start gap-2 border-border border-b font-medium text-sm"
                )}
            >
                <ChevronLeft aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                Skills
            </button>
            <CommandList>
                {skills.length === 0 ? (
                    <p className="px-4 py-6 text-center text-muted-foreground text-sm">
                        No skills yet
                    </p>
                ) : (
                    <CommandGroup>
                        {atLimit && (
                            <p className="px-3 pt-2 pb-1 text-muted-foreground text-xs">
                                {SKILL_LIMIT_NOTE}
                            </p>
                        )}
                        {leading.map((skill) => (
                            <SkillSwitchRow
                                key={skill.slug}
                                skill={skill}
                                checked={selectedSlugs.has(skill.slug)}
                                disabled={atLimit && !selectedSlugs.has(skill.slug)}
                                onToggle={onToggle}
                            />
                        ))}
                        {trailing.length > 0 && (
                            <>
                                <button
                                    type="button"
                                    aria-expanded={showOthers}
                                    onClick={() => setShowOthers((shown) => !shown)}
                                    className="flex h-8 w-full items-center gap-1 rounded-[var(--radius-md)] px-2 font-medium text-muted-foreground text-xs outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
                                >
                                    <ChevronRight
                                        aria-hidden="true"
                                        className={cn(
                                            "size-4 transition-transform",
                                            showOthers && "rotate-90"
                                        )}
                                    />
                                    More skills
                                </button>
                                <AnimatedCollapsible open={showOthers}>
                                    <div inert={!showOthers}>
                                        {trailing.map((skill) => (
                                            <SkillSwitchRow
                                                key={skill.slug}
                                                skill={skill}
                                                checked={selectedSlugs.has(skill.slug)}
                                                disabled={atLimit && !selectedSlugs.has(skill.slug)}
                                                onToggle={onToggle}
                                            />
                                        ))}
                                    </div>
                                </AnimatedCollapsible>
                            </>
                        )}
                    </CommandGroup>
                )}
            </CommandList>
            <button
                type="button"
                onClick={onBrowse}
                className={cn(
                    FLYOUT_ROW_CLASS,
                    FLYOUT_ROW_ACTION_CLASS,
                    "border-border border-t text-sm"
                )}
            >
                Browse skills
                <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                />
            </button>
        </>
    )
}
