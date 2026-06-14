-- Exercise Blocks (supersets / circuits) — #351, ADR 0007.
-- Rich round-by-round structure, day-scoped, private per user via RLS.
-- Blocks live alongside flat workout_exercises in a shared per-day sort_order
-- namespace (Unified Day Sequence). Blocks are deliberately OUT of the
-- progression engine in v1 — no progression columns here.

CREATE TABLE exercise_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_day_id uuid NOT NULL REFERENCES workout_days(id) ON DELETE CASCADE,
  label text,
  rounds integer NOT NULL DEFAULT 3 CHECK (rounds > 0),
  rest_seconds integer NOT NULL DEFAULT 90 CHECK (rest_seconds >= 0),
  transition_seconds integer NOT NULL DEFAULT 0 CHECK (transition_seconds >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE block_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES exercise_blocks(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id),
  name_snapshot text NOT NULL,
  muscle_snapshot text NOT NULL,
  emoji_snapshot text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  -- Per-round prescription: jsonb array of { amount, weight }, length === rounds.
  -- amount = reps or duration seconds per the exercise's measurement_type.
  per_round jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX idx_exercise_blocks_day ON exercise_blocks (workout_day_id, sort_order);
CREATE INDEX idx_block_exercises_block ON block_exercises (block_id, position);

-- RLS — ownership chain via workout_days.user_id (mirrors workout_exercises).
ALTER TABLE exercise_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own exercise_blocks" ON exercise_blocks
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM workout_days WHERE id = workout_day_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM workout_days WHERE id = workout_day_id)
  );

ALTER TABLE block_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own block_exercises" ON block_exercises
  FOR ALL USING (
    auth.uid() = (
      SELECT wd.user_id
      FROM exercise_blocks eb
      JOIN workout_days wd ON wd.id = eb.workout_day_id
      WHERE eb.id = block_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT wd.user_id
      FROM exercise_blocks eb
      JOIN workout_days wd ON wd.id = eb.workout_day_id
      WHERE eb.id = block_id
    )
  );
