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
PR #611: `package.json` pinned `0.8.0`, `src/styles/globals.css` imports the token CSS).
T289 bumps the pin to `0.9.0`, which ships the agentic surface below. MCP
Apps is a **standard extension** of MCP ([ext-apps](https://github.com/modelcontextprotocol/ext-apps)),
supported by Claude Desktop and claude.ai (mobile): a tool carries `_meta.ui.resourceUri`,
the host fetches a `text/html;profile=mcp-app` resource, renders it in a sandboxed iframe,
and speaks the ext-apps `postMessage` dialect (`ui/initialize`, tool-result push).

Nomos's own view contract (ADR 0013) predated that standard and chose an **in-house
bridge** — a view rendered its fallback markup in Claude but received no data and returned
no intention. **Nomos v0.9.0 closes that gap**: the view speaks the standard MCP Apps
dialect (Nomos ADR 0033) and the package publishes its view entry
(`@nomosui/react/view` → `renderView({ name | composite, skin?, tokens? })`, `APP_VIEW_MIME`,
`appViewUri`, `compositeViewUri`) plus the compiled utilities (`@nomosui/react/view.css`,
Nomos ADR 0034). `renderView` renders a **catalogue brick or scene** — app-agnostic (Nomos
ADR 0002) — so it cannot render a GymLogic product card; GymLogic still assembles its own
view document from those shared parts.

At decision time, one fact constrained the fabric: GymLogic had **no skin**.
`src/styles/globals.css` painted the app from its legacy vendored `@theme` (`--primary`,
`--border`…), while the heart's **default tokens** already carried GymLogic's identity
(`--nomos-color-primary: 174 100% 39%`, the teal), so app and view agreed by coincidence of
values, not by construction. A named GymLogic skin now closes that gap (§6).

## Decision

We will ship the agentic surface on the **standard MCP Apps contract**, with **Nomos as the
visual source only**, and prove it with the thinnest read-only vertical.

1. **Host is the External MCP Client.** The first host is Claude (Desktop and mobile),
   which speaks MCP Apps. The PWA/Jev is not the v1 host: rendering `ui://` requires an MCP
   Apps host (sandbox iframe + bridge), which is a project in itself.
2. **Dialect is standard MCP Apps, not Nomos's in-house bridge.** A view is a
   `text/html;profile=mcp-app` resource; a tool references it via
   `_meta.ui.resourceUri: 'ui://gymlogic/…'`; the view bridge is built on
   `@modelcontextprotocol/ext-apps` (`App`). Nomos stays the **visual source**: the bricks
   and the published compiled utilities (`@nomosui/react/view.css`). Nomos itself
   implements the dialect without `ext-apps` (to avoid the 2.x SDK tree while its server
   stays on 1.31); GymLogic's server is hand-rolled with **no** MCP SDK, so that reason does
   not apply and the SDK is the simpler choice for the view bundle.
3. **A view never writes.** It emits intentions the host arbitrates, consistent with
   **Write Consent** ([#287](https://github.com/PierreTsia/workout-app/issues/287)). The
   MCP App View is read-only in v1; intensity is the invariant, not a preference.
   *(Amended by [ADR 0028](https://github.com/PierreTsia/workout-app/blob/main/docs/adr/0028-view-intention-and-consent-token.md):
   a view never writes **directly** — it asks the host to call a tool via `tools/call`,
   and the user's click is the consent, materialised by a server-signed **Preview Token**.
   The v1 **Session Card** stays read-only.)*
4. **First vertical: a read-only Session Card.** `ui://gymlogic/session-card` renders the
   athlete's most recent finished **Session** (day label, exercises/Circuits, tonnage) from
   Nomos `Card` / `Badge` / `Meter`, triggered by a dedicated tool `render_session_card`
   (`readOnlyHint: true`, no required parameter) that returns a text summary **and** carries
   `_meta.ui.resourceUri`. A dedicated tool is a new public surface (Nomos ADR 0019's
   `render_<name>` pattern), preferred over mutating an existing read tool's contract. The
   first pass bakes **example data**; binding to `get_workout_history` follows.
5. **The view is a committed build artifact, served by the Edge Function.** A GymLogic-owned
   build (`scripts/build-mcp-view.mjs`, Vite lib + `react-dom/server` + the published
   compiled utilities `@nomosui/react/view.css`) emits the self-sufficient HTML to a
   committed generated module, guarded by a `view:check` in CI. The MCP handler returns that
   committed string with `mimeType: 'text/html;profile=mcp-app'`. No `@mcp-ui/server`
   dependency: the hand-rolled registry already returns `{uri, mimeType, text}`.
6. **Skin: a named GymLogic skin, held.** A named GymLogic skin (`glSkin`,
   `src/styles/glSkin.json`) is merged by `resolveSkin(default, glSkin)` and consumed by
   **both** the app CSS (`src/styles/glSkin.generated.css`, imported by `globals.css`) and
   the view CSS (`scripts/build-mcp-view.mjs` inlines the same artifact). The "identical to
   the app by construction" criterion is **held**: one resolved skin, two renders — the
   committed artifact is the single source, and the `glSkin:check` / `view:check` CI guards
   (pinned at source level by `src/test/glSkin.arch.test.ts`) keep the two renders from
   drifting. For a root with no mode class the artifact follows `prefers-color-scheme`
   (Nomos ADR 0009) where the removed legacy `:root` was hard dark; the app's boot script
   always sets `.dark` / `.light` before paint, so the visible app is unchanged. The legacy
   vendored `@theme` in `src/styles/globals.css` is retired (T306).

## Consequences

- **Positive:** GymLogic gains the agentic differentiator on the standard rails — one
  contract (MCP Apps) shared with Claude and every conforming host, no bespoke protocol to
  maintain. The view bundle is a build artifact, so it cannot silently drift (same regime as
  the arch tests). Read-only stays true: no write from a view, consent unchanged. The "one
  source, two renders" promise is **held**: a single named skin (`glSkin`) drives both the
  app CSS and the view CSS.
- **Negative:** GymLogic still assembles its own view document (SSR markup + bundle + the
  shared utilities) because its Session Card is a product component, not a Nomos brick — a
  small, GL-owned build, not a duplicated design-system pipeline.
- **Follow-ups:** bind the Session Card to real data (`get_workout_history`) instead of the
  baked example payload; close agent-os #75 (base adoption is done in code). The former
  items are **shipped**: the `@nomosui/react` `0.9.0` bump (T289), the `_meta` field on
  `ToolDefinition`, `scripts/build-mcp-view.mjs` + `view:check`, the `render_session_card`
  tool, the `ui://gymlogic/session-card` resource registration, and the arch tests (resource
  mime, `_meta` present, artifact not stale, no write). Nomos upstream delivered in `0.9.0`:
  nomos#99 (bridge on MCP Apps, ADR 0033) and nomos#100 (view entry + compiled utilities,
  ADR 0034). The named skin (§6) closes the last former follow-up (T303–T307).

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| **Nomos's in-house `source:'nomos'` bridge** | Superseded by Nomos 0.9.0 (ADR 0033), which aligns it on MCP Apps; there is no longer a divergent dialect to adopt. |
| **`renderView` from `@nomosui/react/view` for the card** | It renders catalogue bricks and scenes only (app-agnostic, Nomos ADR 0002); a GymLogic Session Card is a product component, so the document is assembled app-side from the shared parts. |
| **`@mcp-ui/server` for the resource** | Three fields (`uri`, `mimeType`, `text`) that the hand-rolled `ResourceDefinition` already returns; a dependency for nothing. |
| **Runtime server-render in the Edge Function** | The host preloads/caches a resource by URI, so a per-user "latest session" baked into a fixed URI would go stale; data reaches a view through the tool-result push — the render belongs at build time. |
| **Build an MCP Apps host in the PWA/Jev first** | An epic of its own (sandbox, bridge, capability policy) before the value is visible; Claude already is that host. |
| **Interactive "modify session" first** | A write surface that cannot complete the `dry_run` + echoed-payload consent in one click, and contradicts the read-only invariant; later, with its own ADR. |
| **Interpolate data into the HTML at `resources/read`** | A resource is not parameterised by the tool call; data reaches a view through the host's tool-result push, i.e. the bridge — which is step two, not the skeleton. |
