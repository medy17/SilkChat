import { Codeblock } from "@/components/codeblock"
import { HighlightedCodeblock } from "@/components/highlighted-codeblock"
import type { MessageCodeExecution } from "@/lib/message-code-executions"
import { cn } from "@/lib/utils"
import { Check, ChevronDown, CircleAlert, Clock3, Loader2, SquareTerminal } from "lucide-react"
import { memo, useEffect, useMemo, useState } from "react"

const formatDuration = (durationMs: number) => {
    if (durationMs < 1_000) return `${Math.round(durationMs)} ms`
    return `${(durationMs / 1_000).toFixed(durationMs < 10_000 ? 1 : 0)} s`
}

const getLanguageLabel = (language?: MessageCodeExecution["input"]["language"]) => {
    if (language === "javascript") return "JavaScript"
    if (language === "python") return "Python"
    return "Code"
}

const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex min-w-0 items-baseline justify-between gap-4 py-1.5">
        <dt className="shrink-0 text-muted-foreground">{label}</dt>
        <dd className="min-w-0 truncate text-right text-foreground">{value}</dd>
    </div>
)

const ExecutionStep = memo(({ execution }: { execution: MessageCodeExecution }) => {
    const [isOpen, setIsOpen] = useState(execution.status === "running")
    const [showDetails, setShowDetails] = useState(false)
    const { input, output } = execution
    const language = input.language ?? output?.language
    const dependencies = input.dependencies.length
        ? input.dependencies
        : (output?.dependencies ?? [])
    const error = execution.errorText ?? output?.error
    const hasOutput = Boolean(output?.stdout || output?.stderr || error)
    const hasDetails = Boolean(
        output?.phase ||
            output?.sandboxMode ||
            input.sandboxMode ||
            output?.networkAccess ||
            typeof output?.exitCode === "number" ||
            typeof output?.durationMs === "number" ||
            typeof input.timeoutMs === "number" ||
            dependencies.length ||
            output?.outputTruncated ||
            output?.artifacts.length ||
            output?.artifactErrors.length
    )

    useEffect(() => {
        if (execution.status === "running") setIsOpen(true)
    }, [execution.status])

    return (
        <section className="border-border/70 border-t first:border-t-0">
            <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-3 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
                onClick={() => setIsOpen((open) => !open)}
                aria-expanded={isOpen}
            >
                {execution.status === "running" ? (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                ) : execution.status === "failed" ? (
                    <CircleAlert className="size-3.5 shrink-0 text-destructive" />
                ) : (
                    <Check className="size-3.5 shrink-0 text-primary" />
                )}
                <span className="min-w-0 flex-1 truncate font-medium text-sm">
                    {execution.title}
                </span>
                {typeof output?.durationMs === "number" && (
                    <span className="flex shrink-0 items-center gap-1 text-muted-foreground text-xs">
                        <Clock3 className="size-3" />
                        {formatDuration(output.durationMs)}
                    </span>
                )}
                <ChevronDown
                    className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180"
                    )}
                />
            </button>

            {isOpen && (
                <div className="space-y-4 border-border/70 border-t bg-background/35 px-3 py-4">
                    {input.code ? (
                        <section>
                            <h4 className="mb-2 font-medium text-foreground text-xs uppercase tracking-wide">
                                Code
                            </h4>
                            <HighlightedCodeblock
                                source={input.code}
                                language={language ?? "plaintext"}
                            />
                        </section>
                    ) : execution.status === "running" ? (
                        <p className="m-0 text-muted-foreground text-sm">Preparing execution…</p>
                    ) : null}

                    {hasOutput && (
                        <section className="space-y-3">
                            <h4 className="mb-2 font-medium text-foreground text-xs uppercase tracking-wide">
                                Output
                            </h4>
                            {output?.stdout && (
                                <Codeblock className="language-plaintext" default={{ wrap: true }}>
                                    {output.stdout}
                                </Codeblock>
                            )}
                            {output?.stderr && (
                                <div>
                                    <p className="mb-1.5 text-destructive text-xs">
                                        Standard error
                                    </p>
                                    <Codeblock
                                        className="language-plaintext"
                                        default={{ wrap: true }}
                                    >
                                        {output.stderr}
                                    </Codeblock>
                                </div>
                            )}
                            {error && (
                                <p className="m-0 rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-sm">
                                    {error}
                                </p>
                            )}
                        </section>
                    )}

                    {hasDetails && (
                        <section>
                            <button
                                type="button"
                                className="flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
                                onClick={() => setShowDetails((shown) => !shown)}
                                aria-expanded={showDetails}
                            >
                                <ChevronDown
                                    className={cn(
                                        "size-3.5 transition-transform",
                                        showDetails && "rotate-180"
                                    )}
                                />
                                Details
                            </button>
                            {showDetails && (
                                <dl className="mt-2 divide-y divide-border/60 rounded-[var(--radius-md)] border border-border/70 bg-muted/25 px-3 text-xs">
                                    <DetailItem
                                        label="Language"
                                        value={getLanguageLabel(language)}
                                    />
                                    {typeof output?.exitCode === "number" && (
                                        <DetailItem label="Exit code" value={output.exitCode} />
                                    )}
                                    {(output?.sandboxMode ?? input.sandboxMode) && (
                                        <DetailItem
                                            label="Workspace"
                                            value={output?.sandboxMode ?? input.sandboxMode}
                                        />
                                    )}
                                    {output?.networkAccess && (
                                        <DetailItem label="Network" value={output.networkAccess} />
                                    )}
                                    {typeof input.timeoutMs === "number" && (
                                        <DetailItem
                                            label="Timeout"
                                            value={formatDuration(input.timeoutMs)}
                                        />
                                    )}
                                    {dependencies.length > 0 && (
                                        <DetailItem
                                            label="Dependencies"
                                            value={dependencies.join(", ")}
                                        />
                                    )}
                                    {output?.phase && (
                                        <DetailItem label="Phase" value={output.phase} />
                                    )}
                                    {output?.outputTruncated && (
                                        <DetailItem label="Output" value="Truncated" />
                                    )}
                                    {output && output.artifacts.length > 0 && (
                                        <DetailItem
                                            label="Artifacts"
                                            value={output.artifacts.length}
                                        />
                                    )}
                                    {output && output.artifactErrors.length > 0 && (
                                        <DetailItem
                                            label="Artifact errors"
                                            value={output.artifactErrors.length}
                                        />
                                    )}
                                </dl>
                            )}
                        </section>
                    )}
                </div>
            )}
        </section>
    )
})

ExecutionStep.displayName = "ExecutionStep"

export const CodeExecutionGroupRenderer = memo(
    ({ executions }: { executions: MessageCodeExecution[] }) => {
        const [isOpen, setIsOpen] = useState(false)
        const summary = useMemo(() => {
            const running = executions.filter((execution) => execution.status === "running").length
            const failed = executions.filter((execution) => execution.status === "failed").length
            return { running, failed }
        }, [executions])

        if (executions.length === 0) return null

        return (
            <div className="not-prose mb-6 w-full">
                <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-2 text-left"
                    onClick={() => setIsOpen((open) => !open)}
                    aria-expanded={isOpen}
                >
                    <SquareTerminal className="size-4 shrink-0 text-primary" />
                    <span className="font-medium text-primary">Code Execution</span>
                    {summary.running > 0 && (
                        <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                    )}
                    <span className="ml-auto text-muted-foreground text-xs">
                        {executions.length} {executions.length === 1 ? "step" : "steps"}
                        {summary.failed > 0 ? ` · ${summary.failed} failed` : ""}
                    </span>
                    <ChevronDown
                        className={cn(
                            "size-4 shrink-0 text-foreground transition-transform",
                            isOpen && "rotate-180"
                        )}
                    />
                </button>

                {isOpen && (
                    <div className="mt-4 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-muted/25">
                        {executions.map((execution) => (
                            <ExecutionStep key={execution.toolCallId} execution={execution} />
                        ))}
                    </div>
                )}
            </div>
        )
    }
)

CodeExecutionGroupRenderer.displayName = "CodeExecutionGroupRenderer"
