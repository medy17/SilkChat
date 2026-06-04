// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import React from "react"
import { describe, expect, it, vi } from "vitest"

const { useNavigateMock, getLastChatRouteMock } = vi.hoisted(() => ({
    useNavigateMock: vi.fn(),
    getLastChatRouteMock: vi.fn(() => "/thread/thread-7")
}))

vi.mock("@tanstack/react-router", () => ({
    useNavigate: useNavigateMock
}))

vi.mock("@/lib/last-chat-route", () => ({
    getLastChatRoute: getLastChatRouteMock
}))

import { SettingsBackButton } from "@/components/settings/settings-back-button"

describe("SettingsBackButton", () => {
    it("navigates back to the last chat route", () => {
        const navigate = vi.fn()
        useNavigateMock.mockReturnValue(navigate)

        render(React.createElement(SettingsBackButton))

        fireEvent.click(screen.getByRole("button", { name: "Back" }))

        expect(navigate).toHaveBeenCalledWith({ href: "/thread/thread-7" })
    })
})
