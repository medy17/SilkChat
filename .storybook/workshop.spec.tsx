import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, fireEvent } from "@testing-library/react"
import { useQuery, useConvexAuth } from "convex/react"
import { useSession } from "@/hooks/auth-hooks"
import { api } from "../convex/_generated/api"
import { resetWorkshopFixtures } from "./service-state"
import { WorkshopProviders } from "./WorkshopProviders"
import { AttachmentTile } from "../src/components/attachment-tile"
import { Loader } from "../src/components/ui/loader"
import { ModelSelector } from "../src/components/model-selector"
import { demoModels, demoUser } from "./fixtures"
import { ThreadItemDialogs } from "../src/components/threads/thread-item-dialogs"
import { demoThread, demoProject } from "./fixtures"
import { MultimodalInput } from "../src/components/multimodal-input"
import { Messages } from "../src/components/messages"
import { Chat } from "../src/components/chat"
import { Header } from "../src/components/header"
import { ThreadsSidebar } from "../src/components/threads-sidebar"
import { SidebarProvider } from "../src/components/ui/sidebar"

afterEach(cleanup)
beforeEach(() => resetWorkshopFixtures())

describe("Storybook service boundary", () => {
    it("renders the full chat shell using fixture services", async () => {
        render(
            <WorkshopProviders>
                <SidebarProvider>
                    <ThreadsSidebar />
                    <Header />
                    <Chat threadId={undefined} />
                </SidebarProvider>
            </WorkshopProviders>
        )
        expect(await screen.findByRole("textbox", {}, { timeout: 3000 })).toBeTruthy()
    })
    it("renders the composer without authenticated service providers", async () => {
        render(
            <WorkshopProviders>
                <MultimodalInput status="ready" onSubmit={() => {}} />
            </WorkshopProviders>
        )
        expect(await screen.findByRole("textbox")).toBeTruthy()
    })

    it("renders conversation messages with their real footer dependencies", async () => {
        render(
            <WorkshopProviders>
                <Messages
                    status="ready"
                    messages={[
                        {
                            id: "answer",
                            role: "assistant",
                            parts: [{ type: "text", text: "Fixture response" }]
                        }
                    ]}
                />
            </WorkshopProviders>
        )
        expect(await screen.findByText("Fixture response")).toBeTruthy()
    })
    it("resolves app imports to fixture auth and supports per-story query isolation", () => {
        expect(useSession().user?.id).toBe(demoUser.id)
        expect(useConvexAuth().isAuthenticated).toBe(true)
        resetWorkshopFixtures({ "threads:getThread": { title: "Alternate fixture" } })
        expect(useQuery(api.threads.getThread, { threadId: demoThread._id })).toEqual({
            title: "Alternate fixture"
        })
        resetWorkshopFixtures()
        expect(useQuery(api.threads.getThread, { threadId: demoThread._id })).toEqual(demoThread)
    })

    it("renders ordinary components without requiring configurable mock functions", async () => {
        render(
            <WorkshopProviders>
                <Loader variant="typing" />
                <AttachmentTile fileName="report.pdf" status="error" />
            </WorkshopProviders>
        )
        expect((await screen.findAllByText("Upload failed")).length).toBeGreaterThan(0)
    })

    it("opens the actual model picker against fixture settings and models", async () => {
        render(
            <WorkshopProviders>
                <ModelSelector
                    selectedModel={demoModels[0].id}
                    onModelChange={() => {}}
                    telemetrySurface="composer"
                    open
                />
            </WorkshopProviders>
        )
        expect(await screen.findByPlaceholderText(/search/i)).toBeTruthy()
    })

    it("renders the real rename form and accepts edits without a live backend", async () => {
        render(
            <WorkshopProviders>
                <ThreadItemDialogs
                    currentThread={demoThread}
                    projects={[demoProject]}
                    showRenameDialog
                    showMoveDialog={false}
                    showDeleteDialog={false}
                    onCloseRenameDialog={() => {}}
                    onCloseMoveDialog={() => {}}
                    onCloseDeleteDialog={() => {}}
                />
            </WorkshopProviders>
        )
        const input = (await screen.findByPlaceholderText("Enter thread name")) as HTMLInputElement
        fireEvent.change(input, { target: { value: "Updated title" } })
        expect(input.value).toBe("Updated title")
    })
})
