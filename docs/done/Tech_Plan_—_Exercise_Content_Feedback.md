# Tech Plan — Exercise Content Feedback

## Architectural Approach

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Panel type | Sheet (right-side), existing `@/components/ui/sheet` | Matches ExerciseLibraryPicker and SideDrawer; mobile-friendly. |
| Form stack | React Hook Form + Zod + `@hookform/resolvers/zod` | Already used in ExerciseEditForm; consistent validation and types. |
| Entry-point placement | Shared trigger component in 3 parents | **Workout:** ExerciseDetail header. **Builder:** ExerciseDetailEditor header. **Library picker:** ExerciseSelectionContent row, next to ExerciseInfoDialog. Button in list row keeps it visible when hasContent is false. |
| Feedback state | Local `open` state in trigger; Sheet controlled by parent of form | Trigger opens Sheet; form in Sheet content; on success: toast + close. No global atom. |
| User identity | `useAtomValue(authAtom)` for `user.id` and `user.email` | Same as useBuilderMutations, useAdminUpdateExercise. |
| Submit | Direct `supabase.from("exercise_content_feedback").insert(...)` from a hook | Fire-and-forget with toast on success/error. |
| i18n | New namespace `feedback` in `src/locales/{en,fr}/feedback.json` | Keeps form labels/errors separate from `exercise`. |

### Critical Constraints

- **Auth:** Workout, builder, and library picker are already behind AuthGuard; use `authAtom` only to read `user.id` and `user.email` for the insert. If the user logs out before submit, RLS will reject — show a generic error toast.
- **ExerciseInfoDialog null:** Third entry point is the library picker list row (ExerciseSelectionContent), so the feedback button sits beside the Info button and is visible for every exercise.
- **Nested dialogs/sheets:** Feedback Sheet may open from within the library picker Sheet; test on iOS.
- **RLS:** New table allows INSERT only for authenticated users with `user_id = auth.uid()`; no SELECT/UPDATE/DELETE for regular users.

---

## Data Model

### New table: `exercise_content_feedback`

- **Columns:** `id` (uuid, PK), `exercise_id` (FK exercises.id NOT NULL), `user_email` NOT NULL, `user_id` NOT NULL, `source_screen` text, `fields_reported` text[], `error_details` jsonb, `other_text` text, `comment` text, `status` text NOT NULL DEFAULT `'pending'`, `resolved_at` timestamptz, `resolved_by` text, `created_at` timestamptz DEFAULT `now()`.
- **RLS:** Authenticated users can INSERT with `auth.uid() = user_id`; no SELECT/UPDATE/DELETE for regular users.
- **error_details:** JSONB — keys = field names (illustration | video | description), values = arrays of option keys.
- **source_screen:** Enum in app: `workout` | `builder` | `library_picker`.

---

## Component Architecture

- **FeedbackTrigger** — Button; receives `exerciseId`, `sourceScreen`; local state for Sheet open.
- **FeedbackSheet** — Sheet (right), SheetHeader, FeedbackForm; on success: onSuccess() + toast.
- **FeedbackForm** — Two-step RHF + Zod: step 1 = what is wrong (checkboxes), step 2 = how (contextual + "Other" text). Submit via useSubmitFeedback.
- **useSubmitFeedback** — Insert one row into `exercise_content_feedback`; uses supabase from `@/lib/supabase`.

### New files

| File | Purpose |
|---|---|
| `src/components/feedback/FeedbackTrigger.tsx` | Button + Sheet open state; passes exerciseId + sourceScreen. |
| `src/components/feedback/FeedbackSheet.tsx` | Sheet wrapper + form; onSuccess: toast + onClose. |
| `src/components/feedback/FeedbackForm.tsx` | Two-step form, validation, "Other" conditional text. |
| `src/components/feedback/schema.ts` | Zod schema and mapping to DB insert type. |
| `src/hooks/useSubmitFeedback.ts` | Insert into `exercise_content_feedback`. |
| `src/locales/en/feedback.json` | EN strings. |
| `src/locales/fr/feedback.json` | FR strings. |
| `supabase/migrations/..._create_exercise_content_feedback.sql` | Table + RLS. |

---

## Implementation order

1. Migration + types
2. i18n (feedback namespace)
3. Schema + FeedbackForm
4. useSubmitFeedback
5. FeedbackSheet + FeedbackTrigger
6. Entry points (ExerciseDetail, ExerciseDetailEditor, ExerciseSelectionContent)
7. Manual QA

---

## References

- Epic Brief: docs/Epic_Brief_—_Exercise_Content_Feedback.md
- Existing patterns: ExerciseLibraryPicker, ExerciseEditForm, SideDrawer
