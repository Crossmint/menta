-- The names users give their saved cards ("Work card"). Crossmint keeps the
-- cards and has no name for them, so this is only the label, by payment method.
CREATE TABLE IF NOT EXISTS card_names (
  user_id text NOT NULL CHECK (length(user_id) BETWEEN 1 AND 200),
  payment_method_id text NOT NULL CHECK (length(payment_method_id) BETWEEN 1 AND 100),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, payment_method_id)
)
