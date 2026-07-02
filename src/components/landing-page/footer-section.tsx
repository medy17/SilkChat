import { Link } from "@tanstack/react-router"

import { LogoMark } from "@/components/logo"

export function FooterSection() {
    return (
        <footer className="relative overflow-hidden pt-10">
            <div className="relative mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-6 px-5 text-sm [color:var(--landing-muted-faint)] md:flex-row md:px-8">
                <div className="flex items-center gap-3">
                    <LogoMark className="h-auto w-24 [color:var(--landing-fg)]" />
                    <span>&copy; {new Date().getFullYear()} SilkChat</span>
                </div>
                <div className="flex gap-5">
                    <Link
                        to="/terms-of-service"
                        className="transition-colors hover:[color:var(--landing-fg)]"
                    >
                        Terms
                    </Link>
                    <Link
                        to="/privacy-policy"
                        className="transition-colors hover:[color:var(--landing-fg)]"
                    >
                        Privacy
                    </Link>
                    <a
                        href="https://github.com/medy17/silkchat"
                        target="_blank"
                        rel="noreferrer"
                        className="transition-colors hover:[color:var(--landing-fg)]"
                    >
                        GitHub
                    </a>
                </div>
            </div>

            <div
                aria-hidden="true"
                className="pointer-events-none relative mx-auto mt-12 w-full max-w-7xl select-none px-5 md:px-8"
            >
                <LogoMark className="h-auto w-full translate-y-[22%] opacity-[0.15] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
            </div>
        </footer>
    )
}
