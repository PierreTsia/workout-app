# Epic Brief — History Revamp (Drawer, Calendar, Analytics)

## Summary

This epic upgrades **global History** so it matches the rest of the app’s polish and answers two jobs: **rhythm at a glance** (when and how consistently the user trains) and **finding past work** (sessions and per-exercise history). It adds a **drawer icon** for History, introduces an **Activity** tab as the default surface: **month calendar**, **monthly summary** metrics (only where data is trustworthy), **day-scoped session detail**, and a **multi-week activity heatmap** fed by **real** session data—not demos. **Muscle-group and strength distribution charts** follow a **written metrics contract** and **implementation plan** in this release; the **charts themselves** ship only if discovery stays bounded and metrics are honest—otherwise the **documents** satisfy the “after discovery” acceptance path. It tracks [GitHub #107](https://github.com/PierreTsia/workout-app/issues/107).

---

## Context & Problem

**Who is affected:** Authenticated users who rely on [`file:src/pages/HistoryPage.tsx`](file:src/pages/HistoryPage.tsx) for recap, motivation, and locating past sessions.

**Current state:**

- [`file:src/components/SideDrawer.tsx`](file:src/components/SideDrawer.tsx): the **History** nav row is text-only while neighbors use `lucide-react` icons and consistent `gap`, which makes History feel secondary.
- [`file:src/pages/HistoryPage.tsx`](file:src/pages/HistoryPage.tsx): **Above the tabs**, [`file:src/components/history/StatsDashboard.tsx`](file:src/components/history/StatsDashboard.tsx) shows aggregate stats via [`file:src/hooks/useStatsAggregates.ts`](file:src/hooks/useStatsAggregates.ts). **Tabs** are **Sessions** / **By exercise** ([`file:src/components/history/SessionList.tsx`](file:src/components/history/SessionList.tsx) via [`file:src/hooks/useSessionHistory.ts`](file:src/hooks/useSessionHistory.ts), and [`file:src/components/history/ExerciseTab.tsx`](file:src/components/history/ExerciseTab.tsx)). This is strong for **power users** and **per-exercise analysis**, weak for **calendar-style orientation** and **long-horizon density** (heatmap mindset).
- No first-class **month grid** with **day selection → that day’s sessions**, and no **GitHub-style / health-style heatmap** over many weeks on this page.
- [`file:docs/done/Epic_Brief_—_Exercise_History_Quick-View.md`](file:docs/done/Epic_Brief_—_Exercise_History_Quick-View.md) / in-workout history: **complementary**; this epic is the **global** History surface, not the exercise sheet.

**Pain points:**

| Pain | Impact |
|---|---|
| History nav looks “unfinished” | Weak wayfinding; inconsistent with Library, Quick workout, Admin |
| List-first History | Hard to see **training rhythm** and monthly patterns at a glance |
| No heatmap / long window | Missed motivational and “streak-like” affordances without inventing gamification |
| Metrics unclear to users | Risk of showing averages or volumes that imply precision the schema/logging does not support |
| Activity vs global stats unclear | New monthly summary could **duplicate or contradict** [`file:src/components/history/StatsDashboard.tsx`](file:src/components/history/StatsDashboard.tsx) unless layout and definitions are intentional |

**Product decisions (refinement, Mar 2026):**

- **Primary entry:** **Rhythm at a glance**—the default experience foregrounds **Activity** (calendar + heatmap + month-scoped summaries), not the raw chronological list.
- **Both calendar and heatmap in v1:** **Distinct roles**—calendar = **month navigation + day drill-down**; heatmap = **multi-week density** (longer horizon than a single month row).
- **IA (canonical):** Tab order **Activity → Sessions → By exercise** (left-to-right in LTR). **Activity** is the **default** selected tab on load. **Sessions** keeps today’s list behavior; **By exercise** stays capability-equivalent to today unless Tech Plan proposes a merge that preserves the same outcomes.
- **Timezone:** Not designed in this brief; **Tech Plan** picks **one** bucketing rule (e.g. local calendar date at display time) and applies it **identically** to calendar dots, heatmap cells, and monthly summary boundaries.
- **Locale / calendar chrome:** **First day of week** and **weekday labels** follow **active locale** (e.g. FR vs EN conventions)—not hard-coded US-only. Copy lives in i18n.

---

## Definitions

**Finished session (for Activity UI):** A session counts toward “had training on this day,” calendar dots, and heatmap intensity **only** when it meets the **same** predicate used elsewhere for “completed” history (today: **`sessions.finished_at` IS NOT NULL**—confirm in Tech Plan if any edge cases, e.g. zero sets, require tightening). **In-progress or abandoned** sessions **do not** create a dot or heatmap signal until finished—avoids “I trained but nothing shows” / “ghost activity” contradictions.

**Metrics contract:** A short, versioned artifact (section in Tech Plan and/or `docs/`) listing: **metric name**, **formula or aggregation**, **source fields**, **empty / legacy handling**, and **known limitations**. **No** number ships on Activity without a row in the contract (or explicit omission rule).

---

## Goals

| Goal | Measure |
|---|---|
| Nav consistency | History drawer row uses an icon + layout consistent with other primary links |
| Rhythm entry | Opening History shows the **Activity** tab first: month calendar + **finished-session** day affordance + **day detail region** (see **Day selection** below) |
| Day selection | **Tech Plan** picks the default selected day from documented options; **any** focused day shows **that day’s sessions** (title, duration, sets, volume **where available**). A day with **no finished sessions** shows an **explicit empty state** (not a blank hole) |
| Month operations | **Prev/next month** controls; **keyboard** operable month navigation where controls exist; **focus visible** on interactive day cells and month controls |
| Monthly summary | Summary strip shows **only** contract-backed metrics; missing data → **“—”**, omitted tiles, or muted explanation—**no invented math** |
| Heatmap v1 | **Real** daily values from the same **finished-session** rules as the calendar; **documented** window (e.g. last 12–16 weeks—Tech Plan locks); legend + tooltip state the **unit** (minutes, session count, or **labeled** proxy) |
| Find sessions | **One clear navigation step** to **Sessions** tab: full chronological list without using the calendar |
| By exercise | Same **capability** as today’s **By exercise** tab (possibly relocated or renamed in copy only) |
| Analytics discovery | **Metrics contract** merged **before** or **with** the first PR that exposes new numeric summary tiles; plus a **written plan** for muscle/distribution charts (dimensions, ranges, mobile layout) |
| Accessibility | **Issue #107** bar: keyboard month navigation, visible focus, screen reader distinction **rest day vs day with workout**; stretch **WCAG 2.2 AA** for new Activity controls where primitives allow (document exceptions in Tech Plan if any) |
| i18n | **EN + FR** for calendar chrome, summaries, heatmap legend/tooltips, empty states; **locale-aware** week layout |

---

## Scope

**In scope:**

1. **Drawer** — History icon + spacing/pattern aligned with other primary links in [`file:src/components/SideDrawer.tsx`](file:src/components/SideDrawer.tsx).

2. **Information architecture** — [`file:src/pages/HistoryPage.tsx`](file:src/pages/HistoryPage.tsx): **Tabs** become **Activity → Sessions → By exercise**; **default** = **Activity**.

3. **Activity tab content:**
   - **Layout relationship to existing stats:** [`file:src/components/history/StatsDashboard.tsx`](file:src/components/history/StatsDashboard.tsx) either **stays above all tabs** (minimal change), **moves inside Activity only**, or **shrinks / defers** to the new monthly summary—**Tech Plan** picks one option and documents **non-contradiction** with monthly tiles (no two different “session counts” without labels).
   - Month **header** with previous/next navigation.
   - **Weekday-labeled** 7-column **grid**; **week start** follows **locale** (see Context).
   - **Per-day indicator** when the day has ≥1 **finished** session (e.g. dot); styling uses design tokens / reference **mood**, not pixel-perfect clone.
   - **Selected day** (keyboard + pointer); **day detail region**: session cards for that day, reusing patterns from [`file:src/components/history/SessionList.tsx`](file:src/components/history/SessionList.tsx) or shared cards where possible.
   - **Day selection (default behavior)** — **Tech Plan** implements **one** of: (A) default to **today**; (B) default to **last day in visible month with a finished session**; (C) **no** day selected until user taps (with clear prompt). **Recommendation in brief:** **(B)** if any finished session exists in the month, else **(A)** with empty state—maximizes “rhythm at a glance” without hiding the detail panel.
   - **Monthly summary** strip: contract-backed metrics only (e.g. workouts in month, per-week average **if defined**, duration **if defined**, volume **if defined**).
   - **Heatmap:** below or collapsible subsection; **same** finished-session + **same** calendar bucketing as month grid; **different** time window (multi-week).

4. **Data** — Prefer **client-side aggregation** from [`file:src/hooks/useSessionHistory.ts`](file:src/hooks/useSessionHistory.ts) and related hooks; extend queries or add **small** RPC/view **only** if data is incomplete, incorrect for finished-only rules, or **performance** degrades (large histories)—per [#107](https://github.com/PierreTsia/workout-app/issues/107).

5. **Sessions tab** — Current [`file:src/components/history/SessionList.tsx`](file:src/components/history/SessionList.tsx) behavior preserved (loading/empty/error patterns unchanged unless improved globally).

6. **By exercise tab** — Current [`file:src/components/history/ExerciseTab.tsx`](file:src/components/history/ExerciseTab.tsx) capability preserved.

7. **Discovery artifact** — **Metrics contract** (derivable fields vs schema/API gaps) + **muscle/distribution chart plan** (see [`file:docs/PRD.md`](docs/PRD.md) for `muscle_group`, `secondary_muscles`, etc.). **Charts** in v1 **only** if bounded; else **documentation** closes acceptance for “plan after discovery.”

8. **Testing** — **Component tests:** calendar **day selection** + **empty day** + at least one **month navigation** path if testable without flakiness. **E2E** optional if stable `data-testid` / roles exist. **Manual:** VoiceOver or equivalent spot-check for **rest vs workout** day announcements.

9. **Visual** — App tokens; optional Figma pass; competitor screenshot = **mood/layout** only.

**Out of scope:**

- **Anatomical muscle SVG** “body map” and full competitor **parity** in v1 unless discovery + effort stay bounded.
- **Backend rewrite**; only **minimal** Supabase additions if needed.
- **In-workout** quick-view replacement or duplication (separate epic).
- **Editing / deleting** sessions or logs **from** the new calendar (browse-only; corrections stay existing flows unless a future epic says otherwise).
- **URL deep-link** to a specific date on v1 (optional follow-up).
- **Offline-first** new guarantees beyond current History behavior—show **honest** loading/empty/error consistent with existing patterns.

---

## Success Criteria

- **Integrity (review-based):** On code review + QA, **no** new numeric tile on Activity lacks a **metrics contract** row or an explicit **omission** pattern; **no** placeholder averages (e.g. hard-coded duration proxies) without **labeled** disclosure in UI.
- **Qualitative:** User on **Activity** sees **which days** in the visible month had **finished** training and can **change day** to see **that day’s** sessions or a clear **empty** state.
- **Qualitative:** **Heatmap** cells match **calendar** rules for “what counts as activity that day”; legend/tooltip explain the **magnitude** (real minutes, count, or **named** proxy).
- **Qualitative:** **Sessions** and **By exercise** remain **findable** in **one** tab switch from Activity; tab order is **Activity → Sessions → By exercise**.
- **Qualitative:** Drawer **History** matches **icon + label** pattern of peer nav items.
- **Qualitative:** **Keyboard:** user can move **between months** and **between days** without pointer; **focus** is visible on interactive elements.
- **Qualitative:** **Screen readers:** distinguish **rest** vs **workout** days (labels or semantics per platform best practice).
- **Qualitative:** **EN + FR** complete for new strings; **week** layout respects **locale** for the active language.

---

## Risks, gaps, and open questions

| Topic | Gap / risk | Mitigation |
|---|---|---|
| **Metric honesty** | Legacy sessions: missing duration, partial logs | Contract + **“—”** / hide tile; optional “partial data” microcopy |
| **StatsDashboard vs monthly summary** | Two sources of “totals” confuse users | Tech Plan: single placement strategy + **labeled** scopes (e.g. “all time” vs “this month”) |
| **Calendar vs heatmap redundancy** | Same month visually twice | Calendar = **nav + drill-down**; heatmap = **strictly longer** horizon; optional **collapse** heatmap on small screens |
| **Mobile density** | Long scroll on Activity | Collapsible heatmap, sticky month header, or summary **accordion**—Tech Plan chooses |
| **Performance** | Huge `useSessionHistory` payloads | Pagination, date-range query, or RPC—Tech Plan profiles |
| **Three tabs** | Cognitive load | **Activity** default; **no fourth** tab in v1; short tab labels in i18n |
| **Muscle charts** | Heavy joins, ambiguous muscle attribution | Discovery doc first; chart only if **bounded** query + honest legend |
| **Timezone travel** | User crosses zones mid-trip | Deferred rule in Tech Plan; document **edge** behavior once |
| **Zero-history user** | Empty month + empty heatmap | Dedicated **empty states** and copy; avoid broken layouts |

---

## Decisions locked in this brief vs deferred to Tech Plan

| Locked here | Deferred to Tech Plan |
|---|---|
| Tab names and order (**Activity → Sessions → By exercise**); Activity default | Exact **heatmap** week count and default **collapsed** state on mobile |
| **Finished session** = basis for dots and heatmap (predicate aligned with history) | Exact SQL/filter edge cases (zero-set finished session, etc.) |
| **Locale-aware** week start and labels | Whether **StatsDashboard** stays global, moves under Activity, or is slimmed |
| Metrics must be **contract-backed**; no fake numbers | **Formulas** for each monthly tile |
| Calendar + heatmap share **one** bucketing rule | **Which** timezone API (e.g. `Intl`, `date-fns-tz`) and **DST** tests |
| **Recommendation** for default day: last trained day in month, else today | Final choice among (A)/(B)/(C) if product overrides |
| Discovery **documents** required for muscle charts | Whether a **single** v1 chart ships post-discovery |

---

## Relationship to other work

- **[#107](https://github.com/PierreTsia/workout-app/issues/107)** — Source issue and acceptance checklist.
- **Exercise History Quick-View** ([`file:docs/done/Epic_Brief_—_Exercise_History_Quick-View.md`](docs/done/Epic_Brief_—_Exercise_History_Quick-View.md)) — **In-session** sheet; global History remains **browse + rhythm**.

---

## Dependencies

- **Existing:** [`file:src/hooks/useSessionHistory.ts`](file:src/hooks/useSessionHistory.ts), [`file:src/hooks/useStatsAggregates.ts`](file:src/hooks/useStatsAggregates.ts), [`file:src/components/history/SessionList.tsx`](file:src/components/history/SessionList.tsx), [`file:src/components/history/ExerciseTab.tsx`](file:src/components/history/ExerciseTab.tsx), [`file:src/components/ui/tabs.tsx`](file:src/components/ui/tabs.tsx) (or successor).
- **Data model:** `sessions`, `set_logs`, RLS—as in [`file:docs/PRD.md`](docs/PRD.md).

---

## Testing strategy (epic level)

- **Automated:** Component tests for Activity calendar—**select day**, **empty day**, **month change** if stable; reuse existing test utilities where present.
- **Optional E2E:** History → Activity → select day → assert session list region, if selectors are stable.
- **Accessibility:** Manual pass: **Tab** / **arrow** behavior per implementation, **VoiceOver** (or equivalent) for day types, **visible focus** on day cells.
- **i18n:** Switch **EN/FR**; verify week header order and strings.

---

## References

- [GitHub issue #107 — Revamp History: drawer icon, calendar view, analytics](https://github.com/PierreTsia/workout-app/issues/107)
- [React Heatmap Calendar (shadcn-style reference)](https://heatmap-shadcn.vercel.app/)
- [`file:src/pages/HistoryPage.tsx`](file:src/pages/HistoryPage.tsx), [`file:src/components/history/`](file:src/components/history/), [`file:src/components/SideDrawer.tsx`](file:src/components/SideDrawer.tsx)

---

## Next step

Say **create tech plan** for this brief to produce the **metrics contract** tables, **StatsDashboard** placement decision, **day-default** finalization, data-fetch shape, and ticket-sized work.
