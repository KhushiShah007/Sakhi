-- Sakhi for Workplaces. HR only ever reads aggregates computed by the query layer in server/src/api/hr.ts (k >= 10).
CREATE TABLE employers (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  invite_code     TEXT NOT NULL UNIQUE,       -- employees enter this to opt in; it identifies no one
  hr_code_hash    TEXT NOT NULL,              -- sha256 of the HR access code
  eligible        INT  NOT NULL CHECK (eligible > 0),
  locations       TEXT[] NOT NULL,
  flexi_supported INT  NOT NULL DEFAULT 0,    -- entered by HR; not derived from any employee
  resources       JSONB NOT NULL DEFAULT '[]'
);
CREATE TABLE employer_members (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  employer_id TEXT NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  location    TEXT NOT NULL,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX employer_members_employer ON employer_members(employer_id);
CREATE TABLE hr_sessions (
  token_hash  TEXT PRIMARY KEY,
  employer_id TEXT NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL
);
