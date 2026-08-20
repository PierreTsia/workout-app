# ADR 0013 — Product Tour is a separate `/tour` surface

- **Status:** Accepted
- **Date:** 2026-08-11
- **Decided in:** grill-with-docs + Epic Brief for [#466](https://github.com/PierreTsia/workout-app/issues/466)

## Context

The Astro mini-site homepage (`file:web/src/pages/index.astro`) already sells GymLogic as an **agentic / MCP / open-source** product. That pitch is real and should stay. Separately, the product surface (session floor, progression, Quick Workout, BYOA, catalog explainers, history / Strength Balance, achievements) is under-told for lifters and demos.

Folding a full capability journey into `/` would either dilute the agentic homepage or bury the Tour. A second marketing skin just for Tour would fork the brand.

## Decision

We will:

1. **Ship the Product Tour at `/tour`** with nav label **Tour**, implemented in the Astro mini-site (`web/`), not in the PWA.
2. **Leave `/` and `/about` unchanged** aside from adding the Tour nav link.
3. **Reuse the existing mini-site design tokens** (`file:web/DESIGN.md` / `file:web/src/styles/global.css`) at larger composition — not a second brand.
4. **Use a desktop Tour Split Stage** (sticky rail 01–06 + device stage) as the v1 interaction model; mobile stays linear. Stitch mocks are design reference only; Astro is source of truth.

## Consequences

- **Positive:** Two honest jobs — homepage = agentic pitch; Tour = product capability. Demoable narrative without rewriting `/`.
- **Negative:** One more nav item and route to maintain; copy can drift from the live app if captures lag.
- **Follow-ups:** Epic Brief `file:docs/done/Epic_Brief_—_Product_Tour_(tour)_#466.md`; Tech Plan for Astro architecture + **Prime Mover** capture pipeline; glossary term **Product Tour**.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| Replace homepage with Tour | Loses the agentic / MCP story that `/` already owns |
| `/features` laundry list | Feature matrices die on scroll; we locked a journey |
| New visual skin only for Tour | Two brands; rejected in grill |
| Tour inside the PWA | Wrong surface; marketing job lives on the mini-site |
