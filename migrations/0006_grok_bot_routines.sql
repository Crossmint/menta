ALTER TABLE mcp_clients ADD COLUMN IF NOT EXISTS client_name text CHECK (client_name IS NULL OR length(client_name) <= 100);
CREATE TABLE IF NOT EXISTS grok_bot_routines (
  user_id text PRIMARY KEY CHECK (length(user_id) BETWEEN 1 AND 200),
  webhook_url text NOT NULL CHECK (length(webhook_url) BETWEEN 1 AND 2048),
  key_sealed text NOT NULL,
  key_hint text NOT NULL CHECK (length(key_hint) <= 8),
  enabled boolean NOT NULL DEFAULT true,
  seen jsonb NOT NULL DEFAULT '{}'::jsonb,
  watches jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_delivery_at timestamptz,
  last_error text,
  failed_since timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)
