-- SSO support and first-login onboarding flag for the admins table
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS google_id     TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS google_email  TEXT,
  ADD COLUMN IF NOT EXISTS sso_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS first_login   BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_admins_google_id ON admins(google_id) WHERE google_id IS NOT NULL;
