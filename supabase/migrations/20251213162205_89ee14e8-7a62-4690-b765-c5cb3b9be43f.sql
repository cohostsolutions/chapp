-- Add 2FA columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS totp_secret TEXT,
ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS totp_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS backup_codes TEXT[];

-- Create index for 2FA queries
CREATE INDEX IF NOT EXISTS idx_profiles_totp_enabled ON public.profiles(totp_enabled) WHERE totp_enabled = TRUE;

COMMENT ON COLUMN public.profiles.totp_secret IS 'Encrypted TOTP secret for 2FA (vault encrypted)';
COMMENT ON COLUMN public.profiles.totp_enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN public.profiles.totp_verified_at IS 'When 2FA was last verified';
COMMENT ON COLUMN public.profiles.backup_codes IS 'Encrypted backup codes for 2FA recovery';