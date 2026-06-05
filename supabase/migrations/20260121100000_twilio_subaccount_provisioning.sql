-- Twilio Subaccount Manual Provisioning (On-Demand)
-- No longer auto-triggers on org creation
-- Super admins explicitly enable and trigger via Settings UI

-- Drop auto-trigger if it exists (replaced by manual opt-in flow)
DROP TRIGGER IF EXISTS on_organization_created_provision_twilio ON public.organizations;
DROP FUNCTION IF EXISTS trigger_provision_twilio_subaccount() CASCADE;

-- Manual provisioning is now called via edge function when:
-- 1. Super admin enables Twilio feature (twilio_enabled = true)
-- 2. Super admin clicks "Connect Twilio Account"
-- 3. OAuth callback stores token
-- 4. Provision function is called on-demand (not via trigger)
