import type { Meta, StoryObj } from "@storybook/react-vite"
import { PersonaLandingPage } from "@/components/persona-landing-page"
const meta = {
    title: "Landing/Personas full page",
    component: PersonaLandingPage,
    parameters: { layout: "fullscreen" },
    args: {},
    decorators: [
        (Story) => (
            <div className="relative min-h-80">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof PersonaLandingPage>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
