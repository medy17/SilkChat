import type { Meta, StoryObj } from "@storybook/react-vite"
import { useRef } from "react"
import { SocialProofSection } from "@/components/landing-page/social-proof-section"
import "../../../.storybook/landing.css"

const meta = {
    title: "Landing/SocialProofSection",
    component: SocialProofSection,
    parameters: {
        layout: "fullscreen",
        docs: {
            description: {
                component:
                    "Actual section rendered by LandingPage or PersonaLandingPage, using the same landing CSS variables and scroll container."
            }
        }
    },
    render: function Section() {
        const containerRef = useRef<HTMLDivElement>(null)
        return (
            <div
                ref={containerRef}
                className="landing-page-root relative h-screen overflow-y-auto bg-background text-foreground"
            >
                <SocialProofSection />
            </div>
        )
    }
} satisfies Meta<typeof SocialProofSection>
export default meta
type Story = StoryObj<typeof meta>
export const PageSection: Story = {}
