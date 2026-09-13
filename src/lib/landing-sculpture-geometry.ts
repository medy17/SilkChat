import { ExtrudeGeometry } from "three"
import { SVGLoader } from "three/addons/loaders/SVGLoader.js"

import { SOURCE_BRACE_PATH, type SculptureKind } from "./landing-sculpture"
import { SILKCHAT_SYMBOL_PATH } from "./silkchat-symbol-path"

export function createSculptureGeometries(kind: SculptureKind) {
    const source = kind === "source"
    const paths = new SVGLoader().parse(
        `<svg xmlns="http://www.w3.org/2000/svg"><path d="${source ? SOURCE_BRACE_PATH : SILKCHAT_SYMBOL_PATH}" /></svg>`
    ).paths
    const shapes = paths.flatMap((path) => path.toShapes())
    const makeGeometry = (mirror = false, parts = shapes) => {
        const geometry = new ExtrudeGeometry(parts, {
            depth: source ? 20 : 95,
            bevelEnabled: true,
            bevelThickness: source ? 3 : 12,
            bevelSize: source ? 2 : 9,
            bevelSegments: 5,
            curveSegments: 20,
            steps: 1
        })
        const unit = source ? 0.012 : 0.0023
        geometry.translate(source ? -150 : -753.725, source ? -150 : -750, source ? -10 : -47.5)
        geometry.scale(mirror ? -unit : unit, -unit, unit)
        // Extrusion begins in SVG's downward Y coordinates. Correct the
        // reflected winding before lighting/culling the resulting solid.
        if (!mirror) {
            const position = geometry.getAttribute("position")
            for (let i = 0; i < position.count; i += 3) {
                const x = position.getX(i + 1),
                    y = position.getY(i + 1),
                    z = position.getZ(i + 1)
                position.setXYZ(
                    i + 1,
                    position.getX(i + 2),
                    position.getY(i + 2),
                    position.getZ(i + 2)
                )
                position.setXYZ(i + 2, x, y, z)
            }
            geometry.computeVertexNormals()
        }
        return geometry
    }
    // The SVG orders its front outline, rear outline, then dot. The dot belongs
    // to the front bubble and must share its transform throughout assembly.
    return source
        ? [makeGeometry(), makeGeometry(true)]
        : [makeGeometry(false, [shapes[0], shapes[2]]), makeGeometry(false, [shapes[1]])]
}
