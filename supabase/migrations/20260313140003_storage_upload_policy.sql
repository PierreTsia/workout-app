CREATE POLICY "Admins can upload exercise media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'exercise-media'
  AND auth.jwt() ->> 'email' IN (SELECT email FROM admin_users)
);

CREATE POLICY "Admins can update exercise media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'exercise-media'
  AND auth.jwt() ->> 'email' IN (SELECT email FROM admin_users)
);

