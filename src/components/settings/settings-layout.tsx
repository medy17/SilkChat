import type { ReactNode } from "react"

interface SettingsLayoutProps {
    title: string
    description: string
    action?: ReactNode
    children: ReactNode
}

export function SettingsLayout({ title, description, action, children }: SettingsLayoutProps) {
    return (
        <div className="mx-auto max-w-4xl space-y-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <h2 className="font-semibold text-2xl tracking-tight">{title}</h2>
                    <p className="max-w-2xl text-muted-foreground text-sm">{description}</p>
                </div>
                {action ? <div className="shrink-0">{action}</div> : null}
            </div>
            {children}
        </div>
    )
}
