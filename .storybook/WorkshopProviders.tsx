import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
    createMemoryHistory,
    createRootRoute,
    createRouter,
    RouterProvider
} from "@tanstack/react-router"
import { createContext, useContext, useState, type ReactNode } from "react"
import { TooltipProvider } from "../src/components/ui/tooltip"

const WorkshopContent = createContext<ReactNode>(null)
function StoryRoute() {
    return useContext(WorkshopContent)
}

export function WorkshopProviders({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () => new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
    )
    const [router] = useState(() =>
        createRouter({
            routeTree: createRootRoute({ component: StoryRoute }),
            history: createMemoryHistory({ initialEntries: ["/"] })
        })
    )
    return (
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <WorkshopContent.Provider value={children}>
                    <RouterProvider router={router} />
                </WorkshopContent.Provider>
            </TooltipProvider>
        </QueryClientProvider>
    )
}
