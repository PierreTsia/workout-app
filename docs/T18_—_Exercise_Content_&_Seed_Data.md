# T18 — Exercise Content & Seed Data

## Goal

Populate all 24 system exercises with curated instructional content: structured French instructions (setup, movement, breathing, common mistakes), YouTube video URLs, and exercise images uploaded to Supabase Storage. Update `seed.sql` so fresh database setups include all content. This is the ticket that makes the UI components from T16/T17 actually useful — without content, the collapsible sections render nothing.

## Dependencies

- **T15** — Schema, Types & Utilities (migration must be applied — the 3 new columns and the `exercise-media` storage bucket must exist)

Note: This ticket does NOT depend on T16 or T17. It can be worked in parallel with the UI tickets. A developer can populate data independently and verify it directly in the database / Supabase dashboard.

## Scope

### Instruction Content (24 exercises)

For each of the 24 system exercises in `file:supabase/seed.sql`, write a structured `instructions` JSONB object with four sections:

| Section | Content guidance |
|---|---|
| `setup` | Body position, grip, machine settings, starting stance. 2-4 steps. |
| `movement` | The concentric and eccentric phases. Range of motion cues. Tempo if relevant. 2-4 steps. |
| `breathing` | When to inhale, when to exhale relative to the movement phases. 1-2 steps. |
| `common_mistakes` | Form errors that cause injury or reduce effectiveness. 2-4 items. |

All content in French, consistent with existing exercise names and muscle group labels. Instructions should be:
- Concise (each step is 1 sentence, max ~15 words)
- Actionable (start with a verb)
- Beginner-friendly (no jargon without explanation)

### YouTube URLs (24 exercises)

For each exercise, find a high-quality instructional YouTube video:

| Priority | Channel type | Notes |
|---|---|---|
| 1st | French fitness channels | Matches the app's language. Examples: Tibo InShape, Nassim Sahili, All Musculation |
| 2nd | Major English channels | If no good French video exists. Examples: Jeff Nippard, AthleanX, Renaissance Periodization |
| 3rd | Skip | If no suitable video found, leave `youtube_url` as `null` |

Target: >= 80% coverage (at least 20 of 24 exercises).

Criteria for selecting a video:
- Demonstrates the exact exercise (not a variation)
- Shows proper form from multiple angles
- Duration under 5 minutes (instructional, not a full workout)
- From a reputable channel (not random uploads)

### Exercise Images (24 exercises)

Source or create one image per exercise:

| Source option | Notes |
|---|---|
| AI-generated illustrations | Consistent style across all exercises. Recommended approach. |
| Royalty-free stock | Flaticon, Freepik, Unsplash — ensure license allows commercial use |
| Screenshots from videos | Fair use gray area — use as last resort |

Image requirements:
- Format: GIF (animated showing the movement) or PNG/JPEG (static showing the key position)
- Aspect ratio: ~16:9 (matches `aspect-video` Tailwind class)
- Max file size: 500KB per image (fast loading on mobile)
- Naming convention: `kebab-case-exercise-name.{ext}` (e.g., `developpe-couche.gif`, `arnold-press.png`)

Target: >= 90% coverage (at least 22 of 24 exercises).

### Upload to Supabase Storage

Upload all images to the `exercise-media` bucket (created by T15 migration). Use the Supabase dashboard or CLI:

```bash
supabase storage cp ./images/developpe-couche.gif exercise-media/developpe-couche.gif
```

Verify each image is publicly accessible at:
`{SUPABASE_URL}/storage/v1/object/public/exercise-media/{filename}`

### Update seed.sql

Update `file:supabase/seed.sql` to include `youtube_url`, `instructions`, and `image_url` in the `INSERT INTO exercises` statement for all 24 exercises.

The current INSERT:
```sql
INSERT INTO exercises (name, muscle_group, emoji, is_system) VALUES
  ('Arnold Press Haltères', 'Épaules', '🏋️', true),
  ...
```

Becomes:
```sql
INSERT INTO exercises (name, muscle_group, emoji, is_system, youtube_url, instructions, image_url) VALUES
  ('Arnold Press Haltères', 'Épaules', '🏋️', true,
   'https://www.youtube.com/watch?v=...',
   '{"setup": ["..."], "movement": ["..."], "breathing": ["..."], "common_mistakes": ["..."]}',
   'arnold-press.gif'),
  ...
```

Verify the seed runs cleanly on `supabase db reset` with no JSON parse errors.

### Exercise List Reference

The 24 exercises to populate (from current seed):

| # | Exercise | Muscle Group |
|---|---|---|
| 1 | Arnold Press Haltères | Épaules |
| 2 | Papillon bras tendus | Pectoraux |
| 3 | Élévations latérales | Épaules |
| 4 | Skull Crusher incliné | Triceps |
| 5 | Presse à cuisse | Quadriceps |
| 6 | Élévation mollet machine | Mollets |
| 7 | Crunch assis machine | Abdos |
| 8 | Rangées prise serrée neutre | Dos |
| 9 | Rangées prise large pronation | Dos |
| 10 | Curls biceps inclinés | Biceps |
| 11 | Papillon inverse | Deltoïdes post. |
| 12 | Shrugs haltères | Trapèzes |
| 13 | Soulevé de terre roumain | Ischios / Bas du dos |
| 14 | Extension du dos machine | Lombaires |
| 15 | Crunch à genoux poulie | Abdos |
| 16 | Développé couché | Pectoraux |
| 17 | Tirage latéral prise large | Dos |
| 18 | Pec Deck bras tendus | Pectoraux |
| 19 | Extension triceps corde | Triceps |
| 20 | Curls stricts barre | Biceps |
| 21 | Extension de jambe machine | Quadriceps |
| 22 | Leg Curl assis | Ischios |
| 23 | Extension mollet machine | Mollets |
| 24 | (duplicate of #6 — may need deduplication) | Mollets |

Note: exercises #6 and #23 appear to be duplicates ("Élévation mollet machine" vs "Extension mollet machine"). Verify during content creation and flag if they are truly the same exercise.

## Out of Scope

- English translations of instruction content
- Creating new exercises beyond the 24 system exercises
- Video production or custom GIF creation (we use existing sources)
- Modifying UI components — they already handle all content via T16/T17
- Offline caching of images

## Acceptance Criteria

- [ ] 100% of 24 system exercises have populated `instructions` JSONB with all 4 sections (setup, movement, breathing, common_mistakes)
- [ ] >= 80% of exercises (at least 20) have a valid `youtube_url` pointing to a relevant instructional video
- [ ] >= 90% of exercises (at least 22) have an `image_url` with a corresponding file in the `exercise-media` bucket
- [ ] All images in the storage bucket are publicly accessible and load correctly in a browser
- [ ] Image file sizes are all under 500KB
- [ ] Updated `seed.sql` runs cleanly on `supabase db reset` with no errors
- [ ] Instructions are in French, concise, and actionable (peer review recommended)
- [ ] YouTube URLs point to videos that demonstrate the exact exercise (not variations)

## References

- [Epic Brief — Exercise Demo & Instructions](Epic_Brief_—_Exercise_Demo_&_Instructions.md) — Scope item 5 (Seed data update), Success Criteria (coverage thresholds)
- [Tech Plan — Exercise Demo & Instructions](Tech_Plan_—_Exercise_Demo_&_Instructions.md) — Table Notes (image_url format, instructions shape, youtube_url format)
