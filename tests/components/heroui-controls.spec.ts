// @vitest-environment jsdom
import { createElement as h, useState } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
    DialogClose
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogTitle,
    AlertDialogAction,
    AlertDialogCancel
} from "@/components/ui/alert-dialog"

beforeEach(() => {
    Object.defineProperty(Element.prototype, "getAnimations", {
        configurable: true,
        value: () => []
    })
})

describe("HeroUI control contracts", () => {
    it("keeps native labels, mixed checkbox activation and disabled switches working", () => {
        function Form() {
            const [checked, setChecked] = useState<boolean | "indeterminate">("indeterminate")
            return h(
                "form",
                null,
                h("label", { htmlFor: "all" }, "Select all"),
                h(Checkbox, { id: "all", checked, onCheckedChange: setChecked }),
                h("label", { htmlFor: "analytics" }, "Analytics"),
                h(Switch, { id: "analytics", checked: false, disabled: true })
            )
        }
        render(h(Form))
        const checkbox = screen.getByRole("checkbox", { name: "Select all" }) as HTMLInputElement
        expect(checkbox.indeterminate).toBe(true)
        fireEvent.click(screen.getByText("Select all"))
        expect(checkbox.checked).toBe(true)
        expect(
            (screen.getByRole("switch", { name: "Analytics" }) as HTMLInputElement).disabled
        ).toBe(true)
    })

    it("does not submit a form or call its action through a disabled button", () => {
        const action = vi.fn()
        const submit = vi.fn((event: Event) => event.preventDefault())
        render(
            h("form", { onSubmit: submit }, h(Button, { disabled: true, onClick: action }, "Save"))
        )
        fireEvent.click(screen.getByRole("button", { name: "Save" }))
        expect(action).not.toHaveBeenCalled()
        expect(submit).not.toHaveBeenCalled()
    })

    it("opens a dialog from a composed trigger and restores focus after closing", async () => {
        render(
            h(
                Dialog,
                null,
                h(DialogTrigger, { asChild: true }, h(Button, null, "Edit")),
                h(
                    DialogContent,
                    null,
                    h(DialogTitle, null, "Edit item"),
                    h(DialogClose, null, "Done")
                )
            )
        )
        const trigger = screen.getByRole("button", { name: "Edit" })
        trigger.focus()
        fireEvent.click(trigger)
        expect(await screen.findByRole("dialog", { name: "Edit item" })).toBeTruthy()
        fireEvent.click(screen.getByRole("button", { name: "Done" }))
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
        await waitFor(() => expect(document.activeElement).toBe(trigger))
    })

    it("keeps a destructive confirmation open when its action prevents dismissal", async () => {
        const onOpenChange = vi.fn()
        render(
            h(
                AlertDialog,
                { open: true, onOpenChange },
                h(
                    AlertDialogContent,
                    null,
                    h(AlertDialogTitle, null, "Delete item?"),
                    h(AlertDialogCancel, null, "Cancel"),
                    h(AlertDialogAction, { onClick: (event) => event.preventDefault() }, "Delete")
                )
            )
        )
        fireEvent.click(await screen.findByRole("button", { name: "Delete" }))
        expect(onOpenChange).not.toHaveBeenCalled()
        expect(screen.getByRole("alertdialog", { name: "Delete item?" })).toBeTruthy()
    })
})

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuGroup,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PickerChoices, PickerChoice } from "@/components/ui/picker-choice"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip"

it("opens a folder selector with an icon action outside its options", async () => {
    const createFolder = vi.fn()
    render(
        h(
            Select,
            { defaultValue: "general", "aria-label": "Destination folder" },
            h(SelectTrigger, null, h(SelectValue)),
            h(
                SelectContent,
                {
                    footer: h(
                        "button",
                        { type: "button", onClick: createFolder },
                        h("svg", { "aria-hidden": true }, h("path", { d: "M1 1L5 5" })),
                        "Create Folder"
                    )
                },
                h(SelectItem, { value: "general" }, "General")
            )
        )
    )
    fireEvent.click(screen.getByRole("button", { name: /General/ }))
    const action = await screen.findByRole("button", { name: "Create Folder" })
    expect(action.closest('[role="listbox"]')).toBeNull()
    fireEvent.click(action)
    expect(createFolder).toHaveBeenCalledTimes(1)
})

it.each([false, true])(
    "dismisses a modal=%s popover on a nonfocusable outside click",
    async (modal) => {
        render(
            h(
                Popover,
                { modal },
                h(PopoverTrigger, null, "Open settings"),
                h(PopoverContent, { "aria-label": "Settings", children: "Settings content" })
            )
        )
        fireEvent.click(screen.getByRole("button", { name: "Open settings" }))
        await screen.findByRole("dialog", { name: "Settings" })
        fireEvent.pointerDown(document.body)
        fireEvent.pointerUp(document.body)
        fireEvent.click(document.body)
        await waitFor(() => expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull())
    }
)

it("keeps a nonmodal popover open while selecting a nested option", async () => {
    render(
        h(
            Popover,
            null,
            h(PopoverTrigger, null, "Open settings"),
            h(
                PopoverContent,
                { "aria-label": "Settings", children: null },
                h(
                    Select,
                    { defaultValue: "a", "aria-label": "Effort" },
                    h(SelectTrigger, null, h(SelectValue)),
                    h(
                        SelectContent,
                        null,
                        h(SelectItem, { value: "a" }, "Low"),
                        h(SelectItem, { value: "b" }, "High")
                    )
                )
            )
        )
    )
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }))
    fireEvent.click(await screen.findByRole("button", { name: /Low/ }))
    const option = await screen.findByRole("option", { name: "High" })
    fireEvent.pointerDown(option)
    fireEvent.pointerUp(option)
    fireEvent.click(option)
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull())
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /High/ }))
    await screen.findByRole("listbox")
    fireEvent.pointerDown(document.body)
    fireEvent.click(document.body)
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull())
    expect(screen.getByRole("dialog", { name: "Settings" })).toBeTruthy()
    fireEvent.pointerDown(document.body)
    fireEvent.click(document.body)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }))
    await screen.findByRole("dialog", { name: "Settings" })
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Settings" }), { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
})

it("selects an option and displays its value", async () => {
    const changed = vi.fn()
    render(
        h(
            Select,
            { defaultValue: "a", onValueChange: changed, "aria-label": "Provider" },
            h(SelectTrigger, null, h(SelectValue)),
            h(
                SelectContent,
                null,
                h(SelectItem, { value: "a" }, "Provider A"),
                h(SelectItem, { value: "b" }, "Provider B")
            )
        )
    )
    fireEvent.click(screen.getByRole("button"))
    fireEvent.click(await screen.findByRole("option", { name: "Provider B" }))
    expect(changed).toHaveBeenCalledWith("b")
    expect(screen.getByRole("button").textContent).toContain("Provider B")
})

it("runs menu actions from wrapped items without dropping section labels", async () => {
    const action = vi.fn()
    render(
        h(
            DropdownMenu,
            null,
            h(DropdownMenuTrigger, { asChild: true }, h(Button, null, "Actions")),
            h(
                DropdownMenuContent,
                null,
                h(DropdownMenuLabel, null, "Account"),
                h(DropdownMenuGroup, null, h(DropdownMenuItem, { onClick: action }, "Settings")),
                h(
                    DropdownMenuSub,
                    null,
                    h(DropdownMenuSubTrigger, null, "More"),
                    h(DropdownMenuSubContent, null, h(DropdownMenuItem, null, "Export"))
                )
            )
        )
    )
    fireEvent.click(screen.getByRole("button", { name: "Actions" }))
    expect(await screen.findByText("Account")).toBeTruthy()
    fireEvent.click(screen.getByRole("menuitem", { name: "Settings" }))
    expect(action).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())
})

it("connects tab selection to the matching panel", async () => {
    render(
        h(
            Tabs,
            { defaultValue: "code", children: null },
            h(
                TabsList,
                { "aria-label": "Artifact view", children: null },
                h(TabsTrigger, { value: "code" }, "Code"),
                h(TabsTrigger, { value: "preview" }, "Preview")
            ),
            h(TabsContent, { value: "code", children: null }, "Source code"),
            h(TabsContent, { value: "preview", children: null }, "Rendered preview")
        )
    )
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }))
    expect((await screen.findByRole("tabpanel")).textContent).toBe("Rendered preview")
})

it("browses choices with arrows and commits only an explicit activation", () => {
    const commit = vi.fn()
    render(
        h(
            PickerChoices,
            { value: "a", "aria-label": "Models" },
            h(PickerChoice, {
                value: "a",
                label: "Model A",
                onCommit: commit,
                children: "Model A"
            }),
            h(PickerChoice, {
                value: "b",
                label: "Model B",
                onCommit: commit,
                children: "Model B"
            }),
            h(Button, null, "Favorite")
        )
    )
    const first = screen.getByRole("radio", { name: "Model A" })
    first.focus()
    fireEvent.keyDown(first, { key: "ArrowDown" })
    const second = screen.getByRole("radio", { name: "Model B" }) as HTMLInputElement
    expect(second.checked).toBe(true)
    expect(commit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Favorite" }))
    expect(commit).not.toHaveBeenCalled()
    fireEvent.click(second)
    expect(commit).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(second, { key: "Enter" })
    expect(commit).toHaveBeenCalledTimes(2)
})

it("opens a popover through a tooltip-composed button and dismisses it with Escape", async () => {
    render(
        h(
            Popover,
            null,
            h(
                Tooltip,
                null,
                h(
                    TooltipTrigger,
                    { asChild: true },
                    h(PopoverTrigger, { asChild: true }, h(Button, null, "Choose model"))
                )
            ),
            h(
                PopoverContent,
                { "aria-label": "Models", children: null },
                h(Button, null, "Model A")
            )
        )
    )
    fireEvent.click(screen.getByRole("button", { name: "Choose model" }))
    const popup = await screen.findByRole("dialog", { name: "Models" })
    fireEvent.keyDown(popup, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
})

it("opens a submenu beside another action in a grouped menu row", async () => {
    const action = vi.fn()
    render(
        h(
            DropdownMenu,
            null,
            h(DropdownMenuTrigger, { asChild: true }, h(Button, null, "Retry")),
            h(
                DropdownMenuContent,
                null,
                h(
                    DropdownMenuGroup,
                    { "aria-label": "Model A" },
                    h(DropdownMenuItem, null, "Retry default"),
                    h(
                        DropdownMenuSub,
                        null,
                        h(DropdownMenuSubTrigger, null, "Reasoning"),
                        h(
                            DropdownMenuSubContent,
                            null,
                            h(DropdownMenuItem, { onClick: action }, "High")
                        )
                    )
                )
            )
        )
    )
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    const trigger = await screen.findByRole("menuitem", { name: "Reasoning" })
    trigger.focus()
    fireEvent.keyDown(trigger, { key: "ArrowRight" })
    fireEvent.click(await screen.findByRole("menuitem", { name: "High" }))
    expect(action).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())
})
