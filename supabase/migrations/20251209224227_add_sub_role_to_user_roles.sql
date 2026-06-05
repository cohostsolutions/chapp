DO $$ BEGIN
  ALTER TABLE user_roles ADD COLUMN sub_role TEXT;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;
