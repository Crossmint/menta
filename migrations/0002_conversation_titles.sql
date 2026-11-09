ALTER TABLE web_session_owners ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE web_session_owners ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS web_session_owners_by_owner
  ON web_session_owners (issuer, subject, created_at DESC);
