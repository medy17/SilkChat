import type { Meta, StoryObj } from "@storybook/react-vite"
import * as C from "@/components/ui/table"
import { Button } from "@/components/ui/button"

const meta = {
    title: "UI/table",
    parameters: {
        docs: {
            description: {
                component: "routes/settings/files.tsx responsive file table; row data is a fixture."
            }
        }
    },
    render: () => (
        <C.Table>
            <C.TableHeader>
                <C.TableRow>
                    <C.TableHead className="pl-4">Name</C.TableHead>
                    <C.TableHead className="hidden w-32 sm:table-cell">Size</C.TableHead>
                    <C.TableHead className="hidden w-40 md:table-cell">Created</C.TableHead>
                    <C.TableHead>
                        <span className="sr-only">Actions</span>
                    </C.TableHead>
                </C.TableRow>
            </C.TableHeader>
            <C.TableBody>
                <C.TableRow>
                    <C.TableCell className="pl-4">report.pdf</C.TableCell>
                    <C.TableCell className="hidden sm:table-cell">2.4 MB</C.TableCell>
                    <C.TableCell className="hidden md:table-cell">11 Sep 2026</C.TableCell>
                    <C.TableCell>
                        <Button variant="ghost" size="icon" aria-label="Delete report.pdf">
                            ×
                        </Button>
                    </C.TableCell>
                </C.TableRow>
            </C.TableBody>
        </C.Table>
    )
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
export const Playground: Story = {}
