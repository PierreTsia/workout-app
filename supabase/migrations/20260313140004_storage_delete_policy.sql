CREATE POLICY "Admins can delete exercise media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'exercise-media'
  AND auth.jwt() ->> 'email' IN (SELECT email FROM admin_users)
);
