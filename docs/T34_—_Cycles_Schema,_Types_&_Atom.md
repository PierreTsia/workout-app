# T34 — Cycles Schema, Types & Atom

## Goal

Set up the foundational data structures for the Training Cycle model: Supabase migration (new `cycles` table + `sessions.cycle_id` FK), TypeScript types, and Jotai atom extension. No behavioral changes — this is pure schema and type scaffolding.

## Dependencies

None.

## Scope

### Supabase migration

Create `supabase/migrations/20260320120000_create_cycles_and_session_cycle_id.sql`:

- `cycles` table: `id` (uuid PK), `program_id` (uuid NOT NULL), `user_id` (uuid FK → auth.users), `started_at` (timestamptz NOT NULL DEFAULT now()), `finished_at` (timestamptz nullable)
- Partial unique index `one_active_cycle_per_program` on `(program_id, user_id) WHERE finished_at IS NULL`
- RLS: `auth.uid() = user_id` for all operations
- `sessions.cycle_id`: nullable uuid FK → `cycles.id`

### TypeScript types

In `file:src/types/database.ts`:

- Add `Cycle` interface
- Add `cycle_id: string | null` to `Session` interface

### SessionState atom

In `file:src/store/atoms.ts`:

- Add `cycleId: string | null` to the `SessionState` type (default `null`)
- Update the `defaultSession` initial value to include `cycleId: null`

## Out of Scope

- Hooks that query cycle data (T35)
- Sync service changes (T35)
- WorkoutPage behavioral changes (T35)

## Acceptance Criteria

- [ ] Migration file exists and is valid SQL
- [ ] `Cycle` type is exported from `database.ts`
- [ ] `Session` type includes `cycle_id: string | null`
- [ ] `SessionState` in atoms includes `cycleId: string | null` with default `null`
- [ ] Existing tests pass (no regressions from type changes)
- [ ] `npm run build` succeeds (TypeScript compiles cleanly)

## References

- [Epic Brief](docs/Epic_Brief_—_Workout_Overview_Session_Cards.md) — PR A items 1-3
- [Tech Plan](docs/Tech_Plan_—_Workout_Overview_Session_Cards.md) — Data Model section
