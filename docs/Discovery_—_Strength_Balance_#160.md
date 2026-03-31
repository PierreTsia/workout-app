# Discovery — Strength Balance (#160)

## Refined Goal

Introduce a **Training Balance** view that quantifies how evenly a user's training volume is distributed across muscle groups over a rolling window, surfaces imbalances visually via body map + gauge, and provides actionable feedback. Inspired by [reference app screenshot](../assets/strength-balance-reference.png).

---

## Context & Prior Art

### What exists today

| Asset | Location | Relevance |
|---|---|---|
| **`exercises.muscle_group`** (13 French labels) + `secondary_muscles` (text[]) | `file:src/types/database.ts` | Primary data source — every `set_log` is joinable to its muscle group via `exercise_id` |
| **`set_logs`** with `weight_logged`, `reps_logged`, `estimated_1rm` | Supabase `set_logs` table | Volume = `weight_logged × reps_logged::int`, set count = `COUNT(*)` |
| **Body map** (`react-body-highlighter`) | `file:src/components/body-map/BodyMap.tsx` | Already renders anterior + posterior SVG with frequency-based gradient |
| **Muscle → SVG slug mapping** | `file:src/lib/muscleMapping.ts` — `TAXONOMY_TO_SLUGS` (13 values → 20 SVG regions) | Reusable as-is for the balance heatmap |
| **`buildBodyMapData`** aggregation | `file:src/lib/muscleMapping.ts` | Existing set-weighted aggregation (primary: full sets, secondary: `ceil(sets / 2)`) — can be reused or adapted |
| **History page** with 3 tabs (Activity, Sessions, By Exercise) | `file:src/pages/HistoryPage.tsx` | Natural home for a new "Balance" tab or card |
| **`StatsDashboard`** (sessions / sets / PRs) | `file:src/components/history/StatsDashboard.tsx` | Could host a balance score pill, or the feature lives in its own tab |
| **Recharts** | Already in dependencies | Gauge / radial bar chart |
| **`get_cycle_stats` RPC** | `supabase/migrations/20260320130000_create_get_cycle_stats.sql` | Precedent for aggregation RPCs with delta computation |

### What does NOT exist

- **No cross-muscle analytics** — all current metrics are global (total sets, PRs) or per-exercise (e1RM trend). No aggregation by muscle group.
- **No push/pull/upper/lower hierarchy** on `exercises` — PPL is a program split preference (`file:src/components/create-program/AIConstraintStep.tsx`), not exercise-level metadata.
- **No "balance score"** or distribution evenness metric.
- **No volume-by-muscle RPC** in Supabase.

### Muscle group taxonomy (source of truth)

```
Pectoraux, Dos, Épaules, Biceps, Triceps,
Quadriceps, Ischios, Fessiers, Adducteurs, Mollets,
Abdos, Trapèzes, Lombaires
```

Source: `file:scripts/audit-muscle-tags.ts` → `MUSCLE_TAXONOMY` (13 values).

---

## Original Idea vs Refined Approach

### What the original ticket proposed (e1RM ratios)

> Compare normalized e1RM of agonist/antagonist groups (e.g., Chest vs. Back)

**Problem:** Comparing e1RM across different muscle groups is not meaningful. A 100 kg bench press and a 100 kg barbell row represent different biomechanical efforts — there is no universally agreed "healthy ratio" for Chest e1RM vs Back e1RM. The constants proposed (`Pull:Push = 1:1`) are oversimplified and would produce misleading scores.

### What we should build instead (volume distribution)

**Volume distribution evenness** is what coaches actually assess. It answers: "Am I training all my muscle groups with roughly proportional attention?"

This is:
- **Objective** — no arbitrary "healthy ratio" constants needed
- **Directly actionable** — "you did 18 sets for chest and 4 for back this month"
- **Backed by training science** — volume (sets × load) is the primary driver of hypertrophy
- **What the reference app is likely computing** — the body map coloring + percentage gauge points to a distribution metric, not strength ratios

---

## Proposed Architecture

### Design principle: program-agnostic, session-driven

The feature reads **only** from `set_logs` joined to `exercises` (via `exercise_id`), filtered by `sessions.finished_at`. It has zero awareness of programs, workout days, templates, or split preferences. Quick sessions, AI-generated sessions, and structured program sessions all contribute equally.

### 1. Two-layer model: score + insights (new, client-side)

The feature uses two complementary layers:

- **Score (all 13 muscles):** measures how evenly training volume is distributed across the full taxonomy. Muscles with 0 sets actively drag the score down — because neglecting entire muscle groups IS an imbalance, regardless of program split.
- **Insights (agonist/antagonist pairs):** surfaces specific, actionable callouts when opposing muscle groups are skewed. This layer answers "what should I fix?" rather than "how balanced am I?"

#### Agonist/antagonist pairs (insight engine)

Four biomechanically grounded pairs exist in the taxonomy. These drive the actionable feedback, not the score itself:

```typescript
const AGONIST_PAIRS = [
  { name: "chest_back",     a: "Pectoraux",  b: "Dos"       },  // horizontal push/pull — posture, shoulder health
  { name: "biceps_triceps", a: "Biceps",     b: "Triceps"   },  // elbow flexion/extension
  { name: "quads_hams",     a: "Quadriceps", b: "Ischios"   },  // knee extension/flexion — ACL protection
  { name: "abs_lower_back", a: "Abdos",      b: "Lombaires" },  // trunk flexion/extension — spine health
] as const
```

Unpaired muscles (Épaules, Fessiers, Adducteurs, Mollets, Trapèzes) still participate in the score and appear on the body map — they just don't generate pair-specific insight text.

### 2. New Supabase RPC: `get_volume_by_muscle_group`

**Parameters:** `p_user_id uuid`, `p_days int` (default 30)

**Returns:** One row per muscle group with:

| Column | Type | Description |
|---|---|---|
| `muscle_group` | text | French label from `exercises.muscle_group` |
| `total_sets` | int | `COUNT(*)` of set_logs for that muscle |
| `total_volume_kg` | numeric | `SUM(weight_logged * reps_logged::int)` — only for integer reps |
| `exercise_count` | int | `COUNT(DISTINCT exercise_id)` |

**Join path:** `set_logs` → `sessions` (for `user_id` + `finished_at` date filter) → `exercises` (for `muscle_group`).

**Secondary muscle handling:** Each set contributes 100% to the primary `muscle_group` and a fractional share to each `secondary_muscles` entry. The existing `buildBodyMapData` uses `ceil(sets / 2)` (50%); for the balance score a **30–50% weight** is more biologically honest (secondaries assist but don't bear the primary load). Exact coefficient to finalize in tech plan — use the same value consistently for score, body map, and detail table. Requires `UNNEST(secondary_muscles)` in the RPC or a client-side post-processing pass.

**Period delta:** Call the RPC twice (current 30d, previous 30d) client-side to compute the "+X pct" delta shown in the reference screenshot.

### 3. Balance score computation (client-side)

The score measures **how evenly training volume is distributed across all 13 muscle groups**. It is program-agnostic: "you should train your whole body" is the only opinion it encodes — and that's literally what "balance" means.

**Algorithm:** Coefficient of variation inverted to a 0–100% scale.

```
sets_per_muscle = [total_sets for each of the 13 muscle groups]  // zeros included
mean = avg(sets_per_muscle)
cv = stddev(sets_per_muscle) / mean   // 0 = perfectly even, higher = worse
score = max(0, round((1 - cv) * 100)) // 100% = perfectly even, 0% = extremely skewed
```

**Example:** A user who trains 10 of 13 muscles with roughly similar set counts scores high (~80–90%). A user who does 30 sets for chest and 0 for everything else scores very low — three untrained muscles with 0 sets inflate the stddev and tank the score.

**Pair insight layer (on top of the score):**

```
For each agonist/antagonist pair:
  pair_ratio = min(sets_a, sets_b) / max(sets_a, sets_b)  // 1.0 = balanced, 0 = one side neglected
  if pair_ratio < 0.5 → generate specific callout
  if one side = 0     → generate "untrained" callout
```

The pair ratios are NOT inputs to the score — they drive the insight cards that tell the user *what specifically* to fix.

**Score thresholds:**

| Range | Label | Color |
|---|---|---|
| 85–100% | Excellent | Green |
| 70–84% | Good | Yellow-green |
| 50–69% | Needs attention | Orange |
| 0–49% | Imbalanced | Red |

**Edge cases:**
- User has < 3 finished sessions in the window → don't show score, show "Not enough data" placeholder
- All 13 muscles have 0 sets (no data at all) → same "Not enough data" placeholder
- mean = 0 (no sets) → guard against division by zero, return 0

### 4. UI Components

#### 4a. Balance Gauge

Half-circle gauge (0% → 100%) with color gradient. Shows:
- Score percentage (large, centered)
- Label ("Good", "Needs attention", etc.)
- Delta vs previous period ("+5 pct" pill — green if improving, red if declining)

**Implementation:** Recharts `RadialBarChart` or a custom SVG arc — evaluate in tech plan. The reference app uses a speedometer-style gauge.

#### 4b. Body Map (reuse existing)

Reuse `file:src/components/body-map/BodyMap.tsx` with volume-weighted `IExerciseData[]` from the RPC results. Muscles with more sets show brighter; neglected muscles stay dim/grey.

The existing `buildBodyMapData` in `file:src/lib/muscleMapping.ts` already handles set-weighted frequency — it may need a thin adapter to accept the RPC output shape instead of `MuscleExerciseInput[]`.

#### 4c. Insight Card

Two tiers of feedback:

**Tier 1 — Score summary** (always shown when score is available):
- Score label + description ("Your training balance is good. You're well balanced across your major muscle groups but there's still room for improvement.")

**Tier 2 — Pair-specific callouts** (shown when a pair ratio < 0.5):
- "Your chest volume is 3× your back volume — consider adding more rowing and pulling exercises."
- "You haven't trained **back** in the last 30 days while doing 24 chest sets."

**Tier 3 — Zero-volume callouts** (shown for any muscle with 0 sets):
- "No **hamstring** work in the last 30 days."

#### 4d. Detail breakdown (expandable)

Collapsible section showing per-muscle-group stats:

| Muscle | Sets | Volume (kg) | % of total |
|---|---|---|---|
| Pectoraux | 24 | 4,320 | 18% |
| Dos | 12 | 2,160 | 9% |
| … | … | … | … |

Sorted by % descending. Optionally: horizontal bar for each row.

### 5. Placement in the app

**Option A — New tab in History page:** Add a 4th tab "Balance" alongside Activity / Sessions / By Exercise. Clean separation, discoverable.

**Option B — Card above tabs:** Replace or augment `StatsDashboard` with a balance score pill. Less screen real estate needed but competes with existing stats.

**Option C — Dedicated page:** New route `/balance` accessible from History or main nav. Gives room for the full gauge + body map + detail table. The reference app uses a dedicated screen.

**Recommendation:** Option A (new tab) for MVP — minimal disruption, clean scope. Promote to Option C later if the feature gets traction.

---

## Reusable Infrastructure

| Existing asset | How it helps |
|---|---|
| `BodyMap` component | Drop-in for the muscle heatmap — already themed, responsive, dual-view |
| `TAXONOMY_TO_SLUGS` mapping | Maps all 13 muscle groups to SVG regions — no new mapping needed |
| `buildBodyMapData` | Aggregation logic for set-weighted muscle frequency — adapt input shape |
| `react-body-highlighter` | Anterior + posterior SVG with gradient fills — already installed |
| Recharts | Chart library for the gauge component — already installed |
| `Tabs`, `Card`, `Collapsible` (shadcn/ui) | UI primitives for the layout |
| `useStatsAggregates` pattern | Precedent for React Query hook wrapping a Supabase RPC |
| `get_cycle_stats` RPC | Precedent for aggregation RPCs with period comparison |

---

## Technical Tasks (estimated)

| # | Task | Effort | Notes |
|---|---|---|---|
| 1 | Define `AGONIST_PAIRS` constant + `computeBalanceScore` (CV-based) + `computePairInsights` pure functions | S | Client-side, unit-testable |
| 2 | Supabase RPC `get_volume_by_muscle_group` | S | SQL aggregate + migration |
| 3 | React Query hook `useVolumeDistribution(days)` | S | Calls RPC, shapes data |
| 4 | `BalanceGauge` component (half-circle gauge) | M | Recharts radial bar or custom SVG |
| 5 | `BalanceInsight` component (text card) | S | Template strings from score + per-pair data |
| 6 | `MuscleBreakdownTable` component (detail table) | S | Collapsible, per-muscle stats |
| 7 | Adapt `BodyMap` for volume-weighted input from RPC | S | Thin adapter, no breaking changes |
| 8 | `BalanceTab` — compose gauge + body map + insight + table | M | New tab in History page |
| 9 | i18n keys (FR + EN) | S | Score labels, pair names, insight templates, tab label |
| 10 | Unit tests — score computation, pair ratios, edge cases | S | Pure function coverage |

**Total estimate:** ~M overall (no schema changes beyond one RPC, heavy reuse of existing components).

---

## Acceptance Criteria

- [ ] User sees a "Balance" tab (or equivalent surface) in the History page
- [ ] A gauge displays a 0–100% balance score based on volume distribution across all 13 muscle groups over the last 30 days
- [ ] Body map highlights muscles with intensity proportional to training volume
- [ ] Pair-specific insight text is displayed when an agonist/antagonist pair ratio < 0.5
- [ ] Zero-volume muscles are called out explicitly in insight text
- [ ] Detail breakdown shows per-muscle-group sets, volume, and % of total
- [ ] Delta vs previous 30-day period is shown ("+X pct" or "-X pct")
- [ ] Edge case: fewer than 3 finished sessions → "Not enough data" placeholder
- [ ] Edge case: mean = 0 (no sets at all) → guarded, no division by zero
- [ ] Score computation is covered by unit tests (all threshold boundaries, zero-volume muscles, perfect balance, extreme skew)
- [ ] Pair insight computation is covered by unit tests (ratio < 0.5 triggers, one-side-zero triggers, both-zero skips)
- [ ] Works in both FR and EN
- [ ] Body map respects light/dark theme (existing `BodyMap` theming carries over)
- [ ] No regression on existing History page tabs

---

## Open Questions (for Tech Plan)

1. **Secondary muscle weight:** Exact coefficient (30% vs 50%) — 50% matches existing `buildBodyMapData` convention, 30% may be more biologically honest. Pick one and apply consistently across score, body map, and detail table.
2. **Gauge implementation:** Recharts `RadialBarChart` vs custom SVG arc — need to prototype both for visual fidelity to the reference.
3. **Rolling window:** Fixed 30 days, or user-selectable (7d / 30d / 90d)? Start with 30d, add selector later?
4. **Should the score weight volume (tonnage) or set count?** Set count is simpler and avoids bias toward heavy compound lifts. Volume (tonnage) better reflects actual training stimulus. Could offer both views eventually — start with set count for MVP?
5. **Duration exercises:** Currently excluded from volume computation (`reps_logged` is not numeric). Ignore for MVP, or count each logged set as 1 set regardless of duration?
6. **Per-pair detail in UI:** Show all 4 pairs with individual ratios (mini progress bars)? Or just highlight the worst offender?
7. **CV sensitivity:** With 13 groups and typical training patterns (most people train 8–10 groups), the CV will naturally be pulled down by the 3–5 untrained groups. Should we tune the threshold labels to account for this (i.e., 70% might already be "good" in practice)? Validate with real data before shipping.

---

## Out of Scope (future evolution)

### e1RM normalization via strength standards (v2)

A more sophisticated balance metric would normalize each exercise's e1RM against bodyweight and population-level strength standards (e.g. Symmetric Strength, Strength Level tables), mapping raw e1RM to a 0–100 "strength level" per muscle. This solves the "100 kg bench vs 60 kg row" comparison problem — both might map to "Intermediate" (score 50) and thus be balanced.

**Why deferred:**
- Requires a **strength standards table per exercise** (not per muscle group) — hundreds of entries to source, validate, and maintain
- Standards vary by **bodyweight, sex, training age** — `user_profiles` doesn't currently store all of these
- **Custom exercises** (user-created) have no standards data
- **Duration exercises** have no e1RM
- Significant data dependency and maintenance burden

**When to revisit:** If the volume-based MVP gains traction and users ask "but I row less weight than I bench — is that bad?", this becomes the natural v2. The RPC and UI infrastructure built for v1 (body map, gauge, insight cards, per-muscle table) would be reused — only the score computation layer changes.
