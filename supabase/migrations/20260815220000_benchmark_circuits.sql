-- Benchmark Circuit catalog + Cindy seed (#398, T191, ADR 0015).
-- Catalog identity is its own entity; day instances snapshot Rx onto exercise_blocks.
-- Do NOT add block_runs.benchmark_circuit_id here — that is T193 (GO snapshot).

CREATE TABLE benchmark_circuits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text,
  owner_id uuid REFERENCES auth.users (id),
  forked_from uuid REFERENCES benchmark_circuits (id),
  aliases text[] NOT NULL DEFAULT '{}',
  tagline_fr text,
  tagline_en text,
  story_fr text,
  story_en text,
  reference jsonb,
  rx jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT benchmark_circuits_slug_owner CHECK (
    (owner_id IS NULL AND slug IS NOT NULL) OR
    (owner_id IS NOT NULL AND slug IS NULL)
  )
);

CREATE UNIQUE INDEX benchmark_circuits_slug_unique
  ON benchmark_circuits (slug) WHERE slug IS NOT NULL;

ALTER TABLE exercise_blocks
  ADD COLUMN benchmark_circuit_id uuid
    REFERENCES benchmark_circuits (id) ON DELETE SET NULL;

ALTER TABLE benchmark_circuits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read gymlogic seeds and own forks"
  ON benchmark_circuits FOR SELECT
  USING (owner_id IS NULL OR owner_id = auth.uid());

CREATE POLICY "Users insert own forks"
  ON benchmark_circuits FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users update own forks"
  ON benchmark_circuits FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users delete own forks"
  ON benchmark_circuits FOR DELETE
  USING (owner_id = auth.uid());

-- Cindy seed. INTO STRICT fails the migration if any FR catalog name is missing.
DO $$
DECLARE
  pullup_id uuid;
  pushup_id uuid;
  squat_id uuid;
BEGIN
  SELECT id INTO STRICT pullup_id FROM exercises WHERE name = 'Tractions';
  SELECT id INTO STRICT pushup_id FROM exercises WHERE name = 'Pompes';
  SELECT id INTO STRICT squat_id FROM exercises WHERE name = 'Squat au poids du corps';

  INSERT INTO benchmark_circuits (
    slug,
    owner_id,
    aliases,
    tagline_fr,
    tagline_en,
    story_fr,
    story_en,
    reference,
    rx
  ) VALUES (
    'cindy',
    NULL,
    ARRAY['holland', 'tom holland'],
    'Le WOD de Tom Holland. 20 min.',
    'Tom Holland’s WOD. 20 min.',
    'Cinq tractions, dix pompes, quinze squats. Autant de tours que possible. Le score s’écrit 27+3, pas en kilos. Holland a posé 27 tours — à toi de voir.',
    'Five pull-ups, ten push-ups, fifteen squats. As many rounds as possible. The score is 27+3, not kilos. Holland did 27 rounds — your move.',
    '{"name": "Tom Holland", "score": "27"}'::jsonb,
    jsonb_build_object(
      'mode', 'amrap',
      'cap_seconds', 1200,
      'exercises', jsonb_build_array(
        jsonb_build_object('exercise_id', pullup_id, 'amount', 5, 'weight', 0),
        jsonb_build_object('exercise_id', pushup_id, 'amount', 10, 'weight', 0),
        jsonb_build_object('exercise_id', squat_id, 'amount', 15, 'weight', 0)
      )
    )
  );
END $$;
