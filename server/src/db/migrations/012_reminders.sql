-- Gentle reminders. Opt-in, off by default. A push subscription is a device address, so it is stored encrypted.
CREATE TABLE push_subscriptions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint_hash TEXT NOT NULL UNIQUE,
  sub_enc       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE reminders (
  user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  checkin_on        BOOLEAN NOT NULL DEFAULT false,
  checkin_time      TEXT NOT NULL DEFAULT '09:30' CHECK (checkin_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  weather_on        BOOLEAN NOT NULL DEFAULT false,
  last_checkin_day  TEXT,
  last_weather_day  TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
