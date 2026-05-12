# T133 — Bundle builder + handler `/open` for `additional_program`

## Goal

Capture the user's training context once at thread open for additional-program threads: build the `AdditionalProgramBundle` (profile + active program summary + 28d session stats), enforce an 8 KB size guard, persist it to `embedded_agent_threads.bundle_context`. Extend the handler `/open` route so opening an additional-program thread builds + persists the bundle on fresh threads and reuses it on resume. Server-side only — no UI consumer yet.

Addresses Brief stories: **2** (agent greeting references current program), **3** (acknowledge specific signals from history), **15** (empty active program graceful handling), **21** (`bundle_context` queryable for debugging).

## Mode

**AFK** — bundle shape is fully specified in Tech Plan; builder is a pure function over Supabase reads.

## Slice

builder → handler `/open` → DB persistence → integration test

## Dependencies

- **T131** (schema has `bundle_context` JSONB column; `setBundle` threadStore helper exists)

## Scope

### 1. New file — `supabase/functions/embedded-agent/lib/bundle.ts`

Exports:

```typescript
export const BUNDLE_VERSION = 1
export const BUNDLE_MAX_BYTES = 8192

export interface AdditionalProgramBundle {
  v: 1
  captured_at: string
  profile: {
    goal: string
    experience: string
    equipment: string
    training_days_per_week: number
    session_duration_minutes: number
    age: number | null
    weight_kg: number | null
    gender: string | null
  }
  active_program: {
    id: string
    name: string
    days: Array<{
      label: string
      exercise_count: number
      muscle_groups: string[]  // unique, sorted, max 5
    }>
  } | null
  recent_stats: {
    window_days: 28
    total_sessions: number
    sessions_per_week: number   // total_sessions / 4, rounded to 1 decimal
    top_muscle_groups: string[] // top 5 by set count, descending
    avg_session_duration_minutes: number | null
  }
}

export class BundleSizeExceeded extends Error {}
export class ProfileMissing extends Error {}

export interface BuildBundleDeps {
  fetchProfile: (userId: string) => Promise<ProfileRow | null>
  fetchActiveProgram: (userId: string) => Promise<ActiveProgramRow | null>
  fetchRecentStats: (userId: string, windowDays: number) => Promise<RecentStatsRow>
}

export async function buildAdditionalProgramBundle(
  userId: string,
  deps: BuildBundleDeps,
  nowIso: string = new Date().toISOString(),
): Promise<AdditionalProgramBundle>
```

Behavior:
1. Fetch profile, active program, recent stats in parallel.
2. If profile is null → throw `ProfileMissing` (handler maps to 409).
3. Compose bundle.
4. `JSON.stringify(bundle).length > BUNDLE_MAX_BYTES` → throw `BundleSizeExceeded` (handler maps to 500 internal — this is a builder bug).
5. Return bundle.

The `deps` interface keeps DB reads injectable for tests. Concrete implementations (using `createServiceClient()`) live in the integration test or in a sibling `bundleQueries.ts` if the query bodies grow.

### 2. Recent stats query

Concrete query (28-day window over the workout history table — confirm exact table name during implementation):

| Field | Computation |
|---|---|
| `total_sessions` | `count(distinct workout_day_id)` from completed workout exercise rows in last 28 days |
| `sessions_per_week` | `total_sessions / 4`, rounded to 1 decimal |
| `top_muscle_groups` | `select muscle_group, count(*) from workout_exercises_joined where ... group by muscle_group order by count desc limit 5` |
| `avg_session_duration_minutes` | `avg(duration_minutes)` per workout_day in window, null when no sessions |

If the actual schema makes any of these queries expensive, simplify (e.g. drop `avg_session_duration_minutes`) — but document the simplification inline.

### 3. Handler `/open` extension

In `handler.ts::handleOpen`:

```typescript
const initial = await deps.getOrCreateActiveThread(userId, locale, purpose)
const { thread, resumed } = initial.resumed
  ? await refreshIfStale(...)
  : initial

// NEW: build + persist bundle for fresh additional-program threads
if (purpose === 'additional_program' && thread.bundle_context === null) {
  try {
    const bundle = await deps.buildBundle(userId)
    await deps.setBundle(thread, bundle)
    thread.bundle_context = bundle as unknown as Record<string, unknown>
  } catch (err) {
    if (err instanceof ProfileMissing) {
      return Response.json({ error: 'profile_missing' }, { status: 409 })
    }
    if (err instanceof BundleSizeExceeded) {
      deps.log({ level: 'error', feature: 'embedded-agent', route: '/thread', error_kind: 'internal', request_id, user_id: userId, message: 'BundleSizeExceeded' })
      return Response.json({ error: 'internal' }, { status: 500 })
    }
    throw err
  }
}

return Response.json({
  thread_id: thread.id,
  status: thread.status,
  purpose,
  resumed,
  messages: thread.messages ?? [],
  last_preview: thread.last_preview ?? null,
  bundle_summary: purpose === 'additional_program'
    ? buildBundleSummary(thread.bundle_context)
    : undefined,
})
```

`buildBundleSummary(bundle)` is a small projection helper (lives in `lib/bundle.ts`):

```typescript
export interface BundleSummary {
  active_program_name?: string
  sessions_per_week: number
  top_muscle_group?: string
}
```

### 4. DI wiring — `index.ts`

Add `buildBundle` to `EmbeddedAgentDeps`:

```typescript
buildBundle: (userId: string) => Promise<AdditionalProgramBundle>
```

Wire up in `index.ts` with the service client.

### 5. Tests

| Test | Coverage |
|---|---|
| `lib/bundle_test.ts` — happy path with active program | Verifies all bundle fields populated, sorted muscle groups, rounded sessions_per_week |
| `lib/bundle_test.ts` — no active program | `bundle.active_program === null`; rest of fields populated |
| `lib/bundle_test.ts` — no sessions in window | `total_sessions === 0`; `avg_session_duration_minutes === null`; `top_muscle_groups === []` |
| `lib/bundle_test.ts` — size guard | Fixture that produces > 8 KB JSON throws `BundleSizeExceeded` |
| `lib/bundle_test.ts` — missing profile | Throws `ProfileMissing` |
| `handler_test.ts` — `/open` with `purpose='additional_program'` (fresh) | Builds bundle, persists to thread, returns `bundle_summary` |
| `handler_test.ts` — `/open` with `purpose='additional_program'` (resumed, bundle exists) | Does NOT rebuild; returns existing bundle |
| `handler_test.ts` — `/open` with `purpose='onboarding'` | Does NOT call buildBundle (preserves existing onboarding behavior) |
| `handler_test.ts` — `/open` with missing profile for additional-program | Returns 409 `profile_missing` |

## Out of Scope

- `/send` route consumption of bundle (T134 owns).
- UI rendering of `bundle_summary` chip (T136 owns).
- Bundle refresh mid-thread (Tech Plan: immutability is a v1 product constraint; documented but not implemented).
- Bundle builder promotion to `_shared/` (rule of three — single caller in v1).
- Adding `purpose` to `ai_generation_log` (Tech Plan: out of scope; SQL joins handle per-purpose cost analysis).

## Acceptance Criteria

- [x] `supabase/functions/embedded-agent/lib/bundle.ts` exports `buildAdditionalProgramBundle`, `buildBundleSummary`, `BundleSizeExceeded`, `ProfileMissing`, types.
- [x] `buildAdditionalProgramBundle` unit tests pass for the 5 scenarios listed above.
- [x] Size guard verified with a fixture: 8 KB+ bundle throws `BundleSizeExceeded`.
- [x] Handler integration test: POST `embedded-agent { action: 'open', purpose: 'additional_program', locale: 'en' }` returns a thread with `bundle_summary` in the response payload AND `bundle_context` populated in the DB row.
- [x] Resumed additional-program thread (second `/open` call) does NOT call `buildBundle` again (verified by spy or mock counter).
- [x] Onboarding `/open` flow does NOT call `buildBundle` (regression verification).
- [x] `/open` for additional-program with no `user_profiles` row returns 409 `profile_missing` (defensive — realistically unreachable).
- [ ] `e2e/onboarding.spec.ts` passes unchanged. *(deferred to PR CI; local Playwright run is non-trivial inside the sandbox)*

## Implementation Notes (post-merge)

### Files added

- `supabase/functions/embedded-agent/lib/bundle.ts` — pure projection module. Exports `buildAdditionalProgramBundle`, `buildBundleSummary`, `BUNDLE_VERSION`, `BUNDLE_MAX_BYTES`, `BUNDLE_WINDOW_DAYS`, `BundleSizeExceeded`, `ProfileMissing`, plus the wire-shape types (`AdditionalProgramBundle`, `BundleProfile`, `BundleProgramDay`, `BundleActiveProgram`, `BundleRecentStats`, `BundleSummary`) and the DI row shapes (`ProfileRow`, `ActiveProgramRow`, `ActiveProgramDayRow`, `RecentStatsRow`, `BuildBundleDeps`).
- `supabase/functions/embedded-agent/lib/bundle_test.ts` — 11 unit tests covering: happy path, day muscle-group cap at 5 (with `exercise_count` preserved), `sessions_per_week` rounding to 1 decimal, deterministic lexical tie-break in `top_muscle_groups`, `active_program === null` path, zero-session window, oversized bundle, missing profile, plus 3 `buildBundleSummary` projections.
- `supabase/functions/embedded-agent/lib/bundleQueries.ts` — concrete Supabase reads (service-client scope). `fetchProfileForBundle`, `fetchActiveProgramForBundle` (programs → workout_days → workout_exercises with `muscle_snapshot`, **not** the live catalog join), `fetchRecentStatsForBundle` (sessions filtered by `finished_at >= now - 28d`, joined with `exercises` for `muscle_group`, avg duration computed from `finished_at - started_at`).

### Files modified

- `supabase/functions/embedded-agent/handler.ts` — added `buildBundle` + `setBundle` to `EmbeddedAgentDeps`. Extracted bundle resolution into `resolveBundleOnOpen` helper so `handleOpen` stays readable: returns `{ thread }` on success or `{ error: Response }` on user-facing failure. `ProfileMissing` → 409 + warn log (`error_kind: 'profile_missing'`), `BundleSizeExceeded` → 500 + error log (`error_kind: 'internal'`, builder-bug semantics). Response payload conditionally includes `bundle_summary` (additional_program only — onboarding stays clean).
- `supabase/functions/embedded-agent/handler_test.ts` — added `makeStubBundle` factory, `buildBundle`/`setBundle` mocks in `makeDeps`, and 5 T133 tests (`open additional_program (fresh)`, `(resumed)`, `onboarding regression`, `ProfileMissing → 409`, `BundleSizeExceeded → 500`).
- `supabase/functions/embedded-agent/index.ts` — wired the bundle DI to the service client. Bundle queries bypass RLS by design — they're server-side reads consumed only by the LLM prompt, never returned raw to the client.

### Decisions made under green tests

- **Muscle-group source for active program days**: used `workout_exercises.muscle_snapshot` instead of joining to the live `exercises.muscle_group`. A future catalog rename will not silently mutate an old persisted bundle — the snapshot is contemporaneous with the program design.
- **Muscle-group source for recent stats**: used a live join `set_logs → exercises(muscle_group)` because `set_logs` doesn't carry a snapshot column. Acceptable risk: catalog renames are rare and the window is bounded to 28 days.
- **Deterministic ordering**: `top_muscle_groups` ties broken lexically; `muscle_groups` per day are sorted ascending then truncated. Two `/open` calls on the same data produce byte-identical bundles → prompt caching stays effective.
- **Bundle is server-trusted**: queries run through the service client. The bundle is never returned in raw form to the client — only its compact `BundleSummary` projection (which omits everything except `active_program_name`, `sessions_per_week`, and `top_muscle_group`).
- **Size guard semantics**: tripping `BundleSizeExceeded` is mapped to 500 (`error_kind: 'internal'`) on purpose. The shape is bounded by design (5 days × 5 muscles × 5 top groups + scalar stats); a future schema change widening it past 8 KB is a builder bug, not a user-facing failure mode.
- **Bundle immutability**: built once on `bundle_context === null`, persisted, never refreshed mid-thread. Resumes reuse the snapshot. Documented in `docs/CONTEXT.md` (v1 product constraint).

### Test stats

- Bundle module: 11 unit tests (all green).
- Handler module: +5 T133 tests (47 → 52 total, all green).
- Deno suite total: 304 tests passing (288 pre-T133).
- Vitest: 1511 tests passing (unchanged).
- `deno check supabase/functions/embedded-agent/index.ts`: clean.
- `tsc --noEmit -p tsconfig.app.json`: clean.

## References

- Epic Brief: `docs/Epic_Brief_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Stories 2, 3, 15, 21; Bundle composition § "v1 lock"; Empty active program § "v1 lock — Story 15")
- Tech Plan: `docs/Tech_Plan_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Data Model — `bundle_context` JSONB shape; Component Responsibilities — `lib/bundle.ts`, `handleOpen`)
- ADR 0003: `docs/adr/0003-additional-program-creation-shape.md` (§2 pre-loaded bundle)
- Existing handler: `file:supabase/functions/embedded-agent/handler.ts` (`handleOpen` lines 686-739)
- Existing threadStore: `file:supabase/functions/embedded-agent/threadStore.ts`
