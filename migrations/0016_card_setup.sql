-- How each saved card pays for agent spending limits, once set up: 'network'
-- (verified for Visa Intelligent Commerce or Mastercard Agent Pay) or
-- 'encrypted' (its network check failed, or it can't enroll: the encrypted
-- card, with no check). No row: not set up yet, so the next approval sets it
-- up first. Crossmint has no field for it.
CREATE TABLE IF NOT EXISTS card_setup (
  user_id text NOT NULL CHECK (length(user_id) BETWEEN 1 AND 200),
  payment_method_id text NOT NULL CHECK (length(payment_method_id) BETWEEN 1 AND 100),
  status text NOT NULL CHECK (status IN ('network', 'encrypted')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, payment_method_id)
)
