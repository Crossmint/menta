CREATE TABLE IF NOT EXISTS checkout_agents (
  run_id text PRIMARY KEY CHECK (length(run_id) BETWEEN 1 AND 200),
  user_id text NOT NULL,
  agent text NOT NULL CHECK (length(agent) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkout_agents_user ON checkout_agents (user_id)
