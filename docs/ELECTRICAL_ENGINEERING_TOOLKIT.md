# Electrical Engineering Toolkit

## Purpose

The Electrical Engineering Toolkit gives SilkChat electrical-domain computation and native,
replayable circuit visuals. Its internal ability ID is `electrical_engineering`.

The first release exposes three tools:

- `analyze_circuit` performs bounded unit-aware linear circuit analysis in an ephemeral Vercel
  Sandbox.
- `render_schematic` lays out and renders a circuit as native React/SVG UI.
- `render_electrical_plot` renders native waveform, phasor, and Bode views from completed numeric
  data.

The ability is separate from Math Kit and Code Execution. Its native renderers remain available
when the sandbox backend is unavailable; `analyze_circuit` does not.

## Supported analysis

Release-one analysis supports:

- DC operating points;
- single-frequency AC phasor analysis;
- bounded logarithmic AC sweeps;
- small symbolic SISO transfer functions; and
- Thevenin and Norton equivalents at a declared port.

The solver supports resistors, capacitors, inductors, and independent ideal voltage/current
sources. DC treats capacitors as open circuits and inductors as near-ideal shorts. Analysis uses
modified nodal analysis with NumPy for numeric solutions and SymPy for bounded symbolic transfer
functions.

The following are intentionally not analyzed: diodes, LEDs, dependent sources, switches,
transistors, MOSFETs, transformers, op-amps, arbitrary SPICE models, and other nonlinear devices.
Some of these components are renderable. Rendering support must never be presented as analysis
support.

## Circuit contract

Structured circuit input is canonical. Every circuit includes a title and a bounded component
array. Components declare an ID, type, connected node IDs, and any required unit-bearing value or
source. Ground is node `0`.

Current is positive from the first declared component node to the second. Ports explicitly declare
positive and negative nodes. Component IDs and node IDs are unique and bounded.

Quantities accept explicit Pint-compatible units, including common forms such as `1 kohm`,
`100 nF`, `5 V`, and `2.4 GHz`. Bare compact engineering suffixes such as `1k`, `10u`, and `22n`
are interpreted using the expected dimension for that field. Internally the solver normalizes to
SI values. Solver output includes units and both rectangular and polar complex values.

No Python, SymPy expression, SVG, HTML, CSS, or other executable input crosses the public tool
boundary.

## Native schematic rendering

Common source-referenced series and parallel networks first use a deterministic electrical rail
layout: the source sits beside conventional supply and ground rails, series components form ordered
branches, parallel branches sit side by side, and intermediate nets become explicit junctions.
This prevents a generic graph layout from reversing component order or wrapping wires around the
diagram.

Circuits that cannot be safely decomposed into independent rail-to-ground paths use a controlled
fallback. The client lazy-loads `elkjs` and builds a port-aware layered graph for that fallback. ELK
computes placement and orthogonal routes only. SilkChat owns the actual React/SVG symbol primitives,
labels, wires, junction dots, theme styling, focus view, and persisted replay.

Wire crossings never imply a connection. Nets are represented explicitly and junctions receive a
dot. The renderer uses theme variables and the shared native visualization shell; it does not use
Mermaid, Circuitikz, Canvas, generated images, or an embedded circuit editor.

Supply/source nets use the first theme chart colour, conventional input/output signal nets use the
second chart colour, other signal nets rotate through the remaining chart palette, and ground uses
the muted foreground. Components keep a restrained semantic colour while labels reserve separate
ID and value lines to avoid model-supplied label duplication.

## Electrical plots

`render_electrical_plot` accepts complete numeric data and never evaluates formulas.

- Waveforms use a zero reference, scope-like grid, channel units, and numeric time data.
- Bode plots use logarithmic frequency axes with synchronized magnitude/phase data.
- Phasor diagrams use polar arrows with magnitude and phase labels.

Waveform and Bode plots reuse Recharts. Phasors use native SVG.

## Execution and metering

`analyze_circuit` generates a fixed Python program owned by SilkChat and runs it in an ephemeral
Python 3.13 Vercel Sandbox with SymPy, NumPy, SciPy, and Pint. The model supplies circuit data and an
operation, not solver code or dependencies.

Analysis is a deployment-funded hard stop and uses sandbox-reported billing reconciliation.
Native rendering has no upstream charge. Renderer calls still consume the per-turn tool-call budget
and follow the narrow soft-stop recovery rule: valid renderer input may be recovered only when the
server output reports `tool_budget_exhausted`.

## Diagnostics

Solver failures return typed data rather than plausible partial results. Current diagnostic codes
include:

- `invalid_quantity`
- `missing_ground`
- `unsupported_component_for_analysis`
- `singular_matrix`
- `unknown_port`
- `unknown_source`
- `invalid_sweep`
- `invalid_equivalent`
- `symbolic_limit_exceeded`
- `unsupported_analysis`
- `solver_failed`

## Important files

- `src/lib/electrical-engineering.ts`: shared schemas and replay validation
- `convex/lib/tools/electrical_engineering.ts`: tool definitions and adapter
- `convex/lib/electrical/solver_program.ts`: fixed solver program generator
- `src/components/renderers/electrical-schematic-tool.tsx`: ELK-backed native schematic renderer
- `src/lib/electrical-schematic-layout.ts`: deterministic rail/path topology layout
- `src/components/renderers/electrical-plot-tool.tsx`: waveform, Bode, and phasor renderers
- `src/components/renderers/circuit-analysis-tool.tsx`: structured analysis result UI
- `convex/chat_http/prompt.ts`: model routing and limitations
- `tests/lib/electrical-engineering.spec.ts`: contracts, replay, registration, and analysis adapter

## Verification

Use the repository-standard commands:

```text
bun run check-types
bun run test
```

The fixed solver has also been compatibility-tested in the configured Python 3.13 Vercel Sandbox
against DC, AC-point, AC-sweep, and symbolic transfer-function fixtures. Visual verification remains
manual because the application is authentication-gated.
