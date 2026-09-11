import type { Meta, StoryObj } from "@storybook/react-vite"
import { useRef } from "react"
import { FooterSection } from "@/components/landing-page/footer-section"
import "../../../.storybook/landing.css"

const meta = {
    title: "Landing/FooterSection",
    component: FooterSection,
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
                <FooterSection />
            </div>
        )
    }
} satisfies Meta<typeof FooterSection>
export default meta
type Story = StoryObj<typeof meta>
export const PageSection: Story = {}
