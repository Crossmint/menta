CREATE TABLE IF NOT EXISTS user_memories (
  user_id TEXT PRIMARY KEY,
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  version TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(notes) = 'array')
);
