import original from "../landing-page/artifacts-section.stories"
export { PageSection as Playground } from "../landing-page/artifacts-section.stories"
export default {
    ...original,
    title: "Brand/Click spark",
    parameters: {
        ...original.parameters,
        docs: { description: { component: "ClickSpark in the actual artifacts section." } }
    }
}
