# Math Kit Architecture

## Purpose

Math Kit is SilkChat's user-facing mathematical workspace. It combines scoped scientific computation with native interactive visualizations so the assistant can calculate, verify, and present mathematical results without routing every task through general-purpose code execution or Canvas.

The internal ability ID is `mathematical_instruments`. Enabling it can expose three distinct tools:

- `execute_math` performs bounded Python computation in an isolated Vercel Sandbox.
- `render_chart` renders supplied numeric data as a native chart.
- `render_network` renders supplied nodes and edges as a native network.

These tools share one product toggle but have deliberately different execution, cost, and failure semantics.

## Product principles

1. **Use the smallest sufficient instrument.** Trivial arithmetic belongs in the answer. Supplied visualization data should go directly to a renderer. Non-trivial derivation should use `execute_math` first.
2. **Keep computation and presentation separate.** Renderers display validated data; they do not execute code, derive values, or run graph algorithms.
3. **Prefer native output.** Use native charts and networks instead of Canvas, Mermaid, HTML, React, ASCII art, Matplotlib images, or other generated images when the native contracts fit.
4. **Keep Math Kit independent from Code Execution.** The Math Kit toggle does not depend on the separate Code Execution toggle. `execute_math` may be available even when `execute_code` is not enabled by the user.
5. **Bound every input.** Schemas cap titles, labels, series, data points, nodes, edges, code, and execution time before work begins.
6. **Preserve useful zero-cost presentation.** Native renderers use a deliberate soft-stop budget policy described below. Metered and external tools remain hard stops.

## Tool routing

The system prompt gives the model these routing rules:

- Answer trivial arithmetic directly.
- Use `execute_math` for non-trivial symbolic algebra, numerical methods, statistics, data analysis, units, and graph algorithms.
- Call `render_chart` or `render_network` directly when the user has already supplied all required data.
- When computation produces a visualization, call `execute_math` first and pass only the useful computed data to the appropriate renderer.
- Use `execute_code` for general-purpose JavaScript or Python, arbitrary dependencies, software testing, internet retrieval, or persistent filesystem work.
- Do not call both executors for the same calculation.

The callable tool list is authoritative. Math Kit can remain enabled while `execute_math` is absent if the deployment has no sandbox backend; the native renderers still work.

## Availability and identity

`mathematical_instruments` is deployment-independent because its native renderers run locally in the conversation UI. The backend exposes the ability as available even without Vercel Sandbox credentials.

`execute_math` is added to the toolkit only when code-execution deployment credentials are available. It uses the same sandbox backend as `execute_code`, but it is selected through Math Kit and does not require the Code Execution ability to be enabled.

Math Kit is withheld from anonymous sessions. The entire ability requires an authenticated user, including the otherwise local renderers, so its identity policy stays aligned with sandbox-backed mathematical computation.

Models without function-calling support cannot enable or call Math Kit.

## Scientific execution

`execute_math` runs Python 3.13 in an ephemeral Vercel Sandbox with a fixed scientific environment:

- SymPy
- NumPy
- SciPy
- pandas
- Matplotlib
- NetworkX
- statsmodels
- Pint

The model supplies a short user-facing purpose, Python code, and an optional bounded timeout. The dependency set is owned by SilkChat rather than supplied by the model. Calls use an ephemeral sandbox and cannot opt into the persistent-workspace lifecycle exposed by general Code Execution.

Math execution reuses the established code-execution output and artifact pipeline. Stdout, stderr, exit status, duration, truncation state, exported artifacts, and artifact errors appear in the normal code-execution UI. Artifacts are promoted into durable assistant file parts during stream persistence.

Use Matplotlib for calculations that require it, but do not generate a chart image when `render_chart` can represent the result natively.

## Native charts

`render_chart` accepts line, bar, area, and scatter charts. Its contract includes:

- a required title and optional description;
- a category or linear horizontal scale;
- optional axis labels, legend, and stacking;
- one to five named numeric series; and
- one to 500 data rows.

Every row must contain a string or numeric horizontal-axis value. Scatter charts and linear scales require numeric horizontal values. Series values must be finite numbers or `null`, series keys must be unique, and a series key cannot also be the horizontal-axis key.

The renderer uses Recharts and theme-backed chart variables. Linear scales should be used for sampled mathematical functions and other continuous numeric axes. The model should provide enough ordered samples for a smooth curve while keeping the dataset no larger than useful.

## Native networks

`render_network` accepts up to 100 nodes and 300 edges. It supports `cose`, `circle`, `grid`, `breadthfirst`, and `concentric` layouts.

Node IDs must be unique. Every edge source and target must reference an existing node, and explicit edge IDs must be unique. The Cytoscape renderer places edges in an internal namespace so an explicit edge ID can never collide with a node ID inside Cytoscape's global element-ID space.

Node groups map to the active theme's chart palette. Optional node values and edge weights control relative sizing. Directed graphs receive arrowheads.

Cytoscape is loaded dynamically only when a network mounts, keeping it out of ordinary chat startup. The mounted graph observes root theme changes and refreshes its node colors and stylesheet without rerunning the selected layout.

## Tool-call budget policy

The per-turn tool-call budget serves two jobs: it limits costly work and gives the model a clear signal to stop making tool calls. Math Kit intentionally distinguishes hard and soft stops.

### Hard stops

`execute_math` is deployment-funded sandbox work. When the tool budget is exhausted, the server rejects the call and no sandbox execution occurs. The call is provisionally metered through the normal tool-usage path and reconciled to reported sandbox usage.

External, metered, and side-effecting tools should follow the same hard-stop rule.

### Soft stops

`render_chart` and `render_network` are local deterministic presentation tools. By the time a model proposes a valid renderer input, the useful data has already been generated and rendering it has no external API or sandbox cost.

When the budget is exhausted, the model still receives a structured rejection and should respect it as a stop signal. The client may nevertheless recover the validated renderer input and display the chart or network. This preserves useful output that already exists while maintaining behavioral pressure on the model.

This is intentional graceful degradation, not an exemption from the tool budget. Do not change the server result to success and do not make native renderers budget-exempt merely because the client can salvage their input.

The recovery rule must remain narrow in spirit: budget exhaustion is a soft presentation stop, while malformed input and genuine rendering failures are errors. Avoid hiding unrelated failures behind input recovery.

## Persistence and replay

Native tool execution returns a typed replayable result:

- charts use `{ success: true, kind: "native_chart", chart }`;
- networks use `{ success: true, kind: "native_network", network }`.

The client validates persisted output again before rendering it. Valid input can support the soft-stop recovery path, but persisted successful output remains the normal source of truth.

`execute_math` parts are grouped with `execute_code` parts in the existing code-execution summary. The client forces their displayed language to Python because language is fixed by the Math Kit contract rather than supplied in tool input.

## Metering

Native chart and network rendering has no upstream usage charge. Calls still participate in the per-turn call limit.

`execute_math` uses the code-execution deployment funding source and the configured `execute_math` tool rate for provisional reservation. Its default flat reservation is currently the same as `execute_code`. Final billing metadata is stripped from model-visible output and reconciled through the shared sandbox settlement path.

## Important files

- `src/lib/tool-abilities.ts`: ability ID registry
- `convex/lib/tools/availability.ts`: availability and anonymous-session policy
- `convex/lib/tools/native_chart.ts`: Math Kit tool definitions and adapter
- `convex/lib/tools/code_execution_node.ts`: sandbox execution and artifact export
- `convex/chat_http/prompt.ts`: model-facing routing guidance
- `convex/chat_http/post.route.ts`: tool budgeting, funding, and metering
- `convex/chat_http/manual_stream_transform.ts`: durable math artifacts
- `src/lib/native-chart.ts`: native chart schema and replay validation
- `src/lib/native-network.ts`: native network schema and replay validation
- `src/components/renderers/native-chart-tool.tsx`: chart UI
- `src/components/renderers/native-network-tool.tsx`: network UI
- `src/lib/message-code-executions.ts`: shared execution grouping
- `src/components/tool-selector-popover.tsx`: desktop Math Kit control
- `src/components/multimodal-input.tsx`: mobile Math Kit control

## Invariants

- Keep the user-facing name **Math Kit** and the internal ability ID `mathematical_instruments` distinct and documented.
- Do not make Math Kit depend on the user's Code Execution toggle.
- Do not expose `execute_math` without a configured sandbox backend.
- Keep `execute_math` Python-only, ephemeral, and limited to the fixed scientific dependency set.
- Keep native renderers deterministic and free of backend computation.
- Preserve the hard-stop semantics for metered execution and the intentional soft-stop semantics for native rendering.
- Validate renderer inputs and persisted outputs at their boundaries.
- Keep Cytoscape lazy-loaded and its internal edge IDs collision-safe.
- Use theme variables for all renderer styling and update mounted canvas-based graphs when the theme changes.
- Promote math-execution artifacts through the same durable file pipeline as general code execution.

## Testing

Relevant suites include:

- `tests/lib/native-chart.spec.ts`
- `tests/lib/native-network.spec.ts`
- `tests/components/native-chart-tool.spec.ts`
- `tests/components/native-network-tool.spec.ts`
- `tests/lib/message-code-executions.spec.ts`
- `tests/lib/tool-availability.spec.ts`
- `tests/lib/usage-metering.spec.ts`
- `tests/backend/manual-stream-transform.spec.ts`
- `tests/backend/prompt.spec.ts`

Follow [Test Writing Guide](./TEST_WRITING_GUIDE.md). Run the complete suite with:

```sh
bun run test
```

Run static type checking with:

```sh
bun run check-types
```
