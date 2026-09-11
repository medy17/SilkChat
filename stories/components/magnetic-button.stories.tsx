import original from "./landing-page/hero-section.stories"
export { PageSection as Playground } from "./landing-page/hero-section.stories"
export default {
    ...original,
    title: "Brand/Magnetic button",
    parameters: {
        ...original.parameters,
        docs: { description: { component: "MagneticButton around the actual hero CTA." } }
    }
}
