import handler, { createServerEntry } from "@tanstack/react-start/server-entry"
import { restoreConfiguredHttpsOrigin } from "@/lib/forwarded-request"

export default createServerEntry({
    fetch(request) {
        return handler.fetch(restoreConfiguredHttpsOrigin(request, process.env.DEV_PUBLIC_URL))
    }
})
