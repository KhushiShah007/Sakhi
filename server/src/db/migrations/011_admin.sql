-- Content register: what the app says, its versions, and whether a NAMED clinician has reviewed it. Default is "not reviewed".
CREATE TABLE content_items (
  kind              TEXT NOT NULL CHECK (kind IN ('right_now','signal_card','say_this','module','crisis_script','rule_out')),
  key               TEXT NOT NULL,
  version           INT  NOT NULL,
  title             TEXT NOT NULL,
  body              JSONB NOT NULL,
  status            TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live','draft')),
  clinician_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  reviewer          TEXT,
  reviewed_at       DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, key, version),
  CHECK (NOT clinician_reviewed OR (reviewer IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE TABLE admin_sessions (token_hash TEXT PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL);
-- Self-reported by her ("I have seen my doctor"); feeds the pilot's time-to-first-consultation measure.
ALTER TABLE users ADD COLUMN first_consult_at DATE;
