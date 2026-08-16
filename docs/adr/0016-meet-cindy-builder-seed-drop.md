# ADR 0016 — Meet Cindy is a Builder seed drop, not a home CTA

- **Status:** Accepted
- **Date:** 2026-08-16
- **Decided in:** grill-with-docs for [#393](https://github.com/PierreTsia/workout-app/issues/393)

## Context

[#398](https://github.com/PierreTsia/workout-app/issues/398) shipped the **Benchmark Circuit** noun: Cindy exists as a catalog row (`slug: cindy`), `instantiateBenchmark` copies Rx onto a day-scoped **Exercise Block**, MCP / **Quick Workout AI** resolve by slug, history / PR group by catalog id, **Circuit Fork** guards seed edits.

[#393](https://github.com/PierreTsia/workout-app/issues/393) was still titled **Do Cindy** — a home / SideDrawer tap that minted an ad-hoc `workout_days` row (`program_id: null`) and landed on pre-session. That was T144's leftover on-ramp (start a named WOD without a program). It does not match how the product is used: people have programs; the missing verb is *put Cindy on Tuesday*.

The Builder already has two add verbs on a **workout day**: **Add Exercise** (solos via `ExerciseLibraryPicker`) and **Create circuit** (jetable **Exercise Block** from picked movements). Neither can resolve a catalog seed. Mixing Cindy into the exercise list would drown a **Benchmark Circuit** among muscle groups. Routing Cindy through **Create circuit** would collide consumption with jetable authoring.

## Decision

We will:

1. Treat **Meet Cindy** (#393) as PWA *consumption*: discover a GymLogic seed and drop it onto the **current programmed day**. Not a home CTA, not an ad-hoc day, not auto-GO, not a new route.
2. Put a kind toggle **Exercises | Circuits** on the **Add Exercise** picker only. **Circuits** lists GymLogic seeds (`owner_id` NULL, `slug` set). Hits are WOD cards (name, mode badge, tagline). Tap → `instantiateBenchmark` + the same PWA insert as `useCreateBlock` → close → `BlockCard` in the **Unified Day Sequence**.
3. Keep **Create circuit**, pre-session add, and `/library` unchanged. Search punches through the kind (`cindy` / `holland`); empty **Exercises** does not promo Cindy. Pencil + **Circuit Fork** stay. Story stays on the history sheet; the picker card has no Info dialog.
4. Never hardcode Cindy's Rx in the client. Catalog JSONB wins.

A no-program home **Do Cindy** button is a later on-ramp (when the **Circuit Catalog** shelf exists), not this issue.

## Consequences

- **Positive:** Cindy is discoverable where days are edited. One write primitive (`instantiateBenchmark`) serves QW, MCP, and Builder. The picker kind split survives Zeus / a larger seed list. Home and `/library` jobs stay intact.
- **Negative:** Users without a program still cannot start Cindy in one tap from home. The **Add Exercise** sheet now hosts two catalogs (type split to maintain).
- **Follow-ups:** Rewrite #393 to this decision. Epic Brief / Tech Plan for the Builder picker. Home CTA as its own issue when the shelf is real.

## Alternatives considered

| Option | Why we didn't pick it |
|---|---|
| Home / SideDrawer **Do Cindy** → ad-hoc day | Wrong verb for programmed training; resurrects T144's on-ramp as the hero |
| Third DayEditor button | Three add verbs; Cindy hidden from the search people already use |
| Mix Cindy into the exercise list | Drowns a **Benchmark Circuit** in muscle groups; confirm-as-solos is a type error |
| Circuits tab inside **Create circuit** | That button authors jetables; Cindy + a curl as one confirm is nonsense |
| MCP `update_program` from the PWA | Builder mutations are already client Supabase; a roundtrip invents a second UX wait for the same `instantiateBenchmark` |
| Freeze the `BlockCard` pencil | Second regime for one component; T196 already confirms a **Circuit Fork** |
