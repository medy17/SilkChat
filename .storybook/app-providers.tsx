import { QueryClient } from "@tanstack/react-query"
export { WorkshopProviders as Providers } from "./WorkshopProviders"
export const queryClient = new QueryClient({
    defaultOptions: { queries: { enabled: false, retry: false } }
})
