CREATE TABLE IF NOT EXISTS mcp_clients (
  client_id text PRIMARY KEY CHECK (length(client_id) BETWEEN 1 AND 2048),
  draws_cards boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
)
