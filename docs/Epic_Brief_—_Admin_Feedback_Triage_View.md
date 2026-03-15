# Epic Brief — Admin Feedback Triage View

## Summary

Admin-only triage page at `/admin/feedback` to review, resolve, and reopen user-submitted exercise content feedback. The `exercise_content_feedback` table and resolution-tracking columns already exist — this epic adds the UI to surface and act on them, including a filterable table, resolve/reopen actions, expandable detail rows, and direct links to fix exercises.

---

## Context & Problem

**Who is affected:** Admins (currently Pierre) responsible for exercise content quality.

**Current state:**
- Users can report content errors from 3 screens (workout, builder, library picker)
- Reports land in `exercise_content_feedback` with `status = 'pending'` and are invisible — no UI to see or act on them
- Resolution columns (`status`, `resolved_at`, `resolved_by`) exist but are unused
- The side drawer has a flat "Admin" link pointing to `/admin/exercises` — no room for additional admin sub-pages

**Pain points:**
| Pain | Impact |
|---|---|
| Feedback is a black hole — reports accumulate with no way to triage them | Content errors persist indefinitely, eroding user trust |
| Admins must query the DB directly to see what users reported | Slow, error-prone, requires SQL knowledge |
| No workflow to track which feedback has been addressed | Duplicate work or forgotten reports |
| Single flat admin link doesn't scale | Adding more admin pages means cluttering the nav |

---

## Goals

| Goal | Measure |
|---|---|
| Let admins see all submitted feedback in a structured, filterable table | All `exercise_content_feedback` rows visible with exercise context |
| Enable resolve / in-review / reopen workflow directly from the UI | Status transitions work with optimistic updates |
| Link each feedback row to the exercise admin edit page for quick content fixes | One click from feedback to exercise edit |
| Surface full error details in a human-readable expandable format | Expandable row shows parsed `error_details` JSONB, other text fields, full comment |
| Triage speed | Admin can view, navigate to exercise, and resolve a feedback item in under 30 seconds |

---

## Scope

**In scope:**

1. **New route `/admin/feedback`** — Protected by `AdminGuard`, added to the router alongside existing admin routes

2. **Collapsible admin section in the side drawer** — Replace the current flat "Admin" link with a collapsible group (using existing `file:src/components/ui/collapsible.tsx`) containing sub-links: "Exercises" (`/admin/exercises`) and "Feedback" (`/admin/feedback`). Wrapped in `AdminOnly` so the entire group is hidden for non-admins. This structure accommodates future admin sub-pages.

3. **Feedback data table** — TanStack Table (same pattern as `file:src/pages/AdminExercisesPage.tsx`):
   - Columns: exercise (emoji + name, linked to `/admin/exercises/:id`), fields reported (badges), source screen, user email, comment (truncated), status (badge: pending / in_review / resolved), submitted (relative time)
   - Default sort: newest first (`created_at` DESC)

4. **Status filter** — pending / in_review / resolved / all

5. **Exercise and field filters** — Filter by exercise name, filter by reported field type

6. **Expandable detail row** showing:
   - Full `error_details` JSONB rendered human-readably (e.g., "Illustration: shows wrong exercise, misleading angle")
   - Full `other_illustration_text`, `other_video_text`, `other_description_text`
   - Full untruncated `comment`

7. **Resolve / status actions** per row:
   - Mark as in_review (sets `status = 'in_review'`)
   - Mark as resolved (sets `status = 'resolved'`, `resolved_at = now()`, `resolved_by = admin email`)
   - Reopen (sets `status = 'pending'`, clears `resolved_at` and `resolved_by`)
   - Optimistic UI update via TanStack Query mutation + cache invalidation

8. **RLS policies** — Admin SELECT + UPDATE on `exercise_content_feedback`

9. **Supabase query** joins `exercises` table to get exercise name + emoji

10. **FR + EN translations** — Extend existing `admin` i18n namespace

**Out of scope:**
- Pagination / infinite scroll (load all rows — volume is low)
- Batch operations (resolve multiple at once)
- Email notifications to users when feedback is resolved
- Editing feedback content from the admin view
- Deleting feedback rows

---

## Success Criteria

- **Numeric:** Admin can triage a feedback item (view, navigate to exercise, resolve) in under 30 seconds
- **Numeric:** All `exercise_content_feedback` rows visible in the table with correct joined exercise data
- **Qualitative:** `/admin/feedback` route exists, protected by `AdminGuard`
- **Qualitative:** Side drawer has a collapsible "Admin" group with "Exercises" and "Feedback" sub-links (admin-only)
- **Qualitative:** Status filter works (pending / in_review / resolved / all)
- **Qualitative:** Admin can cycle status: pending → in_review → resolved, and reopen
- **Qualitative:** Expandable detail row shows full error details and other text fields
- **Qualitative:** RLS policies allow admin SELECT + UPDATE
- **Qualitative:** Works on mobile and desktop
- **Qualitative:** FR + EN translations complete

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Table library | TanStack Table | Matches existing admin exercises table pattern |
| Data loading | Single query, no pagination | Feedback volume is low for now |
| Status workflow | Three statuses: pending / in_review / resolved | Finer-grained triage; `in_review` signals "acknowledged but not fixed yet" |
| Detail expansion | Expandable table row (not a side panel) | Simpler, works well on mobile |
| Optimistic updates | `useMutation` with optimistic cache update + rollback | Snappy UX, consistent with app patterns |
| DB column truth | Three separate `other_*_text` columns | Matches actual implementation (not the single `other_text` from the original tech plan) |
| Side drawer admin section | Collapsible group with sub-links | Scales for future admin pages without cluttering nav |
| i18n | Extend existing `admin` namespace | No need for a separate namespace |

---

## Resolved Questions

- **Schema mismatch (`other_text` vs three columns):** The actual implementation uses three separate columns (`other_illustration_text`, `other_video_text`, `other_description_text`), matching the issue schema — not the single `other_text` from the original tech plan.
- **`in_review` status:** Supported. The triage view implements all three statuses from the DB schema.
- **Nice-to-have features:** Both the expandable detail row and the exercise/field filters are in scope.
- **Pagination:** Not needed — load all rows. Revisit if feedback volume grows significantly.
- **`resolved_by` as text:** Intentionally denormalized (stores admin email as text, not a FK).

---

## References

- Issue: [#46 — Admin Feedback Triage View](https://github.com/PierreTsia/workout-app/issues/46)
- Parent epic: `docs/done/Epic_Brief_—_Exercise_Content_Feedback.md`
- Parent tech plan: `docs/done/Tech_Plan_—_Exercise_Content_Feedback.md`
- Existing admin pattern: `file:src/pages/AdminExercisesPage.tsx`, `file:src/components/admin/exercises-table/`
