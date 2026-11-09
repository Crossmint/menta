CREATE TABLE IF NOT EXISTS default_addresses (
  user_id text PRIMARY KEY CHECK (length(user_id) BETWEEN 1 AND 200),
  buyer_profile_id text NOT NULL CHECK (length(buyer_profile_id) BETWEEN 1 AND 200),
  updated_at timestamptz NOT NULL DEFAULT now()
);
