CREATE TABLE admin_users (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can check their own admin status"
ON admin_users FOR SELECT
USING (auth.jwt() ->> 'email' = email);

INSERT INTO admin_users (email) VALUES ('pierre.tsiakkaros@gmail.com');
