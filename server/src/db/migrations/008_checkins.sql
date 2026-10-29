-- A one-tap mood check-in ("how are you really feeling today?"). One per India calendar day; a calm day still counts as a check-in.
CREATE TABLE checkins (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     DATE NOT NULL,
  mood    TEXT NOT NULL CHECK (mood IN ('calm','hot','tired','anxious','low','okay')),
  PRIMARY KEY (user_id, day)
);
