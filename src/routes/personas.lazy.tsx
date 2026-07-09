import { createLazyFileRoute } from "@tanstack/react-router"

import { PersonaLandingPage } from "@/components/persona-landing-page"

export const Route = createLazyFileRoute("/personas")({
    component: PersonaLandingPage
})
