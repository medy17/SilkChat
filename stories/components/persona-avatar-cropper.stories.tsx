import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { PersonaAvatarCropper } from "@/components/persona-avatar-cropper"
const meta = {
    title: "Personas/Avatar cropper",
    component: PersonaAvatarCropper,
    parameters: { layout: "fullscreen" },
    args: {
        cropState: { src: "/storybook/sample.svg", fileName: "avatar.svg" },
        open: true,
        onOpenChange: fn(),
        onConfirm: fn().mockResolvedValue(undefined),
        isSaving: false
    },
    decorators: [
        (Story) => (
            <div className="relative min-h-80">
                <Story />
            </div>
        )
    ]
} satisfies Meta<typeof PersonaAvatarCropper>
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
