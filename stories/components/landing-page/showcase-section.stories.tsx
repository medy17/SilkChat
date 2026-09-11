import type { Meta, StoryObj } from "@storybook/react-vite"
import { useRef } from "react"
import { ShowcaseSection } from "@/components/landing-page/showcase-section"
import "../../../.storybook/landing.css"

const meta = {
    title: "Available components/ShowcaseSection",
    component: ShowcaseSection,
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
                <ShowcaseSection />
            </div>
        )
    }
} satisfies Meta<typeof ShowcaseSection>
export default meta
type Story = StoryObj<typeof meta>
export const PageSection: Story = {}
