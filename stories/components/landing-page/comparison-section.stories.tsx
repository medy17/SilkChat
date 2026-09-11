import type { Meta, StoryObj } from "@storybook/react-vite"
import { useRef } from "react"
import { ComparisonSection } from "@/components/landing-page/comparison-section"
import "../../../.storybook/landing.css"

const meta = {
    title: "Available components/ComparisonSection",
    component: ComparisonSection,
    parameters: {
        layout: "fullscreen",
        docs: {
            description: { component: "No current page call site; retained component API example." }
        }
    },
    render: function Section() {
        const containerRef = useRef<HTMLDivElement>(null)
        return (
            <div
                ref={containerRef}
                className="landing-page-root relative h-screen overflow-y-auto bg-background text-foreground"
            >
                <ComparisonSection />
            </div>
        )
    }
} satisfies Meta<typeof ComparisonSection>
export default meta
type Story = StoryObj<typeof meta>
export const PageSection: Story = {}
