-- Discreet Mode PIN. Stored as scrypt(salt, pin); never the PIN itself.
ALTER TABLE users ADD COLUMN pin_hash TEXT;
ALTER TABLE users ADD COLUMN pin_fails INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN pin_locked_until TIMESTAMPTZ;
-- A locked session is a signed-in session that must re-enter the PIN (shared phones). Enforced on the server, not just hidden in the UI.
ALTER TABLE sessions ADD COLUMN locked BOOLEAN NOT NULL DEFAULT FALSE;
