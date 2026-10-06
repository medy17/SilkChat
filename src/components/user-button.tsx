"use client"

import { useRouter } from "@tanstack/react-router"
import { useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { ImpersonationPicker } from "@/components/auth/impersonation"
import { switchImpersonation } from "@/lib/impersonation-client"
import { toast } from "sonner"
import {
    ArrowLeft,
    Loader2,
    LogOutIcon,
    ScrollText,
    SettingsIcon,
    Shield,
    UserIcon,
    Users
} from "lucide-react"
import { InstagramIcon } from "@/components/brand-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { useSession } from "@/hooks/auth-hooks"
import { authClient } from "@/lib/auth-client"
import { queryClient } from "@/providers"

export function UserButton() {
    const { data: session, isPending } = useSession()
    const router = useRouter()
    const [impersonationOpen, setImpersonationOpen] = useState(false)
    const currentUser = useQuery(api.auth.getCurrentUser, session?.user ? {} : "skip")

    if (isPending) {
        return (
            <div className="flex h-8 w-8 items-center justify-center rounded-md">
                <Loader2 className="h-4 w-4 animate-spin" />
            </div>
        )
    }

    if (!session?.user) {
        return (
            <Button
                variant="outline"
                onClick={() =>
                    router.navigate({ to: "/auth/$pathname", params: { pathname: "sign-in" } })
                }
            >
                Sign In
            </Button>
        )
    }

    const handleSignOut = async () => {
        await authClient.signOut()
        await queryClient.resetQueries({ queryKey: ["session"] })
        await queryClient.resetQueries({ queryKey: ["token"] })
        router.navigate({ to: "/" })
        const keys = Object.keys(localStorage)
        for (const key of keys) {
            if (key.includes("_CACHE")) {
                localStorage.removeItem(key)
            }
        }
    }

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button type="button" className="relative h-8 w-8 rounded-md">
                        <Avatar className="h-8 w-8 rounded-md">
                            <AvatarImage
                                src={session.user.image || undefined}
                                alt={session.user.name || "User"}
                            />
                            <AvatarFallback>
                                {session.user.name ? (
                                    getInitials(session.user.name)
                                ) : (
                                    <UserIcon className="h-4 w-4 rounded-md" />
                                )}
                            </AvatarFallback>
                        </Avatar>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                            <p className="font-medium text-sm leading-none">
                                {session.session.impersonatedBy ? "Viewing as " : ""}
                                {session.user.name || "User"}
                            </p>
                            <p className="text-muted-foreground text-xs leading-none">
                                {session.user.email}
                            </p>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.navigate({ to: "/settings" })}>
                        <SettingsIcon className="h-4 w-4" />
                        <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.navigate({ to: "/about" })}>
                        <Users className="h-4 w-4" />
                        <span>About Us</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <a
                            href="https://instagram.com/_medy__"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <InstagramIcon className="h-4 w-4" />
                            <span>Instagram</span>
                        </a>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.navigate({ to: "/privacy-policy" })}>
                        <Shield className="h-4 w-4" />
                        <span>Privacy Policy</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.navigate({ to: "/terms-of-service" })}>
                        <ScrollText className="h-4 w-4" />
                        <span>Terms of Service</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={handleSignOut}>
                        <LogOutIcon className="h-4 w-4" />
                        <span>Sign Out</span>
                    </DropdownMenuItem>
                    {session.session.impersonatedBy ? (
                        <DropdownMenuItem
                            onClick={() =>
                                void switchImpersonation(session.user.id).catch((error) =>
                                    toast.error(error.message)
                                )
                            }
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span>Return to my account</span>
                        </DropdownMenuItem>
                    ) : currentUser?.canImpersonate ? (
                        <DropdownMenuItem onClick={() => setImpersonationOpen(true)}>
                            <UserIcon className="h-4 w-4" />
                            <span>Impersonate user</span>
                        </DropdownMenuItem>
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenu>
            {currentUser?.canImpersonate && (
                <ImpersonationPicker
                    open={impersonationOpen}
                    onOpenChange={setImpersonationOpen}
                    currentUserId={session.user.id}
                />
            )}
        </>
    )
}
