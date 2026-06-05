-- Add Twilio OAuth columns to organizations table
alter table organizations
  add column if not exists twilio_oauth_token text,
  add column if not exists twilio_oauth_refresh_token text,
  add column if not exists twilio_oauth_expires_at timestamptz;

-- Add comment explaining encryption
comment on column organizations.twilio_oauth_token is 'Encrypted Twilio OAuth access token (prefix: vault:)';
comment on column organizations.twilio_oauth_refresh_token is 'Encrypted Twilio OAuth refresh token (prefix: vault:)';
comment on column organizations.twilio_oauth_expires_at is 'Timestamp when OAuth token expires';
