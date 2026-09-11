import original from "../folder-hero.stories"
export { Loading as Playground } from "../folder-hero.stories"
export default {
    ...original,
    title: "UI/Skeleton",
    parameters: {
        ...original.parameters,
        docs: {
            description: {
                component:
                    "FolderHero with an unresolved project, as shown while folder data loads."
            }
        }
    }
}
