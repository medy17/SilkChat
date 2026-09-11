import type { Meta, StoryObj } from "@storybook/react-vite"
import { useRef } from "react"
import { FeaturesSection } from "@/components/landing-page/features-section"
import "../../../.storybook/landing.css"

const meta = {
    title: "Landing/FeaturesSection",
    component: FeaturesSection,
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
                <FeaturesSection />
            </div>
        )
    }
} satisfies Meta<typeof FeaturesSection>
export default meta
type Story = StoryObj<typeof meta>
export const PageSection: Story = {}
