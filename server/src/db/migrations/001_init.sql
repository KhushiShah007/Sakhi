CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  phone_hash    TEXT NOT NULL UNIQUE,
  phone_enc     TEXT NOT NULL,
  birth_year    INT  NOT NULL CHECK (birth_year > 1900),
  lang          TEXT NOT NULL DEFAULT 'hi' CHECK (lang IN ('hi','mr','gu','en')),
  stage         TEXT CHECK (stage IN ('perimenopause','menopause','surgical_early','no_family')),
  city          TEXT,
  discreet      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE otps (
  phone_hash TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INT NOT NULL DEFAULT 0
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf       TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Consent history is append-only: a withdrawal is a new row, never an update.
CREATE TABLE consents (
  id         BIGSERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT NOT NULL CHECK (purpose IN ('core_logging','family_signals','doctor_brief','employer_aggregate','research_atlas','store_audio')),
  granted    BOOLEAN NOT NULL,
  at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every access to her data. Contains NO content, only who/what/when.
-- user_id is not a foreign key so the trail of a deletion survives; it is pseudonymous (hashed) after deletion.
CREATE TABLE audit_log (
  id       BIGSERIAL PRIMARY KEY,
  user_id  TEXT NOT NULL,
  actor    TEXT NOT NULL,
  action   TEXT NOT NULL,
  resource TEXT NOT NULL,
  at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only entries she confirmed. There is deliberately no column for the transcript.
CREATE TABLE logs (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symptom   TEXT NOT NULL,
  severity  INT  NOT NULL CHECK (severity BETWEEN 0 AND 4),
  at        TIMESTAMPTZ NOT NULL,
  confirmed BOOLEAN NOT NULL DEFAULT TRUE CHECK (confirmed)
);
CREATE INDEX logs_user_at ON logs(user_id, at);
