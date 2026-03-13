ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read exercises"
ON exercises FOR SELECT
USING (true);

CREATE POLICY "Admins can update exercises"
ON exercises FOR UPDATE
USING (auth.jwt() ->> 'email' IN (SELECT email FROM admin_users));

CREATE POLICY "Admins can insert exercises"
ON exercises FOR INSERT
WITH CHECK (auth.jwt() ->> 'email' IN (SELECT email FROM admin_users));
