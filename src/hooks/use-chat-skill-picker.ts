import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"
import { MAX_SKILLS_PER_CHAT } from "@/convex/lib/skill_bundle"
import { useSession } from "@/hooks/auth-hooks"
import { useIsMobile } from "@/hooks/use-mobile"
import { useSkillDraftStore } from "@/lib/skill-draft-store"
import { useConvexQuery } from "@convex-dev/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useMemo } from "react"

/**
 * The composer's view of a chat's skills. A new chat can pick from the library, starting
 * from the skills that are on for new chats. A chat that has started reports the skills it
 * was created with and can't change them.
 */
export function useChatSkillPicker(threadId: string | undefined) {
    const session = useSession()
    const isMobile = useIsMobile()
    const navigate = useNavigate()
    const signedIn = Boolean(session.user?.id)
    const library = useConvexQuery(api.skills.listMySkills, signedIn && !threadId ? {} : "skip")
    const threadSkills = useConvexQuery(
        api.skills.listThreadSkills,
        signedIn && threadId ? { threadId: threadId as Id<"threads"> } : "skip"
    )
    const picked = useSkillDraftStore((state) => state.picked)
    const setPicked = useSkillDraftStore((state) => state.setPicked)
    const locked = Boolean(threadId)

    const skills = useMemo(
        () => (library ?? []).map((skill) => ({ slug: skill.slug, enabled: skill.enabled })),
        [library]
    )
    const selectedNames = useMemo(() => {
        if (locked) return threadSkills ?? []
        const installed = new Set(skills.map((skill) => skill.slug))
        const names = picked
            ? picked.filter((slug) => installed.has(slug))
            : skills
                  .filter((skill) => skill.enabled)
                  .map((skill) => skill.slug)
                  .sort()
        // A chat takes this many at most. With more switched on than that, the server keeps
        // the first ones by name, so the same ones are shown as on here.
        return names.slice(0, MAX_SKILLS_PER_CHAT)
    }, [locked, threadSkills, skills, picked])
    const atLimit = !locked && selectedNames.length >= MAX_SKILLS_PER_CHAT

    return {
        locked,
        skills,
        selectedNames,
        selectedSlugs: useMemo(() => new Set(selectedNames), [selectedNames]),
        // A started chat with no skills has nothing to report, so it shows no Skills line.
        visible: locked ? selectedNames.length > 0 : library !== undefined,
        // No more can be switched on, only off.
        atLimit,
        toggle: (slug: string, on: boolean) => {
            if (on && atLimit) return
            setPicked(
                on
                    ? [...new Set([...selectedNames, slug])]
                    : selectedNames.filter((name) => name !== slug)
            )
        },
        // Closes the surface it was opened from first. A mobile drawer closes through a
        // history entry, so leaving has to wait for that entry to pop.
        browse: (close: () => void) => {
            close()
            let left = false
            const leave = () => {
                if (left) return
                left = true
                window.removeEventListener("popstate", leave)
                void navigate({ to: "/settings/skills", search: { tab: "browse" } })
            }
            if (!isMobile) return leave()
            window.addEventListener("popstate", leave, { once: true })
            window.setTimeout(leave, 150)
        }
    }
}
