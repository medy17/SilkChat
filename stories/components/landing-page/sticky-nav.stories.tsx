import type { Meta, StoryObj } from "@storybook/react-vite"
import { useRef } from "react"
import { StickyNav } from "@/components/landing-page/sticky-nav"
import "../../../.storybook/landing.css"

const meta = {
    title: "Landing/StickyNav",
    component: StickyNav,
    parameters: {
        layout: "fullscreen",
        docs: {
            description: {
                component:
                    "Actual section rendered by LandingPage or PersonaLandingPage, using the same landing CSS variables and scroll container."
            }
        }
    },
    args: { containerRef: { current: null } },
    argTypes: { containerRef: { control: false } },
    render: function Section() {
        const containerRef = useRef<HTMLDivElement>(null)
        return (
            <div
                ref={containerRef}
                className="landing-page-root relative h-screen overflow-y-auto bg-background text-foreground"
            >
                <StickyNav containerRef={containerRef} />
            </div>
        )
    }
} satisfies Meta<typeof StickyNav>
export default meta
type Story = StoryObj<typeof meta>
export const PageSection: Story = {}
