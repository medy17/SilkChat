import { demoUser } from "./fixtures"
import { readWorkshopOption } from "./service-state"

const session = {
    data: { user: demoUser, session: { id: "storybook-session", userId: demoUser.id } },
    user: demoUser,
    isPending: false,
    isLoading: false,
    error: null
}
const guest = { ...session, data: null, user: undefined }
export function useSession() {
    return readWorkshopOption("$guest") ? guest : session
}
export function useToken() {
    return { token: undefined }
}
