-- Time of day and trigger are extracted, then confirmed (or corrected) by her. Never free text.
ALTER TABLE logs ADD COLUMN time_of_day TEXT NOT NULL DEFAULT 'unspecified' CHECK (time_of_day IN ('morning','afternoon','evening','night','unspecified'));
ALTER TABLE logs ADD COLUMN trigger TEXT NOT NULL DEFAULT 'unspecified' CHECK (trigger IN ('stress','heat','food','sleep','family','work','none','unspecified'));
