-- People she shares signals with (family or a trusted person: sister, friend, ASHA worker).
CREATE TABLE people (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name_enc        TEXT NOT NULL,
  her_label       TEXT NOT NULL,                       -- what this person calls her, shown on the family page
  role            TEXT NOT NULL CHECK (role IN ('husband','son','daughter','teen','sister','friend','asha','other')),
  lang            TEXT NOT NULL DEFAULT 'hi' CHECK (lang IN ('hi','mr','gu','en')),
  phone_enc       TEXT,
  link_token_hash TEXT NOT NULL UNIQUE,
  content_only    BOOLEAN NOT NULL DEFAULT FALSE,      -- teens: lessons only, never signals
  paused          BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at      TIMESTAMPTZ,
  perm_signals    BOOLEAN NOT NULL DEFAULT TRUE,
  perm_alerts     BOOLEAN NOT NULL DEFAULT TRUE,
  perm_coaching   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A card is an enumerated type only. There is no text column: family never receives her words.
CREATE TABLE signals (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  person_id       TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  card_type       TEXT NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'link_only' CHECK (delivery_status IN ('link_only','sent','delivered','read','failed')),
  wa_message_id   TEXT,
  done_at         TIMESTAMPTZ,
  needs_help_at   TIMESTAMPTZ,
  helped_at       TIMESTAMPTZ
);
CREATE INDEX signals_user_sent ON signals(user_id, sent_at);
CREATE INDEX signals_wa ON signals(wa_message_id);

-- Only the risk LEVEL is shared with the household, never the inputs.
CREATE TABLE household_alerts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  for_date DATE NOT NULL,
  level   TEXT NOT NULL CHECK (level IN ('low','moderate','high')),
  PRIMARY KEY (user_id, for_date)
);
