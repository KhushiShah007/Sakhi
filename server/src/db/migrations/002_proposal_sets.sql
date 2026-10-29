-- Unconfirmed proposals (symptom/severity only, never her words). Encrypted, single use, short-lived.
CREATE TABLE proposal_sets (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data_enc   TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX proposal_sets_expiry ON proposal_sets(expires_at);
