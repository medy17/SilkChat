import original from "../threads-sidebar.stories"
export { Playground } from "../threads-sidebar.stories"
export default {
    ...original,
    title: "UI/sidebar",
    parameters: {
        ...original.parameters,
        docs: { description: { component: "Actual ThreadsSidebar inside SidebarProvider." } }
    }
}
