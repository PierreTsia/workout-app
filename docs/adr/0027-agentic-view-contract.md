# ADR 0027 — MCP App views follow the standard MCP Apps contract, Nomos as visual source

- **Status:** Accepted
- **Date:** 2026-10-03
- **Decided in:** grilling session (`grill-with-docs`) for [#591](https://github.com/PierreTsia/workout-app/issues/591)

## Context

GymLogic is MCP-native (11 tools, 1 resource, no prompt, no view) but thin on the agentic
axis: its MCP server exposes the **Tool Annotation** surface and one JSON resource, and
nothing a host can *render*. [#591](https://github.com/PierreTsia/workout-app/issues/591)
opens the agentic surface: real GymLogic composites shown in the conversation.

`@nomosui/react` is now public and GymLogic already consumes it app-side (phase 1 #583,
PR #611: `package.json` pins `0.8.0`, `src/styles/globals.css` imports the token CSS). MCP
Apps is a **standard extension** of MCP ([ext-apps](https://github.com/modelcontextprotocol/ext-apps)),
supported by Claude Desktop and claude.ai (mobile): a tool carries `_meta.ui.resourceUri`,
the host fetches a `text/html;profile=mcp-app` resource, renders it in a sandboxed iframe,
and speaks the ext-apps `postMessage` dialect (`ui/initialize`, tool-result push).

Nomos's own view contract (ADR 0013) predates that standard and chose an **in-house
bridge**: the view only listens for `{source:'nomos', type:'set-view'|'set-data'}` and only
emits `{source:'nomos', type:'intent'}` (`src/mcp/view/bridge.ts`). A Nomos view *renders*
in Claude (its pre-rendered markup is self-sufficient) but **never receives data and never
returns an intention** there — the data-driven composite #591 targets is dead in a real
host. Nomos ADR 0013 anticipated this: "the day the SDK decides, we align."

Two facts constrain the fabric: `@nomosui/react` publishes only `.` (with `resolveSkin`,
`renderCss`), the token CSS and `tokens.json` — **not** the view builder (`buildAppView`),
the view bundle (`VIEW_BUNDLE`) or the compiled utilities (`VIEW_CSS`). And GymLogic has
**no skin**: `src/styles/globals.css` still paints the app from its legacy vendored
`@theme` (`--primary`, `--border`…), while the heart's **default tokens** already carry
GymLogic's identity (`--nomos-color-primary: 174 100% 39%`, the teal). App and view agree
by coincidence of values, not by construction.

## Decision

We will ship the agentic surface on the **standard MCP Apps contract**, with **Nomos as the
visual source only**, and prove it with the thinnest read-only vertical.

1. **Host is the External MCP Client.** The first host is Claude (Desktop and mobile),
   which speaks MCP Apps. The PWA/Jev is not the v1 host: rendering `ui://` requires an MCP
   Apps host (sandbox iframe + bridge), which is a project in itself.
2. **Dialect is standard MCP Apps, not Nomos's in-house bridge.** A view is a
   `text/html;profile=mcp-app` resource; a tool references it via
   `_meta.ui.resourceUri: 'ui://gymlogic/…'`; the view bridge is built on
   `@modelcontextprotocol/ext-apps` (`App`). Nomos stays the **visual source**: the bricks,
   `renderCss(resolveSkin(…))` and, when published or locally built, the utility CSS. We do
   not adopt Nomos's `source:'nomos'` bridge.
3. **A view never writes.** It emits intentions the host arbitrates, consistent with
   **Write Consent** ([#287](https://github.com/PierreTsia/workout-app/issues/287)). The
   MCP App View is read-only in v1; intensity is the invariant, not a preference.
4. **First vertical: a read-only Session Card.** `ui://gymlogic/session-card` renders the
   athlete's most recent finished **Session** (day label, exercises/Circuits, tonnage) from
   Nomos `Card` / `Badge` / `Meter`, triggered by a dedicated tool `render_session_card`
   (`readOnlyHint: true`, no required parameter) that returns a text summary **and** carries
   `_meta.ui.resourceUri`. A dedicated tool is a new public surface (Nomos ADR 0019's
   `render_<name>` pattern), preferred over mutating an existing read tool's contract. The
   first pass bakes **example data**; binding to `get_workout_history` follows.
5. **The view is a committed build artifact, served by the Edge Function.** A GymLogic-owned
   build (`scripts/build-mcp-view.mjs`, Vite lib + `react-dom/server` + the app's Tailwind
   over `@nomosui/react`) emits the self-sufficient HTML to a committed generated module,
   guarded by a `view:check` in CI. The MCP handler returns that committed string with
   `mimeType: 'text/html;profile=mcp-app'`. No `@mcp-ui/server` dependency: the hand-rolled
   registry already returns `{uri, mimeType, text}`.
6. **Skin: ride the heart's default tokens for v1, claim degraded.** The view is styled
   from the heart's default tokens, which carry GymLogic's identity, for the skeleton. The
   "identical to the app by construction" criterion is **explicitly degraded** to "same
   source (the heart default)": a named GymLogic skin (`resolveSkin(default, glSkin)`)
   consumed by **both** app CSS and view CSS is a follow-up, **gated on retiring the legacy
   vendored `@theme`** in `src/styles/globals.css`. Trigger to revisit: GymLogic's brand
   diverges from the heart's default, or Nomos neutralises that default.

## Consequences

- **Positive:** GymLogic gains the agentic differentiator on the standard rails — one
  contract (MCP Apps) shared with Claude and every conforming host, no bespoke protocol to
  maintain. The view bundle is a build artifact, so it cannot silently drift (same regime as
  the arch tests). Read-only stays true: no write from a view, consent unchanged.
- **Negative:** the "one source, two renders" promise is only half-honoured until a real
  skin exists; the app still has two colour layers (legacy `@theme` + heart tokens). The
  view needs its own build pipeline in GymLogic because Nomos does not publish its view
  builder or compiled utilities — a duplicated tool, tolerated until Nomos exports them.
- **Follow-ups:** add the `_meta` field to `ToolDefinition` and surface it in
  `tools/list`; register `ui://gymlogic/session-card` in the resource registry; add
  `scripts/build-mcp-view.mjs` + `view:check`; write the `render_session_card` tool; extend
  the arch tests (resource mime, `_meta` present, artifact not stale, no write). Nomos
  tickets filed: [#99](https://github.com/PierreTsia/nomos/issues/99) (align its own bridge
  to MCP Apps) and [#100](https://github.com/PierreTsia/nomos/issues/100) (publish the view
  builder and utility CSS). Close agent-os #75 (base adoption is done in code).

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **Nomos's in-house `source:'nomos'` bridge, as-is** | Renders statically in Claude but exchanges neither data nor intentions — the data-driven composite is unreachable in a real host, and the dialect is a dead end. |
| **`@mcp-ui/server` for the resource** | Three fields (`uri`, `mimeType`, `text`) that the hand-rolled `ResourceDefinition` already returns; a dependency for nothing. |
| **Runtime server-render in the Edge Function** | Deno has no Tailwind/React build at request time, and the utilities are not published; the render belongs at build time. |
| **Build an MCP Apps host in the PWA/Jev first** | An epic of its own (sandbox, bridge, capability policy) before the value is visible; Claude already is that host. |
| **Interactive "modify session" first** | A write surface that cannot complete the `dry_run` + echoed-payload consent in one click, and contradicts the read-only invariant; later, with its own ADR. |
| **Interpolate data into the HTML at `resources/read`** | A resource is not parameterised by the tool call; data reaches a view through the host's tool-result push, i.e. the bridge — which is step two, not the skeleton. |
