"use client"

import { Save } from "lucide-react"

import { walkthroughSteps } from "@/components/landing-page/persona-content"
import { SectionHead } from "@/components/landing-page/shared"

// Filled instead of bordered: the fields sit inside an already-bordered panel,
// so a second border per field reads as noise. The tinted surface does the
// "this is an input" work instead.
function MockField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <p className="font-medium text-xs [color:var(--landing-muted-soft)]">{label}</p>
            <div className="rounded-[var(--radius-md)] px-3 py-2 text-sm [background:var(--landing-surface-stronger)] [color:var(--landing-fg)]">
                {children}
            </div>
        </div>
    )
}

// The persona editor, subdivided so each fragment sits under its numbered step
// and does the explaining itself. Index-aligned with `walkthroughSteps`.
const stepSlices: React.ReactNode[] = [
    // 1. Name it and give it a face
    <div key="identity" className="flex items-end gap-3">
        <div className="flex-1">
            <MockField label="Name">Aria, the Archivist</MockField>
        </div>
        <img
            src="/avatars/aria.webp"
            alt="Aria's avatar"
            loading="lazy"
            className="size-11 shrink-0 rounded-full object-cover"
        />
    </div>,

    // 2. Describe how it thinks
    <MockField key="instructions" label="Instructions">
        <span className="[color:var(--landing-muted)]">
            You are a meticulous archivist. You cite the source doc for every claim and never invent
            a reference…
        </span>
    </MockField>,

    // 3. Feed it knowledge and openers
    <div key="knowledge" className="space-y-4">
        <MockField label="Knowledge base">lore-bible.md · 3.2k tokens</MockField>
        <div className="space-y-1.5">
            <p className="font-medium text-xs [color:var(--landing-muted-soft)]">
                Conversation starters
            </p>
            <div className="flex flex-wrap gap-2">
                {["Summarise the archive", "What does the lore say about…"].map((chip) => (
                    <span
                        key={chip}
                        className="rounded-[var(--radius-sm)] px-2.5 py-1 text-xs [background:var(--landing-surface-stronger)] [color:var(--landing-muted)]"
                    >
                        {chip}
                    </span>
                ))}
            </div>
        </div>
    </div>,

    // 4. Pick a model and save
    <div key="model" className="space-y-4">
        <MockField label="Default model">Claude Sonnet 4.6</MockField>
        <div className="flex items-center justify-end">
            <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm">
                <Save className="size-3.5" />
                Create Persona
            </span>
        </div>
    </div>
]

export function PersonaWalkthroughSection() {
    return (
        <section id="persona-build" className="border-t py-24 [border-color:var(--landing-border)]">
            <div className="mx-auto w-full max-w-7xl px-5 md:px-8">
                <SectionHead title="Build your own in four steps." />

                <ol className="mx-auto max-w-3xl">
                    {walkthroughSteps.map((step, index) => {
                        const isLast = index === walkthroughSteps.length - 1
                        return (
                            <li key={step.title} className="flex gap-5">
                                <div className="flex flex-col items-center">
                                    <span className="grid size-10 shrink-0 place-items-center rounded-full border font-medium [border-color:var(--landing-border-strong)] [color:var(--landing-fg)]">
                                        {index + 1}
                                    </span>
                                    {!isLast && (
                                        <span className="mt-2 mb-2 w-px flex-1 [background:var(--landing-border)]" />
                                    )}
                                </div>
                                <div className={`min-w-0 flex-1 ${isLast ? "" : "pb-10"}`}>
                                    <h3 className="flex h-10 items-center font-medium text-lg [color:var(--landing-fg)]">
                                        {step.title}
                                    </h3>
                                    <div className="mt-3 rounded-[var(--radius-xl)] border p-5 shadow-2xl [background:var(--landing-surface)] [border-color:var(--landing-border)]">
                                        {stepSlices[index]}
                                    </div>
                                </div>
                            </li>
                        )
                    })}
                </ol>
            </div>
        </section>
    )
}
