# Tech Plan — Duration-Based Exercises & Set Timer

## Architectural Approach

Ship **measurement mode** end-to-end: **DB constraints** enforce reps vs duration at rest, **Jotai session state** carries parallel shapes per set row, **`syncService`** extends `SetLogPayload` and insert path, and **UI** branches in the builder (`ExerciseDetailEditor`) and live session (`SetsTable` + new timer surface). **Aggregates** (`get_cycle_stats`, history RPCs) already guard volume with `reps_logged ~ '^\d+$'` in places — extend explicitly so duration rows never enter volume math. **Classification** is a **local-only** pipeline: CSV in → LLM → audit CSV → hand-reviewed SQL migration — no production writes from the script.

### Key Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Set log shape | Add nullable `duration_seconds` (integer ≥ 1); make `reps_logged` **nullable**; add `CHECK` mutual exclusivity | Matches Epic Brief; avoids corrupting `reps_logged` text; keeps SQL aggregates honest |
| `SetLogPayload` | Discriminated: either reps path (`repsLogged`, `estimatedOneRM`, …) or duration path (`durationSeconds`, `repsLogged` omitted / null) | Single queue item type; `processSetLog` maps to DB columns |
| Session `setsData` row | Extend union: reps sets keep `{ reps, weight, done, rir? }`; duration sets add `mode: 'duration'`, `targetSeconds`, `elapsedSeconds?`, timer phase enum | `file:src/store/atoms.ts` today is a flat shape — needs a discriminant or parallel optional fields with `measurementType` on parent exercise |
| Resolve target seconds | `coalesce(workout_exercises.target_duration_seconds, exercises.default_duration_seconds, 30)` client-side when hydrating session | Epic Brief: template override → catalog default → product constant |
| PR / e1RM for duration | V1: `was_pr = false`, `estimated_1rm = null` for duration inserts; no time-based PR in this epic | Avoids bogus Epley; follow-up epic can define “longest hold” PRs |
| Volume SQL | Keep volume = `weight * reps` only where `reps_logged` is numeric string; add `AND duration_seconds IS NULL` (or equivalent) where functions cast `reps_logged` | `file:supabase/migrations/20260320130000_create_get_cycle_stats.sql` already filters digit-only reps |
| AI pipeline | `scripts/classify-measurement-type.ts`: read **local CSV**, write `scripts/data/measurement-audit.csv`, optional `--emit-sql` to print `UPDATE` statements; **no** Supabase write in default path | Epic: never LLM → prod |
| Export source | **Staging** or local DB: `COPY (SELECT … FROM exercises) TO STDOUT CSV HEADER` / Supabase Table CSV export; same columns as prod schema version | Reproducible; prod export only after migration applied in lower env |
| Haptics / sound | Web: `navigator.vibrate()` (strong pattern: `[200, 100, 200]`); `new Audio()` or short beep from `/public` | No native app; PWA-friendly; degrade gracefully if denied |

### Critical Constraints

- **Offline queue:** `SetLogPayload` lives in `localStorage` (`file:src/lib/syncService.ts`). Adding fields is backward-compatible if old queued items are drained first; bumping queue schema is **not** required if new fields are optional — but duration rows **must** send `durationSeconds` and omit/null reps for inserts. Document migration order: ship DB migration before client that only emits duration payloads.
- **`reps_logged` NOT NULL today:** Migration must `ALTER COLUMN reps_logged DROP NOT NULL` and backfill is unnecessary (no rows with duration yet). Existing rows stay non-null reps.
- **`summarizeSessionLogs`** (`file:src/lib/sessionSummary.ts`) assumes `reps_logged` for labels — must branch on `duration_seconds` for preview strings (e.g. `45s` / `1:00`).
- **`SessionRow`** (`file:src/components/history/SessionRow.tsx`) grid shows Reps / Weight / 1RM — duration sets need a column or merged cell (e.g. “Durée” + seconds, hide 1RM or show `–`).
- **Exercise fetch:** Session and builder must load `measurement_type`, `default_duration_seconds` with exercises; extend Supabase `select()` wherever `WorkoutExercise` / `Exercise` are loaded (e.g. `WorkoutPage`, program queries).
- **Plank vs Planche:** Data fix is **content** (seed / SQL migration renames or `name_en` / locale keys), not app logic — track as a separate small migration or manual SQL after catalog review.

---

## Data Model

```mermaid
classDiagram
  class exercises {
    uuid id
    text measurement_type
    int default_duration_seconds NULL
  }
  class workout_exercises {
    uuid id
    int target_duration_seconds NULL
  }
  class set_logs {
    uuid id
    text reps_logged NULL
    int duration_seconds NULL
    numeric weight_logged
    numeric estimated_1rm NULL
  }
  exercises "1" --> "*" workout_exercises : exercise_id
  exercises "1" --> "*" set_logs : exercise_id
```

### SQL (illustrative)

```sql
-- exercises
ALTER TABLE exercises
  ADD COLUMN measurement_type text NOT NULL DEFAULT 'reps'
    CHECK (measurement_type IN ('reps', 'duration'));
ALTER TABLE exercises
  ADD COLUMN default_duration_seconds integer
    CHECK (default_duration_seconds IS NULL OR default_duration_seconds > 0);

-- workout_exercises
ALTER TABLE workout_exercises
  ADD COLUMN target_duration_seconds integer
    CHECK (target_duration_seconds IS NULL OR target_duration_seconds > 0);

-- set_logs
ALTER TABLE set_logs ALTER COLUMN reps_logged DROP NOT NULL;
ALTER TABLE set_logs
  ADD COLUMN duration_seconds integer
    CHECK (duration_seconds IS NULL OR duration_seconds > 0);

ALTER TABLE set_logs ADD CONSTRAINT set_logs_reps_or_duration_chk CHECK (
  (duration_seconds IS NULL AND reps_logged IS NOT NULL)
  OR (duration_seconds IS NOT NULL AND reps_logged IS NULL)
);
```

### TypeScript (`file:src/types/database.ts`)

- `Exercise`: `measurement_type: 'reps' | 'duration'`; `default_duration_seconds: number | null`.
- `WorkoutExercise`: `target_duration_seconds: number | null`.
- `SetLog`: `reps_logged: string | null`; `duration_seconds: number | null`.

### Table Notes

- **`measurement_type`:** Drives UI; denormalized on exercise so runtime does not guess from nullable columns.
- **`default_duration_seconds`:** Meaningful when `measurement_type === 'duration'`; can be NULL in DB and resolved to **30** in app for display until user edits.
- **`target_duration_seconds`:** Nullable; `NULL` → use exercise default chain in session.
- **`set_logs`:** For duration sets, `weight_logged` may still represent added load (weighted plank); RIR optional / often null. `estimated_1rm` null.

---

## Component Architecture

### Layer Overview

```mermaid
graph TD
  subgraph Data
    M[Supabase migrations]
    T[database.ts types]
  end
  subgraph Session
    A[atoms.ts setsData]
    ST[SetsTable]
    DT[DurationSetTimer or inline]
    SY[syncService SetLogPayload]
  end
  subgraph Builder
    ED[ExerciseDetailEditor]
    DR[DayEditor / ExerciseRow]
  end
  subgraph History
    SR[SessionRow / SessionSetLogs]
    SM[sessionSummary.ts]
  end
  M --> T
  T --> ST
  T --> ED
  A --> ST
  ST --> DT
  ST --> SY
  SM --> SR
```

### New Files & Responsibilities

| File | Purpose |
| --- | --- |
| `src/components/workout/DurationSetTimer.tsx` (or similar) | Countdown UI, strong vibrate + sound at 0, large “Terminer / Loguer”, early-stop → actual seconds; respects `onBlockedByPause` from parent |
| `scripts/classify-measurement-type.ts` | Read CSV, call Groq, write audit CSV; optional `--emit-sql` |
| `scripts/data/exercises-export.sample.csv` | Document expected CSV columns (optional) |
| `supabase/migrations/YYYYMMDDHHMMSS_duration_measurement.sql` | Columns + constraints + `get_cycle_stats` / any RPC updates |

### Component Responsibilities

**`SetsTable`**

- Read `measurement_type` from exercise context (prop or joined exercise map).
- If `reps`: current behavior (reps / weight / checkbox / RIR).
- If `duration`: render `DurationSetTimer` per row instead of reps input; checkbox flow replaced by “log” button inside timer component.
- `enqueueSetLog`: pass `durationSeconds` + null reps for DB, or extend payload type.

**`ExerciseDetailEditor`**

- When exercise is `duration`: show target seconds (bind `target_duration_seconds` on `WorkoutExercise`); hide reps field or show read-only “N/A”.
- Copy: explain fallback chain when target is empty.

**`sessionSummary.ts` / `SessionSummary`**

- Preview lines: for duration logs, show time range or single duration, not `reps` numeric range.

**`SessionRow`**

- Table header: conditional “Reps” vs “Durée” (or combined “Reps / Durée”).
- Row: render `duration_seconds` with `formatDurationSeconds` helper (reuse patterns from `file:src/lib/formatters.ts`).

### Failure Mode Analysis

| Failure | Behavior |
| --- | --- |
| User pauses workout mid-countdown | Pause timer (or block start) same as `SetsTable` pause gate; no log until explicit complete |
| Offline queue has old payload shape | Drain legacy payloads (reps only); new app version generates new shape |
| LLM misclassifies bench as duration | Caught in CSV audit + manual review before SQL apply |
| `navigator.vibrate` unsupported | Skip vibration; rely on sound + visible “time’s up” UI |
| Migration applied before client deploy | Old clients only insert reps rows — OK; new column default allows old inserts if any |

---

## SQL / RPC follow-ups

- **`get_cycle_stats`** (`file:supabase/migrations/20260320130000_create_get_cycle_stats.sql`): Change volume line to exclude duration rows, e.g. `AND sl.duration_seconds IS NULL AND sl.reps_logged ~ '^\d+$'` (redundant but explicit).
- **`get_exercise_history_for_sheet`** and any function selecting `set_logs`: ensure selects include `duration_seconds`; client or SQL formatting for display.
- **Regenerate** Supabase types if using codegen (`database.types.ts` if present).

---

## Classification pipeline (operational)

1. Export `exercises` (id, name, name_en, muscle_group, equipment, instructions, …) to `scripts/data/exercises-export.csv` from **staging** (or anonymized prod snapshot).
2. Run `npx tsx scripts/classify-measurement-type.ts --input scripts/data/exercises-export.csv`.
3. Review `scripts/data/measurement-audit.csv` (columns: id, name, `measurement_type`, reasoning).
4. Run with `--emit-sql` → paste into a new migration file: `UPDATE exercises SET measurement_type = 'duration', default_duration_seconds = 30 WHERE id IN (...)`.
5. Apply migration to staging → smoke-test app → apply to prod.

**Plank / Planche:** separate content ticket: `UPDATE` names / `name_en` / locale keys so search and labels stay distinct.

---

## Testing

- **Unit:** `sessionSummary` with mixed logs; `syncService` insert payload for duration; atoms reducers for duration set rows.
- **Component:** `SetsTable` / timer: pause blocks log; complete logs `durationSeconds`; early stop logs elapsed < target.
- **SQL:** migration applies cleanly; `CHECK` rejects both NULL reps and NULL duration.

---

## References

- Epic Brief: `file:docs/Epic_Brief_—_Duration-Based_Exercises_&_Set_Timer.md`
- Issue: https://github.com/PierreTsia/workout-app/issues/134
- Prior art: `file:docs/Tech_Plan_—_Session_Duration_Excludes_Pause.md` (session-level time; orthogonal)
- Code: `file:src/lib/syncService.ts`, `file:src/store/atoms.ts`, `file:src/components/workout/SetsTable.tsx`, `file:src/lib/sessionSummary.ts`, `file:src/components/history/SessionRow.tsx`
