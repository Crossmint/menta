ALTER TABLE grok_bot_routines ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
CREATE TABLE IF NOT EXISTS grok_bot_offers (
  user_id text PRIMARY KEY CHECK (length(user_id) BETWEEN 1 AND 200),
  offered_at timestamptz NOT NULL DEFAULT now()
)
