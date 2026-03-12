ALTER TABLE exercises ADD COLUMN youtube_url text;
ALTER TABLE exercises ADD COLUMN instructions jsonb;
ALTER TABLE exercises ADD COLUMN image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-media', 'exercise-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for exercise-media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'exercise-media');
