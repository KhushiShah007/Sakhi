-- Rehearsal Room sessions. What she said and what the other person said are stored encrypted (AES-GCM); feedback is rule-based pass/fail only.
CREATE TABLE rehearsal_sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario   TEXT NOT NULL CHECK (scenario IN ('family','hr','doctor')),
  lang       TEXT NOT NULL CHECK (lang IN ('hi','mr','gu','en')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at   TIMESTAMPTZ,
  feedback   JSONB
);
CREATE INDEX rehearsal_sessions_user ON rehearsal_sessions(user_id, created_at DESC);
CREATE TABLE rehearsal_turns (
  session_id TEXT NOT NULL REFERENCES rehearsal_sessions(id) ON DELETE CASCADE,
  idx        INT  NOT NULL,
  who        TEXT NOT NULL CHECK (who IN ('me','them')),
  text_enc   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, idx)
);
