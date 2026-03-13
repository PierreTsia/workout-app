# Epic Brief — Exercise Content Feedback

## Summary

Users can report AI-generated exercise content errors (wrong description, video, or illustration) from any screen that displays exercise details. A side-panel form collects structured, two-step feedback — what is wrong, then how it is wrong — and stores it in a dedicated Supabase table (`exercise_content_feedback`) with resolution-tracking columns ready for future triage. No treatment or dashboard UI is included in this epic.

---

## Context & Problem

**Who is affected:** All users browsing or using exercises with AI-generated content (~575 imported exercises from Wger).

**Current state:**
- Exercise content (instructions, YouTube URLs, illustrations) was bulk-generated via enrichment scripts and may contain errors
- There is no mechanism for users to flag incorrect content
- Admins have no visibility into which exercises have bad data
- The 23 hand-curated exercises could also have issues

**Pain points:**
| Pain | Impact |
|---|---|
| Wrong instructions can teach bad form | Risk of injury, loss of user trust |
| Unrelated YouTube videos | Erodes confidence in exercise content |
| Misleading illustrations | Confusing UX, users may perform wrong movement |
| No feedback loop | Errors persist indefinitely with no way to surface them |

---

## Goals

| Goal | Measure |
|---|---|
| Enable users to report content errors quickly | Form submittable in under 30 seconds for a straightforward report |
| Collect structured, actionable data | Every report includes which fields are wrong + error type per field |
| Store reports for future triage | Dedicated table with resolution-tracking columns (`status`, `resolved_at`, `resolved_by`) |
| Feedback accessible from all exercise views | Button present on all 3 exercise detail screens |

---

## Scope

**In scope:**

1. **Entry points (3 screens)** — A feedback button on each of these components:
   - `file:src/components/workout/ExerciseDetail.tsx` — workout session view
   - `file:src/components/builder/ExerciseDetailEditor.tsx` — builder view
   - `file:src/components/exercise/ExerciseInfoDialog.tsx` — library picker dialog

   The button opens a Sheet (right-side slide-out panel) with the feedback form. Button is placed directly on each screen component (not inside `ExerciseInstructionsPanel`) to ensure visibility even when instructions are collapsed or absent.

2. **Two-step feedback form (React Hook Form + Zod)**

   Step 1 — **What is wrong?** (multi-select checkboxes):
   - Illustration / image
   - Video (YouTube)
   - Description / instructions

   Step 2 — **How is it wrong?** (contextual per selection, multi-select):
   - For illustration: "Shows wrong exercise", "Misleading angle/form", "Other"
   - For video: "Shows a different exercise", "Poor quality / unusable", "Other"
   - For description: "Instructions unrelated to exercise name", "Wrong muscle focus", "Missing steps", "Other"

   Each "Other" selection reveals a required free-text field.

   Additional fields:
   - **User email** — read-only, from `authAtom` (Jotai)
   - **Optional comment** — free-text textarea
   - **Exercise ID** — hidden, passed as prop
   - **Source screen** — hidden, enum: `workout` | `builder` | `library_picker`

   Validation: at least one "what" checkbox required; "Other" forces its text field.

3. **Supabase table: `exercise_content_feedback`**

   | Column | Type | Notes |
   |---|---|---|
   | id | uuid | PK, `gen_random_uuid()` |
   | exercise_id | uuid | FK to `exercises.id`, NOT NULL |
   | user_email | text | NOT NULL |
   | user_id | uuid | FK to `auth.users.id`, NOT NULL |
   | source_screen | text | `workout`, `builder`, `library_picker` |
   | fields_reported | text[] | e.g. `['illustration', 'video']` |
   | error_details | jsonb | e.g. `{"illustration": ["wrong_exercise"], "video": ["different_exercise", "other"]}` |
   | other_text | text | Free-text for "Other" selections |
   | comment | text | Optional free-text comment |
   | status | text | `pending` / `in_review` / `resolved`, NOT NULL, default `pending` |
   | resolved_at | timestamptz | NULL until resolved |
   | resolved_by | text | Email or identifier of the person who resolved it |
   | created_at | timestamptz | `now()` |

   RLS: authenticated users can INSERT their own rows. No SELECT/UPDATE/DELETE for regular users.

4. **i18n** — All form labels, error messages, and button text in FR + EN. New namespace `feedback` or extend `exercise` namespace.

5. **Post-submission UX** — Success toast (via Sonner) + close the Sheet panel.

6. **Resolution tracking columns (data model only)** — The table includes `status` (`pending` → `in_review` → `resolved`), `resolved_at`, and `resolved_by` from day one. No UI to update these in this epic — they exist so a future admin triage feature doesn't require a schema migration. New rows default to `pending`.

**Out of scope:**
- Treatment / triage UI for submitted feedback (admin dashboard, status workflow, updating status/resolved_by)
- Generic feedback form (bugs, features, UI/UX)
- Rate limiting, duplicate prevention, or auto-reply
- Email notifications on submission

---

## Success Criteria

- **Numeric:** Feedback button visible on all 3 exercise detail screens; form submittable in under 30 seconds
- **Numeric:** Data stored correctly in `exercise_content_feedback` with all structured fields populated
- **Qualitative:** Form validates properly — at least one field selected, "Other" text required when "Other" is checked
- **Qualitative:** Works on mobile (425px width) and desktop
- **Qualitative:** FR and EN translations complete for all form UI

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Panel type | Sheet (right-side) | Consistent with existing `SideDrawer` pattern, better for mobile |
| Form structure | Two-step contextual | Avoids redundancy between "what" and "how", produces more actionable triage data |
| Storage | Separate `exercise_content_feedback` table | Keeps feedback data clean, no coupling with exercises table |
| Button placement | Directly on each screen component | Visible even when instructions are collapsed or absent |
| User identification | `user_id` + `user_email` both stored | FK integrity + human-readable in future admin views |
| Resolution tracking | Columns baked in, no UI | Avoids future migration when triage is built |
| Duplicate prevention | None | Keep it simple; revisit only if spam becomes a real problem |
| Hand-curated exercises | Show button on all exercises | Curated content can have issues too |

---

## Resolved Questions

- **Duplicate prevention:** No. Users can submit multiple reports for the same exercise — keeps it simple, revisit only if spam becomes a real problem.
- **Hide button for hand-curated exercises:** No. All exercises get the feedback button — curated content can have issues too.
