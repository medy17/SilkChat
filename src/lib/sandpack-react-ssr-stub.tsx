import type { ReactNode } from "react"

export function SandpackProvider({ children }: { children?: ReactNode }) {
    return <>{children}</>
}

export function SandpackLayout({ children }: { children?: ReactNode }) {
    return <>{children}</>
}

export function SandpackPreview() {
    return null
}

export function useSandpack() {
    return {
        sandpack: {
            clients: {},
            status: "idle"
        }
    }
}
