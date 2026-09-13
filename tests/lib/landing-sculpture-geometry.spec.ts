// @vitest-environment jsdom

import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three"
import { expect, it } from "vitest"

import { sculpturePose } from "@/lib/landing-sculpture"
import { createSculptureGeometries } from "@/lib/landing-sculpture-geometry"

it("keeps the dot inside the front bubble with a clear gap to its right edge throughout assembly", () => {
    const geometries = createSculptureGeometries("conversation")
    const material = new MeshBasicMaterial({ side: DoubleSide })
    const meshes = geometries.map((geometry) => new Mesh(geometry, material))
    const ray = new Raycaster()

    try {
        for (const progress of [0, 0.1, 0.2, 0.35, 1]) {
            const { spread } = sculpturePose("conversation", progress)
            meshes.forEach((mesh, index) => {
                mesh.position.set(
                    (index === 0 ? -1 : 1) * spread,
                    (index === 0 ? 0.5 : -0.5) * spread,
                    0
                )
                mesh.updateMatrixWorld(true)
            })

            // Probe the real extruded SVG in the front bubble's local space.
            // A shared scene rotation cannot change these internal clearances.
            const hitsAt = (svgX: number) => {
                ray.set(
                    new Vector3((svgX - 753.725) * 0.0023 - spread, spread * 0.5, 2),
                    new Vector3(0, 0, -1)
                )
                return ray.intersectObjects(meshes, false)
            }
            expect(hitsAt(750).length, `dot at progress ${progress}`).toBeGreaterThan(0)
            expect(hitsAt(975).length, `gap at progress ${progress}`).toBe(0)
            expect(hitsAt(1060).length, `right outline at progress ${progress}`).toBeGreaterThan(0)
        }
    } finally {
        geometries.forEach((geometry) => geometry.dispose())
        material.dispose()
    }
})
