-- When each connected agent (an OAuth client of the user's) last used Menta,
-- and the name and version it gives itself at `initialize`. Stytch keeps the
-- connection and has neither, so Agents can tell two "ChatGPT" connections
-- apart. Touched at most every few minutes per agent.
CREATE TABLE IF NOT EXISTS agent_use (
  user_id text NOT NULL CHECK (length(user_id) BETWEEN 1 AND 200),
  client_id text NOT NULL CHECK (length(client_id) BETWEEN 1 AND 2048),
  client_name text CHECK (client_name IS NULL OR length(client_name) <= 100),
  client_version text CHECK (client_version IS NULL OR length(client_version) <= 40),
  first_used_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_id)
)
