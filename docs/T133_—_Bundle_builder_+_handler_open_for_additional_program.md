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

- [ ] `supabase/functions/embedded-agent/lib/bundle.ts` exports `buildAdditionalProgramBundle`, `buildBundleSummary`, `BundleSizeExceeded`, `ProfileMissing`, types.
- [ ] `buildAdditionalProgramBundle` unit tests pass for the 5 scenarios listed above.
- [ ] Size guard verified with a fixture: 8 KB+ bundle throws `BundleSizeExceeded`.
- [ ] Handler integration test: POST `embedded-agent { action: 'open', purpose: 'additional_program', locale: 'en' }` returns a thread with `bundle_summary` in the response payload AND `bundle_context` populated in the DB row.
- [ ] Resumed additional-program thread (second `/open` call) does NOT call `buildBundle` again (verified by spy or mock counter).
- [ ] Onboarding `/open` flow does NOT call `buildBundle` (regression verification).
- [ ] `/open` for additional-program with no `user_profiles` row returns 409 `profile_missing` (defensive — realistically unreachable).
- [ ] `e2e/onboarding.spec.ts` passes unchanged.

## References

- Epic Brief: `docs/Epic_Brief_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Stories 2, 3, 15, 21; Bundle composition § "v1 lock"; Empty active program § "v1 lock — Story 15")
- Tech Plan: `docs/Tech_Plan_—_Migrate_Create_Program_AI_to_Embedded_Agent_#343.md` (Data Model — `bundle_context` JSONB shape; Component Responsibilities — `lib/bundle.ts`, `handleOpen`)
- ADR 0003: `docs/adr/0003-additional-program-creation-shape.md` (§2 pre-loaded bundle)
- Existing handler: `file:supabase/functions/embedded-agent/handler.ts` (`handleOpen` lines 686-739)
- Existing threadStore: `file:supabase/functions/embedded-agent/threadStore.ts`
