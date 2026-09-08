"use client"

import type { RefObject } from "react"

import { WorkflowIllustratedSection } from "@/components/landing-page/workflow-illustrated-section"

export function UseCasesSection({
    containerRef
}: {
    containerRef: RefObject<HTMLDivElement | null>
}) {
    return <WorkflowIllustratedSection containerRef={containerRef} />
}
