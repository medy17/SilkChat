import original from "../landing-page/hero-section.stories"
export { PageSection as Playground } from "../landing-page/hero-section.stories"
export default {
    ...original,
    title: "Brand/Silk background",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component: "Silk in the actual landing hero, with theme-derived colors and overlay."
            }
        }
    }
}
