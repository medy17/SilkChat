import { SettingsBackButton } from "@/components/settings/settings-back-button"
import { SettingsLayout } from "@/components/settings/settings-layout"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/convex/_generated/api"
import { useSession } from "@/hooks/auth-hooks"
import { cn } from "@/lib/utils"
import { useConvexQuery } from "@convex-dev/react-query"
import { Link, Outlet, createLazyFileRoute, useLocation, useNavigate } from "@tanstack/react-router"
import {
    BarChart3,
    Bot,
    BrainCircuit,
    CreditCard,
    PaintBucket,
    Paperclip,
    ShieldCheck,
    SlidersHorizontal,
    User,
    Users
} from "lucide-react"
import { type ReactNode, useEffect } from "react"

interface SettingsLayoutProps {
    children?: ReactNode
    title?: string
    description?: string
}

const settingsNavItems = [
    {
        title: "Account",
        href: "/settings/account",
        icon: User
    },
    {
        title: "AI Setup",
        href: "/settings/ai-setup",
        icon: Bot
    },
    {
        title: "Memory",
        href: "/settings/memory",
        icon: BrainCircuit
    },
    {
        title: "Behavior",
        href: "/settings/behavior",
        icon: SlidersHorizontal
    },
    {
        title: "Personas",
        href: "/settings/personas",
        icon: Users
    },
    {
        title: "Appearance",
        href: "/settings/appearance",
        icon: PaintBucket
    },
    {
        title: "Files",
        href: "/settings/files",
        icon: Paperclip
    },
    {
        title: "Privacy",
        href: "/settings/privacy",
        icon: ShieldCheck
    },
    {
        title: "Usage",
        href: "/settings/usage",
        icon: BarChart3
    },
    {
        title: "Billing",
        href: "/settings/billing",
        icon: CreditCard
    }
]

type SettingsNavHref = (typeof settingsNavItems)[number]["href"]

const legacySettingsRouteMap: Record<string, SettingsNavHref> = {
    "/settings/profile": "/settings/account",
    "/settings/providers": "/settings/ai-setup",
    "/settings/models": "/settings/ai-setup",
    "/settings/ai-options": "/settings/memory",
    "/settings/customization": "/settings/behavior",
    "/settings/attachments": "/settings/files"
}

const getActiveSettingsHref = (pathname: string): SettingsNavHref => {
    const exactMatch = settingsNavItems.find((item) => item.href === pathname)
    if (exactMatch) {
        return exactMatch.href
    }

    return legacySettingsRouteMap[pathname] ?? "/settings/account"
}

export const Route = createLazyFileRoute("/settings")({
    component: SettingsPage
})

const Inner = () => {
    const session = useSession()
    const userSettings = useConvexQuery(
        api.settings.getUserSettings,
        session.user?.id ? {} : "skip"
    )
    if (!session.user?.id) {
        return (
            <SettingsLayout
                title="API Keys"
                description="Manage your models and providers. Keys are encrypted and stored securely."
            >
                <p className="text-muted-foreground text-sm">Sign in to manage your API keys.</p>
            </SettingsLayout>
        )
    }
    if (!userSettings) {
        return (
            <SettingsLayout
                title="API Keys"
                description="Manage your models and providers. Keys are encrypted and stored securely."
            >
                <Skeleton className="h-10 w-full" />
            </SettingsLayout>
        )
    }
    if ("error" in userSettings) {
        return (
            <SettingsLayout
                title="API Keys"
                description="Manage your models and providers. Keys are encrypted and stored securely."
            >
                <p className="text-muted-foreground text-sm">Error loading API keys.</p>
            </SettingsLayout>
        )
    }

    return <Outlet />
}

function SettingsPage({ title, description }: SettingsLayoutProps) {
    const location = useLocation()
    const navigate = useNavigate()
    const activeSettingsHref = getActiveSettingsHref(location.pathname)

    useEffect(() => {
        if (location.pathname === "/settings" || location.pathname === "/settings/") {
            navigate({
                to: "/settings/account",
                replace: true
            })
        }
    }, [location.pathname, navigate])

    return (
        <div className="flex h-screen flex-col overflow-y-auto bg-background">
            <div className="container mx-auto flex max-w-6xl flex-1 flex-col p-3 pb-6 lg:max-h-dvh lg:overflow-y-hidden lg:p-6">
                {/* Header */}
                <div className="mb-5 max-md:px-2 lg:mb-8">
                    <div className="mb-4 flex items-center gap-4 lg:mb-6">
                        <SettingsBackButton />
                    </div>

                    <div className="mb-5 lg:hidden">
                        <Select
                            value={activeSettingsHref}
                            onValueChange={(value) =>
                                navigate({
                                    to: value as SettingsNavHref
                                })
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a settings category" />
                            </SelectTrigger>
                            <SelectContent>
                                {settingsNavItems.map((item) => (
                                    <SelectItem key={item.href} value={item.href}>
                                        {item.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="hidden space-y-1 lg:block">
                        <h1 className="font-semibold text-3xl tracking-tight">Settings</h1>
                        <p className="text-muted-foreground">
                            Manage your account preferences and configuration.
                        </p>
                    </div>
                </div>

                <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-4">
                    {/* Navigation */}
                    <div className="hidden w-full flex-shrink-0 lg:block lg:w-64 lg:pr-2">
                        <nav className="w-full space-y-1">
                            {settingsNavItems.map((item) => {
                                const isActive = activeSettingsHref === item.href
                                const Icon = item.icon

                                return (
                                    <Link
                                        key={item.href}
                                        to={item.href}
                                        className={cn(
                                            "flex w-full items-center gap-3 rounded-lg px-3 py-2 font-medium text-sm transition-colors",
                                            isActive
                                                ? "bg-muted text-foreground"
                                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {item.title}
                                    </Link>
                                )
                            })}
                        </nav>
                    </div>

                    {/* Main Content */}
                    <div className="col-span-3 flex-1">
                        <div className="space-y-6 p-0.5 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto">
                            <Inner />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
