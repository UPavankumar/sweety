-- Non-destructive hardening migration: safe to run repeatedly on a live database.
-- Mirrors the API validation rules at the database level so bad data can't
-- get in even through a bug or a manual query.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'readings_value_range') THEN
    ALTER TABLE readings ADD CONSTRAINT readings_value_range CHECK (value BETWEEN 40 AND 600);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'readings_slot_allowed') THEN
    ALTER TABLE readings ADD CONSTRAINT readings_slot_allowed
      CHECK (slot IN ('Morning (fasting)', 'After breakfast', 'After lunch', 'After dinner'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_lowercase') THEN
    ALTER TABLE users ADD CONSTRAINT users_email_lowercase CHECK (email = lower(email));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_name_not_blank') THEN
    ALTER TABLE users ADD CONSTRAINT users_name_not_blank CHECK (length(btrim(name)) > 0);
  END IF;
END $$;
