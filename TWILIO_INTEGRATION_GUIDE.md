# Twilio Multi-Tenant Integration - Deployment Guide

## Overview

This implementation provides a complete multi-tenant Twilio integration with:
- **Automatic Subaccount Provisioning**: Creates Twilio subaccounts for each organization
- **Quota Enforcement**: 1 free phone number per organization
- **Phone Number Management**: Search, claim, and manage Twilio numbers
- **Inbound SMS Handling**: Receive SMS messages and save to communications
- **Security**: Tenant isolation, signature verification, encrypted credential storage

## Architecture

```
Organizations
  ├─ twilio_subaccount_sid (encrypted)
  └─ twilio_auth_token (encrypted)
         ↓
    Phone Numbers (linked to org)
         ↓
    Communications (inbound/outbound SMS)
```

## Deployment Steps

### 1. Ensure Environment Variables Are Set

You need these Twilio credentials in your Supabase secrets:

```
TWILIO_ACCOUNT_SID=AC...         # Your main Twilio account SID
TWILIO_AUTH_TOKEN=auth_token...  # Your main Twilio auth token
TWILIO_PHONE_NUMBER=+1234567890  # (Optional) Default outbound number
VAULT_ENCRYPTION_KEY=...         # For encrypting stored credentials
```

### 2. Apply the Migration

```bash
supabase db push
```

This creates:
- `phone_numbers` table for tracking purchased numbers
- Twilio credential columns on `organizations`
- Trigger to auto-provision subaccounts on org creation

### 3. Deploy Edge Functions

```bash
# Provision function (called by trigger automatically)
supabase functions deploy provision-twilio-subaccount

# SMS search function
supabase functions deploy search-available-numbers

# Phone number purchase function (enforces quota)
supabase functions deploy buy-phone-number

# Inbound SMS webhook handler
supabase functions deploy twilio-sms-webhook
```

### 4. Configure Twilio Webhooks

For each phone number purchased, configure the SMS webhook:

1. Go to Twilio Console → Phone Numbers → Your Number
2. Under "Messaging", set "A message comes in" webhook to:
   ```
   https://<project-id>.supabase.co/functions/v1/twilio-sms-webhook
   ```
3. HTTP method: **POST**
4. Enable "Use my Twilio credentials"

**Note**: The webhook signature will be verified using `TWILIO_AUTH_TOKEN`

## Flow Diagrams

### New Organization Creation

```
Create Organization
        ↓
[Database Trigger]
        ↓
provision-twilio-subaccount (async)
        ↓
Create Twilio Subaccount via API
        ↓
Store encrypted SID + AuthToken
        ↓
Organization ready to purchase numbers
```

### Phone Number Purchase

```
User clicks "Claim Free"
        ↓
search-available-numbers
  ├─ Query Twilio for available numbers
  ├─ Check org quota (must have 0 numbers)
  └─ Return list with FREE label
        ↓
User selects number
        ↓
buy-phone-number
  ├─ Verify quota (403 if count >= 1)
  ├─ Call Twilio IncomingPhoneNumbers.create
  ├─ Configure voice_url + sms_url webhooks
  └─ Save to phone_numbers table
        ↓
Number successfully claimed!
```

### Inbound SMS

```
Customer sends SMS to number
        ↓
Twilio calls webhook
        ↓
twilio-sms-webhook
  ├─ Verify signature (HMAC-SHA1)
  ├─ Find organization by phone number
  ├─ Find lead by sender's phone
  ├─ Save to communications table
  └─ Return 200 OK
        ↓
Message appears in lead's chat
```

## Database Schema

### phone_numbers Table

```sql
CREATE TABLE public.phone_numbers (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,  -- Multi-tenant isolation
  twilio_sid TEXT,                -- Twilio IncomingPhoneNumber SID
  phone_number TEXT NOT NULL,     -- E.g. +14155552671
  country_code TEXT,              -- E.g. US
  area_code TEXT,                 -- E.g. 415
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### organizations Table (New Columns)

```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS
  twilio_subaccount_sid text;    -- Encrypted via vault

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS
  twilio_auth_token text;        -- Encrypted via vault
```

## API Endpoints

### Search Available Numbers

**POST** `/functions/v1/search-available-numbers`

```json
{
  "country_code": "US",
  "area_code": "415",
  "type": "local"  // "local" | "mobile" | "tollfree"
}
```

Response (org with 0 numbers):
```json
{
  "numbers": [
    {
      "phone_number": "+14155552671",
      "friendly_name": "San Francisco, CA",
      "locality": "San Francisco",
      "region": "CA",
      "area_code": "415",
      "price_display": "$0.00",
      "free_eligible": true
    }
  ],
  "free_eligible": true
}
```

### Buy Phone Number

**POST** `/functions/v1/buy-phone-number`

```json
{
  "phoneNumber": "+14155552671"
}
```

Response (success):
```json
{
  "success": true,
  "number": {
    "id": "uuid",
    "organization_id": "uuid",
    "phone_number": "+14155552671",
    "twilio_sid": "PNxxx...",
    "is_active": true
  }
}
```

Response (quota exceeded):
```json
{
  "error": "Free limit reached. Please contact support to add additional lines."
}
```
Status: 403

### Provision Subaccount (Manual)

**POST** `/functions/v1/provision-twilio-subaccount`

```json
{
  "organization_id": "org-uuid"
}
```

(Normally called automatically, but can be triggered manually for super admins)

## Frontend Integration

The Phone Manager UI in Settings automatically:
- Fetches phone count for the organization
- Shows "Claim Your Free Number" when count = 0
- Disables search/buy when count >= 1
- Displays purchased numbers with status

See [src/pages/Settings.tsx](src/pages/Settings.tsx) for the implementation.

## Security Considerations

1. **Credential Encryption**: Twilio tokens are encrypted at-rest using `VAULT_ENCRYPTION_KEY`
2. **Tenant Isolation**: All queries filtered by `organization_id`
3. **Quota Enforcement**: Server-side check prevents bypassing limits
4. **Webhook Signature Verification**: All Twilio webhooks validated with HMAC-SHA1
5. **Authentication**: Edge functions verify JWT and organization membership
6. **Rate Limiting**: Consider adding rate limits to phone number searches

## Troubleshooting

### "Twilio subaccount not provisioned"
- Check that org has `twilio_subaccount_sid` populated
- If missing, manually call `provision-twilio-subaccount` endpoint
- Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are configured

### "Free limit reached" appears when user should have 0 numbers
- Check `phone_numbers` table for stray records
- Verify `is_active` flag is correct (should be `true` for active numbers)

### SMS not being received
- Verify Twilio webhook URL is correct and accessible
- Check webhook is configured in Twilio Console for the phone number
- Verify `TWILIO_AUTH_TOKEN` is set for signature verification
- Check Supabase logs for errors

### Numbers showing as not found after purchase
- Query `phone_numbers` table: `SELECT * FROM phone_numbers WHERE organization_id = 'org_id'`
- Verify phone_number format matches Twilio response

## Optional Enhancements

1. **Auto-Respond to SMS**
   - Trigger AI chat function when SMS is received
   - Modify `twilio-sms-webhook` to call `ai-chat` after saving

2. **Webhook Retry Logic**
   - Add exponential backoff for failed Twilio requests
   - Store failed attempts in a `webhook_logs` table

3. **SMS Thread History**
   - Query `communications` table with `lead_id` to show full conversation

4. **Number Retirement**
   - Add endpoint to deactivate numbers (set `is_active = false`)
   - Release numbers back to Twilio

## Support

For issues:
1. Check Supabase function logs: Dashboard → Edge Functions
2. Verify Twilio API credentials and account status
3. Check RLS policies allow queries (use service_role in functions)
4. Verify migration has run: `supabase migration list`
