import type { Meta, StoryObj } from "@storybook/react-vite"
import { useRef } from "react"
import { HeroSection } from "@/components/landing-page/hero-section"
import "../../../.storybook/landing.css"

const meta = {
    title: "Landing/HeroSection",
    component: HeroSection,
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
                <HeroSection />
            </div>
        )
    }
} satisfies Meta<typeof HeroSection>
export default meta
type Story = StoryObj<typeof meta>
export const PageSection: Story = {}
