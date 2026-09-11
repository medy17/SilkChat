import type { Meta, StoryObj } from "@storybook/react-vite"
import * as C from "@/components/ui/input-otp"

const meta = {
    title: "Available primitives/Input Otp",
    parameters: { layout: "padded" },
    render: () => (
        <C.InputOTP maxLength={6} aria-label="Verification code">
            <C.InputOTPGroup>
                {[0, 1, 2].map((index) => (
                    <C.InputOTPSlot key={index} index={index} />
                ))}
            </C.InputOTPGroup>
            <C.InputOTPSeparator />
            <C.InputOTPGroup>
                {[3, 4, 5].map((index) => (
                    <C.InputOTPSlot key={index} index={index} />
                ))}
            </C.InputOTPGroup>
        </C.InputOTP>
    )
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
export const UnusedInApp: Story = {
    parameters: {
        docs: {
            description: {
                story: "No current app call site. This is an available primitive API example, not a SilkChat screen."
            }
        }
    }
}
