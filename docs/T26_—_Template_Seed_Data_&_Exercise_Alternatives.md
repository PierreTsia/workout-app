# T26 — Template Seed Data & Exercise Alternatives

## Goal

Populate the database with 5 curated program templates (with full exercise assignments) and an exercise alternatives swap table for home/minimal equipment users. This is a content-heavy, pure SQL ticket — no application code. The data produced here is consumed by the recommendation engine and program generation logic in T27.

## Dependencies

- T23 — Database Schema & Migrations (template tables and exercise_alternatives table must exist)

## Scope

### Program Templates

Seed 5 `program_templates` rows via SQL migration:

| Template | min_days | max_days | primary_goal | experience_tags | Description |
|---|---|---|---|---|---|
| Full Body | 2 | 4 | general_fitness | {beginner} | Compound-heavy, low volume per muscle |
| Upper/Lower | 3 | 4 | hypertrophy | {intermediate} | Balanced push/pull split |
| PPL (Push/Pull/Legs) | 3 | 6 | hypertrophy | {intermediate,advanced} | Classic bodybuilding split |
| GZCLP | 3 | 4 | strength | {beginner,intermediate} | Linear progression, tier system |
| Muscular Endurance | 3 | 4 | endurance | {beginner,intermediate,advanced} | High reps (15-20+), short rest (30-60s), circuit-style |

### Template Days

Seed `template_days` — 3-6 day structures per template, ~20-25 total rows:

- Full Body: 3 days (Full Body A, Full Body B, Full Body C)
- Upper/Lower: 4 days (Upper A, Lower A, Upper B, Lower B)
- PPL: 6 days (Push, Pull, Legs, Push B, Pull B, Legs B)
- GZCLP: 3 days (Day A, Day B, Day C)
- Muscular Endurance: 4 days (Upper Circuit, Lower Circuit, Full Body Circuit, Conditioning)

### Template Exercises

Seed `template_exercises` — 4-8 exercises per day, ~80-100+ total rows.

**Exercise reference strategy:** Use name-based CTE lookups (not hardcoded UUIDs) so the migration works across environments where exercise UUIDs differ:

```sql
WITH ex AS (
  SELECT id, name FROM exercises
)
INSERT INTO template_exercises (template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order)
VALUES
  ((SELECT id FROM template_days WHERE day_label = 'Push'), (SELECT id FROM ex WHERE name = 'Bench Press'), 4, '6-8', 90, 1),
  ...
```

Each exercise assignment must specify: `sets`, `rep_range` (text, e.g. "6-8", "12-15"), `rest_seconds`, `sort_order`.

**Content process:** AI-drafted exercise assignments from the 600+ exercise library, then manually validated for:
- Muscle coverage per day
- Volume balance across the week
- Appropriate difficulty for the template's experience level
- Rep ranges matching the template's primary goal

### Exercise Alternatives

Seed `exercise_alternatives` — ~30-50 swap rows for home/minimal equipment contexts.

Only exercises actually used in the 5 templates need swaps. Each row maps a gym-default exercise to its home or minimal-equipment substitute:

| Example gym exercise | Alternative | Context |
|---|---|---|
| Barbell Bench Press | Push-ups (Weighted) | home |
| Barbell Squat | Bulgarian Split Squat | home |
| Cable Fly | Dumbbell Fly | minimal |
| Lat Pulldown | Pull-ups | home |

One alternative per exercise per equipment context (1:1 mapping, enforced by UNIQUE constraint).

## Out of Scope

- Application code, hooks, or TypeScript (T27)
- Recommendation engine logic (T27)
- Program generation logic (T27)
- Adding templates beyond the initial 5 (future seed migrations)

## Acceptance Criteria

- [ ] 5 program templates exist with correct `primary_goal`, `experience_tags`, `min_days`, `max_days`
- [ ] Each template has 3-6 day structures in `template_days` with descriptive labels and muscle focus
- [ ] Each template day has 4-8 exercises in `template_exercises` with appropriate sets, rep_range, and rest_seconds
- [ ] All exercise name lookups resolve — migration does not fail (no dangling references)
- [ ] Exercise alternatives cover all equipment-restricted exercises used in templates (~30-50 rows)
- [ ] Each swap makes sense (reasonable substitute for the gym exercise in the given context)
- [ ] `supabase db reset` runs clean with all seed data populated
- [ ] Total exercise assignments are manually validated for muscle coverage and volume balance

## References

- Epic Brief: `file:docs/Epic_Brief_—_Onboarding_&_Program_Generation.md` — Scope items 5, 6
- Tech Plan: `file:docs/Tech_Plan_—_Onboarding_&_Program_Generation.md` — Key Decisions (template seed references), Phase 2 steps 1-2
