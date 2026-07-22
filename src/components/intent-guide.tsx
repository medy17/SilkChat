import type { Doc } from "@/convex/_generated/dataModel"
import type { UploadedFile } from "@/lib/chat-store"
import {
    type ComposerIntentId,
    IMAGE_IDEA_RECIPES,
    type IntentGuideStage,
    WEB_SEARCH_RECIPES,
    resolveAnalysisAttachmentKind
} from "@/lib/composer-intents"
import { getOptimizedGeneratedImageUrl } from "@/lib/generated-image-urls"
import { type WebTrendSuggestion, buildTrendingSearchPrompt } from "@/lib/google-trends"
import { cn } from "@/lib/utils"
import {
    ArrowLeft,
    BarChart3,
    Braces,
    Code,
    FileSearch,
    FileSpreadsheet,
    FileText,
    Globe,
    Image as ImageIcon,
    Layers3,
    Loader2,
    Paperclip,
    SearchCheck,
    Sparkles,
    TrendingUp,
    Upload,
    X
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import type { ComponentType, SVGProps } from "react"

type Icon = ComponentType<SVGProps<SVGSVGElement>>
type RecentImage = Pick<Doc<"generatedImages">, "_id" | "storageKey" | "prompt" | "aspectRatio">

type IntentAvailability = {
    image: boolean
    web: boolean
    analysis: boolean
}

type IntentGuideProps = {
    stage: IntentGuideStage
    availability: IntentAvailability
    attachments: UploadedFile[]
    recentImages: RecentImage[]
    attachingImageKey?: string
    webTrends: WebTrendSuggestion[]
    webTrendsLoading: boolean
    onSelectIntent: (intent: ComposerIntentId) => void
    onClearIntent: () => void
    onChoosePrompt: (prompt: string) => void
    onAppendPrompt: (text: string) => void
    onUpload: () => void
    onChooseRecentImage: (image: RecentImage) => void
}

const intentOptions: Array<{
    id: ComposerIntentId
    label: string
    icon: Icon
}> = [
    { id: "image", label: "Create an image", icon: ImageIcon },
    { id: "web", label: "Search the web", icon: Globe },
    { id: "analysis", label: "Analyze files", icon: Code }
]

const imageRefinements = [
    {
        label: "Restyle it",
        icon: Sparkles,
        text: " Restyle the attached reference while preserving its main subject and composition."
    },
    {
        label: "Create variations",
        icon: Layers3,
        text: " Create several distinct variations that preserve the core idea of the attached reference."
    },
    {
        label: "Recompose",
        icon: ImageIcon,
        text: " Recompose the attached reference with a stronger focal point and more intentional framing."
    }
] as const

const analysisActions = {
    spreadsheet: [
        {
            label: "Find the story",
            icon: FileSearch,
            prompt: "Analyze the attached spreadsheet. Identify the most important patterns, anomalies, and actionable takeaways."
        },
        {
            label: "Build charts",
            icon: BarChart3,
            prompt: "Analyze the attached spreadsheet and create the most useful charts for understanding its key trends."
        },
        {
            label: "Clean the data",
            icon: FileSpreadsheet,
            prompt: "Inspect the attached spreadsheet for missing values, inconsistent formats, duplicates, and suspicious records. Recommend a cleaning plan."
        }
    ],
    document: [
        {
            label: "Summarize",
            icon: FileText,
            prompt: "Summarize the attached document with its key arguments, evidence, decisions, and open questions."
        },
        {
            label: "Extract details",
            icon: FileSearch,
            prompt: "Extract the important facts, dates, people, requirements, and action items from the attached document."
        },
        {
            label: "Challenge it",
            icon: SearchCheck,
            prompt: "Critically review the attached document. Identify weak assumptions, missing evidence, contradictions, and unanswered questions."
        }
    ],
    code: [
        {
            label: "Review the code",
            icon: SearchCheck,
            prompt: "Review the attached code for correctness, maintainability, security risks, and concrete improvements."
        },
        {
            label: "Debug it",
            icon: Braces,
            prompt: "Debug the attached code. Trace likely failure paths, explain the root cause, and propose a focused fix."
        },
        {
            label: "Write tests",
            icon: Code,
            prompt: "Analyze the attached code and propose high-value tests for its important behavior and edge cases."
        }
    ],
    image: [
        {
            label: "Inspect the image",
            icon: ImageIcon,
            prompt: "Analyze the attached image in detail and describe its important visual content, structure, and notable details."
        },
        {
            label: "Extract information",
            icon: FileSearch,
            prompt: "Extract and organize all useful information visible in the attached image."
        },
        {
            label: "Critique the design",
            icon: SearchCheck,
            prompt: "Critique the attached image's composition, hierarchy, clarity, and visual design. Suggest specific improvements."
        }
    ],
    mixed: [
        {
            label: "Compare files",
            icon: Layers3,
            prompt: "Compare the attached files. Identify agreements, differences, conflicts, and information that appears in only one source."
        },
        {
            label: "Synthesize",
            icon: FileSearch,
            prompt: "Synthesize the attached files into one coherent brief with the most important findings and action items."
        },
        {
            label: "Find inconsistencies",
            icon: SearchCheck,
            prompt: "Cross-check the attached files and identify contradictions, mismatched values, and missing context."
        }
    ]
} as const

const focusClassName =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"

function GuideHeader({
    title,
    onBack,
    onClose
}: {
    title: string
    onBack?: () => void
    onClose?: () => void
}) {
    return (
        <div className="flex min-h-8 items-center gap-2 px-1">
            {onBack && (
                <button
                    type="button"
                    onClick={onBack}
                    className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-xl)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                        focusClassName
                    )}
                    aria-label="Back to start options"
                >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                </button>
            )}
            <h2 className="min-w-0 flex-1 truncate font-medium text-foreground text-sm sm:text-base">
                {title}
            </h2>
            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-xl)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                        focusClassName
                    )}
                    aria-label="Close intent guide"
                >
                    <X className="size-4" aria-hidden="true" />
                </button>
            )}
        </div>
    )
}

function UploadCard({ label, onClick }: { label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "group flex h-32 w-28 shrink-0 snap-start flex-col items-center justify-center gap-3 border border-border bg-secondary/45 p-3 text-center transition-colors hover:bg-secondary sm:h-36 sm:w-32 [@media(max-height:760px)]:h-24 [@media(max-height:760px)]:w-24",
                focusClassName
            )}
            style={{ borderRadius: "var(--radius-lg)" }}
        >
            <span className="flex size-9 items-center justify-center rounded-[var(--radius-xl)] bg-background/70 text-muted-foreground transition-colors group-hover:text-foreground">
                <Upload className="size-5" aria-hidden="true" />
            </span>
            <span className="text-balance font-medium text-xs leading-tight">{label}</span>
        </button>
    )
}

function ImageRecipeCard({
    label,
    image,
    onClick
}: {
    label: string
    image: string
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "group relative h-32 w-28 shrink-0 snap-start overflow-hidden border border-border bg-secondary text-left shadow-sm sm:h-36 sm:w-32 [@media(max-height:760px)]:h-24 [@media(max-height:760px)]:w-24",
                focusClassName
            )}
            style={{ borderRadius: "var(--radius-lg)" }}
        >
            <img
                src={image}
                alt=""
                className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/90 via-foreground/55 to-transparent px-2 pt-8 pb-2 font-medium text-background text-xs leading-tight">
                {label}
            </span>
        </button>
    )
}

function RecentImageCard({
    image,
    loading,
    onClick
}: {
    image: RecentImage
    loading: boolean
    onClick: () => void
}) {
    const src = getOptimizedGeneratedImageUrl({
        storageKey: image.storageKey,
        aspectRatio: image.aspectRatio,
        longEdge: 256,
        quality: 72
    })

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={loading}
            className={cn(
                "group relative h-32 w-28 shrink-0 snap-start overflow-hidden border border-border bg-secondary text-left shadow-sm disabled:cursor-wait sm:h-36 sm:w-32 [@media(max-height:760px)]:h-24 [@media(max-height:760px)]:w-24",
                focusClassName
            )}
            style={{ borderRadius: "var(--radius-lg)" }}
        >
            <img
                src={src}
                alt=""
                className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/90 via-foreground/55 to-transparent px-2 pt-8 pb-2 font-medium text-background text-xs leading-tight">
                Recent image
            </span>
            {loading && (
                <span className="absolute inset-0 flex items-center justify-center bg-background/65 backdrop-blur-sm">
                    <Loader2 className="size-5 animate-spin text-foreground" aria-hidden="true" />
                </span>
            )}
        </button>
    )
}

function ActionButton({
    icon: Icon,
    label,
    onClick
}: {
    icon: Icon
    label: string
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex min-h-11 items-center gap-3 border border-border bg-secondary/35 px-3 py-2.5 text-left font-medium text-sm transition-colors hover:bg-secondary",
                focusClassName
            )}
            style={{ borderRadius: "var(--radius-md)" }}
        >
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>{label}</span>
        </button>
    )
}

export function IntentGuide({
    stage,
    availability,
    attachments,
    recentImages,
    attachingImageKey,
    webTrends,
    webTrendsLoading,
    onSelectIntent,
    onClearIntent,
    onChoosePrompt,
    onAppendPrompt,
    onUpload,
    onChooseRecentImage
}: IntentGuideProps) {
    const attachmentKind = resolveAnalysisAttachmentKind(attachments)
    const visibleIntents = intentOptions.filter((intent) => availability[intent.id])
    const webSearchSuggestions: Array<{
        id: string
        label: string
        prompt: string
        icon: Icon
    }> =
        webTrends.length > 0
            ? webTrends.slice(0, 4).map((trend) => ({
                  id: trend.query,
                  label: trend.query,
                  prompt: buildTrendingSearchPrompt(trend.query),
                  icon: TrendingUp
              }))
            : WEB_SEARCH_RECIPES.map((recipe) => ({ ...recipe, icon: SearchCheck }))

    return (
        <motion.section
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative mx-auto mt-3 w-full px-2"
            aria-label="Start with a capability"
        >
            <div aria-hidden="true" className="invisible flex w-full flex-col gap-1">
                {visibleIntents.map(({ id }) => (
                    <div key={id} className="px-3 py-2 text-sm">
                        &nbsp;
                    </div>
                ))}
                <div className="px-3 py-2 text-sm">&nbsp;</div>
            </div>
            <AnimatePresence initial={false} mode="wait">
                {stage === "idle" ? (
                    <motion.div
                        key="intent-idle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-x-2 top-0 flex flex-col gap-1"
                    >
                        {visibleIntents.map(({ id, label, icon: Icon }) => (
                            <button
                                key={id}
                                type="button"
                                onClick={() => onSelectIntent(id)}
                                className={cn(
                                    "flex w-full items-center gap-3 px-3 py-2 text-left text-foreground text-sm transition-colors hover:bg-secondary/50",
                                    focusClassName
                                )}
                                style={{ borderRadius: "var(--radius-md)" }}
                            >
                                <Icon
                                    className="size-4 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <span>{label}</span>
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={onUpload}
                            className={cn(
                                "flex w-full items-center gap-3 px-3 py-2 text-left text-foreground text-sm transition-colors hover:bg-secondary/50",
                                focusClassName
                            )}
                            style={{ borderRadius: "var(--radius-md)" }}
                        >
                            <Paperclip
                                className="-rotate-45 size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <span>Attach a file</span>
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        key={stage}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className="absolute inset-x-2 top-0"
                    >
                        {stage === "image-explore" && (
                            <>
                                <GuideHeader
                                    title="Explore image ideas"
                                    onBack={onClearIntent}
                                    onClose={onClearIntent}
                                />
                                <div className="mt-2 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                    <UploadCard label="Upload a reference" onClick={onUpload} />
                                    {IMAGE_IDEA_RECIPES.map((recipe) => (
                                        <ImageRecipeCard
                                            key={recipe.id}
                                            label={recipe.label}
                                            image={recipe.image}
                                            onClick={() => onChoosePrompt(recipe.prompt)}
                                        />
                                    ))}
                                </div>
                            </>
                        )}

                        {stage === "image-reference" && (
                            <>
                                <GuideHeader
                                    title="Add a reference image"
                                    onBack={onClearIntent}
                                    onClose={onClearIntent}
                                />
                                <div className="mt-2 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                    <UploadCard label="Upload a photo" onClick={onUpload} />
                                    {recentImages.map((image) => (
                                        <RecentImageCard
                                            key={image._id}
                                            image={image}
                                            loading={attachingImageKey === image.storageKey}
                                            onClick={() => onChooseRecentImage(image)}
                                        />
                                    ))}
                                </div>
                            </>
                        )}

                        {stage === "image-refine" && (
                            <>
                                <GuideHeader
                                    title="Shape the result"
                                    onBack={onClearIntent}
                                    onClose={onClearIntent}
                                />
                                <div className="mt-2 grid grid-cols-1 gap-2 px-1 sm:grid-cols-3">
                                    {imageRefinements.map((action) => (
                                        <ActionButton
                                            key={action.label}
                                            icon={action.icon}
                                            label={action.label}
                                            onClick={() => onAppendPrompt(action.text)}
                                        />
                                    ))}
                                </div>
                            </>
                        )}

                        {stage === "web-explore" && (
                            <>
                                <GuideHeader
                                    title={
                                        webTrends.length > 0
                                            ? "Trending on Google"
                                            : "Start a web search"
                                    }
                                    onBack={onClearIntent}
                                    onClose={onClearIntent}
                                />
                                <div className="mt-1 grid gap-0.5 px-1 sm:grid-cols-2 sm:gap-2">
                                    {webTrendsLoading && webTrends.length === 0 ? (
                                        <div className="col-span-full flex min-h-11 items-center gap-3 px-3 py-2 text-muted-foreground text-sm">
                                            <Loader2
                                                className="size-4 animate-spin"
                                                aria-hidden="true"
                                            />
                                            <span>Finding what’s trending…</span>
                                        </div>
                                    ) : (
                                        webSearchSuggestions.map(
                                            ({ id, label, prompt, icon: SuggestionIcon }) => (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => onChoosePrompt(prompt)}
                                                    className={cn(
                                                        "flex min-h-11 items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/55",
                                                        focusClassName
                                                    )}
                                                    style={{ borderRadius: "var(--radius-md)" }}
                                                >
                                                    <SuggestionIcon
                                                        className="size-4 shrink-0 text-muted-foreground"
                                                        aria-hidden="true"
                                                    />
                                                    <span className="line-clamp-2 first-letter:uppercase">
                                                        {label}
                                                    </span>
                                                </button>
                                            )
                                        )
                                    )}
                                </div>
                            </>
                        )}

                        {stage === "web-compose" && (
                            <div className="flex items-center gap-3 px-2 py-1 text-muted-foreground text-sm">
                                <Globe className="size-4 shrink-0" aria-hidden="true" />
                                <span className="flex-1">
                                    Web search is ready. Add the details you care about.
                                </span>
                                <button
                                    type="button"
                                    onClick={onClearIntent}
                                    className={cn(
                                        "flex size-8 items-center justify-center rounded-[var(--radius-xl)] hover:bg-secondary hover:text-foreground",
                                        focusClassName
                                    )}
                                    aria-label="Close intent guide"
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </button>
                            </div>
                        )}

                        {stage === "analysis-source" && (
                            <>
                                <GuideHeader
                                    title="What should we analyze?"
                                    onBack={onClearIntent}
                                    onClose={onClearIntent}
                                />
                                <div className="mt-2 grid grid-cols-2 gap-2 px-1 sm:grid-cols-4">
                                    <ActionButton
                                        icon={FileSpreadsheet}
                                        label="Spreadsheet"
                                        onClick={onUpload}
                                    />
                                    <ActionButton
                                        icon={FileText}
                                        label="Document"
                                        onClick={onUpload}
                                    />
                                    <ActionButton
                                        icon={Braces}
                                        label="Code file"
                                        onClick={onUpload}
                                    />
                                    <ActionButton
                                        icon={Layers3}
                                        label="Compare files"
                                        onClick={onUpload}
                                    />
                                </div>
                            </>
                        )}

                        {stage === "analysis-actions" && attachmentKind && (
                            <>
                                <GuideHeader
                                    title={
                                        attachments.length > 1
                                            ? "Work across these files"
                                            : "Explore this file"
                                    }
                                    onBack={onClearIntent}
                                    onClose={onClearIntent}
                                />
                                <div className="mt-2 grid grid-cols-1 gap-2 px-1 sm:grid-cols-3">
                                    {analysisActions[attachmentKind].map((action) => (
                                        <ActionButton
                                            key={action.label}
                                            icon={action.icon}
                                            label={action.label}
                                            onClick={() => onChoosePrompt(action.prompt)}
                                        />
                                    ))}
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.section>
    )
}
