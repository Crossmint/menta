CREATE TABLE IF NOT EXISTS web_session_owners (
  session_id text PRIMARY KEY CHECK (length(session_id) BETWEEN 1 AND 200),
  issuer text NOT NULL CHECK (length(issuer) > 0 AND issuer = btrim(issuer)),
  subject text NOT NULL CHECK (length(subject) > 0 AND subject = btrim(subject))
);
