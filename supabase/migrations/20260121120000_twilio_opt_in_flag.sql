-- Add twilio_enabled flag to organizations
-- Defaults to false; super admins must explicitly enable per org
alter table organizations
  add column if not exists twilio_enabled boolean default false;

comment on column organizations.twilio_enabled is 'Whether Twilio phone number management is enabled for this organization';
