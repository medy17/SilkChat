import { ComputerDetailItem, ComputerDisclosure } from "@/components/computer-ui"
import { Skeleton } from "@/components/ui/skeleton"
import { ExternalLink } from "lucide-react"
import type { ReactNode } from "react"
import type { SkillAudit, SkillSourceInfo } from "./skill-types"

export const formatSkillDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    })

/** A link to where a skill lives on GitHub: its folder when known, else its repository. */
export function SkillRepositoryLink({
    repo,
    path,
    commit
}: {
    repo: string
    path?: string
    commit?: string
}) {
    return (
        <a
            href={`https://github.com/${repo}${path ? `/tree/${commit ?? "HEAD"}/${path}` : ""}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1 font-mono text-muted-foreground text-xs transition-colors hover:text-foreground"
        >
            <span className="truncate">{repo}</span>
            <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
        </a>
    )
}

export function SkillSource({ source }: { source: SkillSourceInfo }) {
    if (source.kind === "upload") {
        return (
            <span className="font-mono text-muted-foreground text-xs">
                {source.fileName ?? "Uploaded"}
            </span>
        )
    }
    return <SkillRepositoryLink repo={source.repo} path={source.path} commit={source.commit} />
}

/** What someone needs to know before a skill is on: only problems and requirements. */
export function SkillNotes({
    runsCode,
    audits
}: {
    runsCode: boolean
    audits?: SkillAudit[] | null
}) {
    const flagged = (audits ?? [])
        .filter((audit) => audit.status === "flagged")
        .map((audit) => audit.provider)
    if (!runsCode && audits !== null && flagged.length === 0) return null

    return (
        <div className="space-y-1 text-sm">
            {flagged.length > 0 && (
                <p className="text-destructive">Flagged by {flagged.join(" and ")}.</p>
            )}
            {audits === null && (
                <p className="text-warning">
                    Nobody has checked this skill. Read its instructions before adding it.
                </p>
            )}
            {runsCode && (
                <p className="text-muted-foreground">
                    Comes with scripts, which only run with Code Execution on.
                </p>
            )}
        </div>
    )
}

/** SKILL.md as written. Undefined while it loads. */
export function SkillInstructions({ text }: { text: string | undefined }) {
    if (text === undefined) return <Skeleton className="h-24 w-full" />
    return (
        <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-[var(--radius-lg)] border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
            {text}
        </pre>
    )
}

/** Everything else about a skill, one disclosure each. `children` are the Details rows. */
export function SkillFacts({
    instructions,
    instructionsOpen = false,
    files,
    children
}: {
    instructions: ReactNode
    instructionsOpen?: boolean
    files: string[]
    children: ReactNode
}) {
    return (
        <div className="space-y-3">
            <ComputerDisclosure label="Instructions" defaultOpen={instructionsOpen}>
                {instructions}
            </ComputerDisclosure>
            <ComputerDisclosure label="Files">
                <ul className="max-h-60 space-y-1 overflow-y-auto font-mono text-xs">
                    {files.map((file) => (
                        <li key={file} className="break-all">
                            {file}
                        </li>
                    ))}
                </ul>
            </ComputerDisclosure>
            <ComputerDisclosure label="Details">
                <dl className="max-w-md text-xs">{children}</dl>
            </ComputerDisclosure>
        </div>
    )
}

export function SkillAuditItem({ audits }: { audits: SkillAudit[] | null | undefined }) {
    if (audits === undefined) return null
    const passed = (audits ?? [])
        .filter((audit) => audit.status === "pass")
        .map((audit) => audit.provider)
    return (
        <ComputerDetailItem
            label="Checked by"
            value={passed.length > 0 ? passed.join(", ") : "Nobody yet"}
        />
    )
}
