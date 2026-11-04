CREATE TABLE IF NOT EXISTS mcp_event_subscriptions (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100),
  user_id text NOT NULL CHECK (length(user_id) BETWEEN 1 AND 200),
  event_name text NOT NULL CHECK (length(event_name) BETWEEN 1 AND 100),
  run_id text CHECK (run_id IS NULL OR length(run_id) BETWEEN 1 AND 200),
  callback_url text NOT NULL CHECK (length(callback_url) BETWEEN 1 AND 2048),
  host text,
  secret text,
  previous_secret text,
  previous_secret_until timestamptz,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz NOT NULL,
  seen jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_delivery_at timestamptz,
  last_error text,
  failed_since timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mcp_event_subscriptions_by_user
  ON mcp_event_subscriptions (user_id, expires_at);
CREATE INDEX IF NOT EXISTS mcp_event_subscriptions_by_expiry
  ON mcp_event_subscriptions (expires_at)
