import { BlurText } from "@/components/blur-text"
import { Button } from "@/components/ui/button"
import { Link, createLazyFileRoute } from "@tanstack/react-router"
import { ArrowLeft, ArrowRight } from "lucide-react"

export const Route = createLazyFileRoute("/about")({
    component: RouteComponent
})

const FEATURES = [
    {
        title: "Every major model",
        body: "Chat with models from OpenAI, Anthropic, Google, and more in one place, and compare their answers to the same question."
    },
    {
        title: "Switch mid-conversation",
        body: "Change models partway through a thread. Your history, attachments, and characters carry over."
    },
    {
        title: "Personas",
        body: "Reusable characters with their own instructions, openings, and knowledge — from a vampire lord to a code reviewer."
    },
    {
        title: "SilkScreen",
        body: "Image generation with resolution and variant control, organized in a library built for generating in bulk."
    },
    {
        title: "Threads that behave like documents",
        body: "Branch a conversation at any message, share it, or export and import whole threads."
    },
    {
        title: "Files and PDFs",
        body: "Attach documents and images to a conversation and work over them with models that support it."
    },
    {
        title: "Bring your own keys — or models",
        body: "Connect your own API keys, including OpenRouter, or add custom models and endpoints alongside the built-in catalog."
    },
    {
        title: "Web search",
        body: "Let a model search the web when a question needs current information."
    },
    {
        title: "Memory across conversations",
        body: "Connect your Supermemory account and models can carry context between chats."
    },
    {
        title: "Reasoning control",
        body: "Set how hard a model thinks per message, on models that support adjustable reasoning effort."
    }
]

const PRINCIPLES = [
    {
        title: "Private by default",
        body: "Persona chats stay private — never in a public gallery, never used to train models."
    },
    {
        title: "No model lock-in",
        body: "Switch models mid-conversation and keep your characters and history."
    },
    {
        title: "Streams that survive",
        body: "A response keeps generating through a refresh, a dropped connection, or a second device."
    },
    {
        title: "Speed is a feature",
        body: "Aggressive caching and optimistic updates keep it fast, even on a slow connection."
    },
    {
        title: "Independently built",
        body: "No company, just a developer. Feedback reaches the person who can act on it."
    }
]

function RouteComponent() {
    return (
        <div className="flex h-screen flex-col overflow-y-auto bg-background">
            <div className="mx-auto w-full max-w-5xl px-6 py-10 md:px-10 md:py-16">
                {/* Back */}
                <div className="mb-16 md:mb-24">
                    <Link to="/">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-2 gap-2 text-muted-foreground hover:text-foreground"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>
                    </Link>
                </div>

                {/* Hero — oversized, left-aligned, asymmetric */}
                <header className="mb-20 md:mb-32">
                    <p className="mb-8 font-medium text-muted-foreground text-sm uppercase tracking-[0.2em]">
                        About SilkChat
                    </p>
                    <h1 className="max-w-4xl font-bold text-5xl leading-[1.03] tracking-tight sm:text-6xl md:text-8xl">
                        One workspace for every AI model.
                    </h1>
                    <p className="mt-8 max-w-md text-muted-foreground text-xl leading-relaxed">
                        Built on a bet about what actually lasts.
                    </p>
                </header>

                {/* Editorial rows: label column + content column */}
                <div>
                    {/* What it is */}
                    <div className="grid gap-x-12 gap-y-5 border-border border-t py-14 md:grid-cols-[200px_1fr] md:py-20">
                        <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-[0.2em] md:pt-2">
                            What it is
                        </h2>
                        <div className="max-w-2xl space-y-6 text-foreground/90 text-lg leading-relaxed">
                            <p>
                                A new model lands every few weeks, each behind its own subscription
                                and its own app. You end up paying for several, copying prompts
                                between them, and starting over every time you want to compare
                                answers.
                            </p>
                            <p>
                                SilkChat puts the major models in one place, under one subscription.
                                Chat with any of them, compare answers side by side, generate
                                images, and switch models mid-conversation without losing your
                                place.
                            </p>
                        </div>
                    </div>

                    {/* The bet — full-bleed statement, blur-focuses in on scroll */}
                    <div className="border-border border-t py-20 md:py-32">
                        <BlurText
                            text="The models will keep changing. What you build around them — your conversations, characters, and files — shouldn't have to."
                            animateBy="words"
                            direction="top"
                            delay={90}
                            stepDuration={0.4}
                            className="max-w-4xl font-medium text-3xl text-foreground leading-[1.15] tracking-tight md:text-5xl"
                        />
                    </div>

                    {/* Features */}
                    <div className="grid gap-x-12 gap-y-6 border-border border-t py-14 md:grid-cols-[200px_1fr] md:py-20">
                        <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-[0.2em] md:pt-2">
                            Everything inside
                        </h2>
                        <div className="flex max-w-2xl flex-wrap gap-2.5">
                            {FEATURES.map((feature) => (
                                <span
                                    key={feature.title}
                                    className="rounded-full border border-border px-4 py-2 text-foreground text-sm"
                                >
                                    {feature.title}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Principles */}
                    <div className="grid gap-x-12 gap-y-8 border-border border-t py-14 md:grid-cols-[200px_1fr] md:py-20">
                        <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-[0.2em] md:pt-2">
                            What I stand for
                        </h2>
                        <div className="grid max-w-2xl grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
                            {PRINCIPLES.map((principle) => (
                                <div key={principle.title}>
                                    <p className="mb-1.5 font-semibold text-foreground">
                                        {principle.title}
                                    </p>
                                    <p className="text-muted-foreground text-sm leading-relaxed">
                                        {principle.body}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* The maker */}
                    <div className="grid gap-x-12 gap-y-6 border-border border-t py-14 md:grid-cols-[200px_1fr] md:py-20">
                        <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-[0.2em] md:pt-2">
                            The maker
                        </h2>
                        <div className="flex max-w-2xl flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
                            <img
                                src="/authors/ahmed-arat.webp"
                                alt="Ahmed Arat"
                                className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                            />
                            <p className="text-foreground/90 text-lg leading-relaxed">
                                SilkChat is built by me, Ahmed. I read your feedback, I fix bugs (or
                                create them 😅), and I decide what gets built next. I'll always be
                                here to... add one more feature. Just one more, I promise.
                            </p>
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="flex flex-col items-start gap-4 border-border border-t py-16 sm:flex-row sm:items-center sm:justify-between md:py-20">
                        <p className="font-semibold text-2xl text-foreground tracking-tight">
                            Start a conversation.
                        </p>
                        <Link to="/personas/start">
                            <Button size="lg" className="gap-2">
                                Try it free
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
