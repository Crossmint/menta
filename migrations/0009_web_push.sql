CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint_hash TEXT NOT NULL UNIQUE,
  subscription_sealed TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS web_push_user ON web_push_subscriptions (user_id);

-- Delivery deduplication only. Crossmint owns the checkout and its state.
CREATE TABLE IF NOT EXISTS web_push_deliveries (
  subscription_id UUID NOT NULL REFERENCES web_push_subscriptions(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  state_key TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (subscription_id, run_id, state_key)
);
