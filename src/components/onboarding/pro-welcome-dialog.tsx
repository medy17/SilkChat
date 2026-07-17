"use client"

import { ClaudeIcon, GeminiIcon, OpenAIIcon } from "@/components/brand-icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import {
    ArrowLeft,
    ArrowRight,
    Brain,
    Check,
    Code2,
    Crown,
    Eye,
    FileText,
    ImageIcon,
    Maximize2,
    Search,
    Sparkles,
    X
} from "lucide-react"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import { useCallback, useEffect, useState } from "react"

interface ProWelcomeDialogProps {
    isOpen: boolean
    onDismiss: () => void
}

const GALLERY_IMAGES = [
    "/gallery/opt/surreal_floating.webp",
    "/gallery/opt/cozy_nook.webp",
    "/gallery/opt/bioluminescent_jellyfin.webp",
    "/gallery/opt/isometric_miniature.webp",
    "/gallery/opt/portrait_wanderer.webp",
    "/gallery/opt/painted_fox.webp"
]

const capabilityIcons = [Brain, Eye, Code2, FileText]

function SlideHeading({
    title,
    description
}: {
    title: string
    description: React.ReactNode
}) {
    return (
        <div className="space-y-3 text-left">
            <DialogTitle className="font-semibold text-foreground text-xl tracking-tight">
                {title}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">{description}</DialogDescription>
        </div>
    )
}

function ImageToolSlide() {
    return (
        <div className="w-full max-w-lg space-y-6">
            <section
                className="relative mx-auto w-full max-w-md overflow-hidden rounded-xl border bg-card shadow-none"
                aria-label="Example SilkScreen image generation card"
            >
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-2.5">
                    <span className="flex min-w-0 items-center gap-1.5 rounded-md bg-background/75 px-2 py-1 font-medium text-foreground text-xs shadow-sm backdrop-blur-md">
                        <Sparkles className="size-3 shrink-0 text-primary" />
                        <span className="truncate">Floating City</span>
                    </span>
                    <span className="rounded-md bg-background/75 px-2 py-1 font-mono font-semibold text-[0.6875rem] text-model-cost-affordable shadow-sm backdrop-blur-md">
                        $··
                    </span>
                </div>

                <div className="space-y-2.5 p-4 pt-12">
                    <p className="text-foreground/90 text-sm leading-relaxed">
                        A vast floating city above a sea of clouds at sunrise, cinematic light,
                        intricate architecture, sweeping aerial perspective.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        <DemoChip icon={<Maximize2 className="size-3" />} label="16:9" />
                        <DemoChip icon={<ImageIcon className="size-3" />} label="Nano Banana 2" />
                        <DemoChip icon={<X className="size-3" />} label="2" />
                        <DemoChip icon={<Sparkles className="size-3" />} label="1K" />
                    </div>
                </div>

                <div className="border-t bg-muted/10 p-3">
                    <div className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary font-medium text-primary-foreground text-sm">
                        <Sparkles className="size-4" />
                        Generate
                    </div>
                </div>
            </section>

            <SlideHeading
                title="Welcome to Pro!"
                description={<>Ask for an image in any chat. Review it before generating.</>}
            />
        </div>
    )
}

function DemoChip({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <span className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-muted-foreground text-xs">
            {icon}
            {label}
        </span>
    )
}

function SilkScreenSlide() {
    return (
        <div className="w-full max-w-xl space-y-6">
            <div
                className="h-[17rem] overflow-hidden rounded-xl border bg-background shadow-none sm:h-[19rem]"
                aria-label="Simplified SilkScreen generator and AI Library example"
            >
                <div className="border-b bg-sidebar p-2.5 text-sidebar-foreground sm:p-3">
                    <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-[0.625rem] text-muted-foreground uppercase tracking-wider">
                        <Sparkles className="size-3" /> Prompt
                    </div>
                    <div className="truncate rounded-md bg-muted/30 px-2 py-1.5 text-[0.6875rem]">
                        A bioluminescent jellyfish drifting through a dark ocean...
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate rounded-md bg-primary/15 px-2 py-1.5 font-medium text-[0.625rem] text-primary">
                            Grok Imagine Image Pro · 2 variants
                        </span>
                        <span className="flex h-7 shrink-0 items-center gap-1 rounded-md bg-primary px-2 font-medium text-[0.625rem] text-primary-foreground">
                            <Sparkles className="size-3" /> Generate
                        </span>
                    </div>
                </div>

                <div className="p-2.5 sm:p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                        <div>
                            <div className="font-bold text-sm">Library</div>
                            <div className="text-[0.5625rem] text-muted-foreground">
                                Every result, ready to reuse
                            </div>
                        </div>
                        <Search className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                        {GALLERY_IMAGES.slice(0, 6).map((src) => (
                            <img
                                key={src}
                                src={src}
                                alt=""
                                className="h-14 w-full rounded-md object-cover sm:h-16"
                            />
                        ))}
                    </div>
                </div>
            </div>

            <SlideHeading
                title="Create in SilkScreen"
                description="Generate several images at a time then manage every result in your Library."
            />
        </div>
    )
}

function CapabilityIcons({ emphasized = false }: { emphasized?: boolean }) {
    return (
        <div className="flex gap-1">
            {capabilityIcons.map((Icon, index) => (
                <span
                    key={index}
                    className={`grid size-7 place-items-center rounded-md border text-muted-foreground ${
                        emphasized ? "border-transparent bg-accent text-accent-foreground" : ""
                    }`}
                >
                    <Icon className="size-3.5" />
                </span>
            ))}
        </div>
    )
}

function ProModelsSlide() {
    return (
        <div className="w-full max-w-xl space-y-6">
            <div
                className="overflow-hidden rounded-xl border bg-popover shadow-none"
                aria-label="Example Pro model selector"
            >
                <div className="bg-muted/50 p-3 pb-2">
                    <div className="flex h-9 items-center gap-2 rounded-md bg-secondary/60 px-3 text-muted-foreground text-sm">
                        <Search className="size-4" /> Search models...
                    </div>
                </div>

                <div className="hidden h-[16rem] grid-cols-[4.5rem_minmax(0,1fr)] sm:grid">
                    <div className="border-r bg-muted/50 p-2">
                        <div className="space-y-1">
                            <ProviderIcon icon={<OpenAIIcon className="size-5" />} />
                            <ProviderIcon active icon={<ClaudeIcon className="size-5" />} />
                            <ProviderIcon icon={<GeminiIcon className="size-5" />} />
                        </div>
                    </div>

                    <div className="min-w-0 p-3">
                        <div className="mb-2 flex items-end justify-between">
                            <div>
                                <div className="font-medium text-sm">Anthropic</div>
                                <div className="text-muted-foreground text-xs">9 available</div>
                            </div>
                            <span className="inline-flex items-center gap-1 text-primary text-xs">
                                <Crown className="size-3.5" /> Pro unlocked
                            </span>
                        </div>

                        <div className="space-y-2">
                            <DemoModelCard
                                selected
                                name="Claude Opus 4.8"
                                description="Highest-end Claude model for complex reasoning and agentic work"
                            />
                            <DemoModelCard
                                name="Claude Sonnet 4.6"
                                description="Fast, capable Claude model for everyday work and coding"
                            />
                        </div>
                    </div>
                </div>

                <div className="sm:hidden">
                    <div className="flex border-b bg-muted/50 px-2 pt-1">
                        <MobileProviderTab
                            label="OpenAI"
                            icon={<OpenAIIcon className="size-4" />}
                        />
                        <MobileProviderTab
                            active
                            label="Anthropic"
                            icon={<ClaudeIcon className="size-4" />}
                        />
                        <MobileProviderTab
                            label="Gemini"
                            icon={<GeminiIcon className="size-4" />}
                        />
                    </div>
                    <div className="p-2.5">
                        <div className="mb-2 flex items-center justify-between">
                            <span className="font-medium text-xs">Anthropic</span>
                            <span className="inline-flex items-center gap-1 text-[0.625rem] text-primary">
                                <Crown className="size-3" /> Pro unlocked
                            </span>
                        </div>
                        <DemoModelCard
                            selected
                            name="Claude Opus 4.8"
                            description="Highest-end Claude model for complex reasoning and agentic work"
                        />
                    </div>
                </div>
            </div>

            <SlideHeading
                title="Use our strongest models"
                description="Pro unlocks the best models in the world, at your fingertips."
            />
        </div>
    )
}

function MobileProviderTab({
    active = false,
    label,
    icon
}: {
    active?: boolean
    label: string
    icon: React.ReactNode
}) {
    return (
        <div
            className={`flex min-w-0 flex-1 items-center justify-center gap-1 border-x border-t px-1 py-2 text-[0.625rem] ${
                active
                    ? "border-border bg-popover text-foreground"
                    : "border-transparent text-muted-foreground"
            }`}
        >
            {icon}
            <span className="truncate">{label}</span>
        </div>
    )
}

function ProviderIcon({ active = false, icon }: { active?: boolean; icon: React.ReactNode }) {
    return (
        <div
            className={`relative grid h-14 place-items-center rounded-lg border transition-colors ${
                active
                    ? "border-border bg-popover text-foreground shadow-sm"
                    : "border-transparent text-muted-foreground"
            }`}
        >
            {icon}
        </div>
    )
}

function DemoModelCard({
    selected = false,
    name,
    description
}: {
    selected?: boolean
    name: string
    description: string
}) {
    return (
        <div
            className={`rounded-xl border bg-background/60 p-3 ${
                selected ? "border-primary/50 bg-primary/5 shadow-sm ring-1 ring-primary/20" : ""
            }`}
        >
            <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-sm">{name}</span>
                        <Crown className="size-3.5 shrink-0 text-primary" />
                        {selected && <Check className="size-4 shrink-0 text-primary" />}
                    </div>
                    <p className="mt-1 line-clamp-2 text-muted-foreground text-xs">{description}</p>
                </div>
                <CapabilityIcons emphasized={selected} />
            </div>
        </div>
    )
}

const PRO_WELCOME_SLIDES = [ImageToolSlide, SilkScreenSlide, ProModelsSlide]

export function ProWelcomeDialog({ isOpen, onDismiss }: ProWelcomeDialogProps) {
    const [currentStep, setCurrentStep] = useState(0)
    const CurrentSlide = PRO_WELCOME_SLIDES[currentStep]

    useEffect(() => {
        if (isOpen) setCurrentStep(0)
    }, [isOpen])

    const handleNext = useCallback(() => {
        if (currentStep < PRO_WELCOME_SLIDES.length - 1) {
            setCurrentStep((step) => step + 1)
        } else {
            onDismiss()
        }
    }, [currentStep, onDismiss])

    const handlePrevious = useCallback(() => {
        setCurrentStep((step) => Math.max(0, step - 1))
    }, [])

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onDismiss()}>
            <DialogContent
                className="w-[95vw] max-w-2xl border-0 bg-transparent p-0 shadow-none sm:w-full"
                showCloseButton={false}
            >
                <MotionConfig transition={{ type: "spring", duration: 0.4, bounce: 0.1 }}>
                    <Card className="inset-shadow-sm w-full max-w-none overflow-hidden border-2 bg-card pt-3 pb-5">
                        <div className="relative overflow-hidden">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentStep}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <CardContent className="flex flex-col items-center px-4 py-4 sm:px-6">
                                        <CurrentSlide />
                                    </CardContent>
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        <CardFooter className="relative flex items-center justify-between border-t-2 px-4 pt-4 sm:px-6">
                            {currentStep > 0 ? (
                                <Button
                                    variant="secondary"
                                    onClick={handlePrevious}
                                    className="h-8 gap-2 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm"
                                >
                                    <ArrowLeft className="size-3 sm:size-4" />
                                    <span className="hidden sm:inline">Previous</span>
                                    <span className="sm:hidden">Prev</span>
                                </Button>
                            ) : (
                                <div className="w-8" />
                            )}

                            <div className="absolute right-1/2 flex translate-x-1/2 gap-1">
                                {PRO_WELCOME_SLIDES.map((_, index) => (
                                    <div
                                        key={index}
                                        className={`h-2 w-2 rounded-full transition-all duration-300 ${
                                            index === currentStep
                                                ? "w-6 bg-primary"
                                                : index < currentStep
                                                  ? "bg-primary/60"
                                                  : "bg-muted-foreground/20"
                                        }`}
                                    />
                                ))}
                            </div>

                            <Button
                                onClick={handleNext}
                                className="h-8 gap-2 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm"
                            >
                                {currentStep === PRO_WELCOME_SLIDES.length - 1 ? (
                                    <>
                                        <span className="hidden sm:inline">Start exploring</span>
                                        <span className="sm:hidden">Start</span>
                                    </>
                                ) : (
                                    "Next"
                                )}
                                {currentStep === PRO_WELCOME_SLIDES.length - 1 ? (
                                    <Sparkles className="size-3 sm:size-4" />
                                ) : (
                                    <ArrowRight className="size-3 sm:size-4" />
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                </MotionConfig>
            </DialogContent>
        </Dialog>
    )
}
