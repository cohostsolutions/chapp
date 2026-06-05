# CRITICAL: Vault Encryption Key Missing

## Issue Detected
The `social-webhook` function logs show:
```
"[Vault] VAULT_ENCRYPTION_KEY not configured - encryption disabled"
```

## Impact
- Webhook IS receiving Facebook messages ✅
- BUT tokens can't be decrypted ❌
- AI won't be able to respond until this is fixed ❌

## Root Cause
The `VAULT_ENCRYPTION_KEY` secret is not configured in Supabase. This secret is required to decrypt access tokens stored in the `facebook_pages` table.

## Solution

### Step 1: Generate a Secure Encryption Key
Run this command to generate a secure 32-byte key:
```bash
openssl rand -hex 32
```

### Step 2: Set the Secret in Supabase
```bash
supabase secrets set VAULT_ENCRYPTION_KEY="<your-generated-key-from-step-1>"
```

### Step 3: Redeploy the Functions (to pick up the new secret)
```bash
supabase functions deploy social-webhook
supabase functions deploy subscribe-facebook-webhook
supabase functions deploy subscribe-facebook-webhooks-bulk
```

### Step 4: Test
Send a test message to one of your Facebook pages and verify the AI responds.

## Important Notes

1. **Save the encryption key securely** - you'll need it if you ever migrate databases or restore from backup
2. **Existing tokens**: If tokens are already encrypted in the database with a different key, you'll need to:
   - Either use the original key
   - Or re-encrypt tokens with the new key
   - Or reconnect the pages to generate new tokens

3. **Check if tokens are already encrypted**:
   ```sql
   SELECT page_id, page_name, 
          LEFT(access_token, 20) as token_preview
   FROM facebook_pages 
   WHERE is_enabled = true;
   ```
   - If tokens look like random characters/base64, they're encrypted
   - If they start with "EAA", they're plaintext Facebook tokens

## Current Secrets (from supabase secrets list)
✅ FACEBOOK_APP_ID
✅ FACEBOOK_APP_SECRET  
✅ META_APP_ID
✅ META_APP_SECRET
✅ META_VERIFY_TOKEN
✅ SUPABASE_ANON_KEY
✅ SUPABASE_SERVICE_ROLE_KEY
✅ SUPABASE_URL
❌ **VAULT_ENCRYPTION_KEY** ← MISSING

## Quick Fix Command
```bash
# Generate key and set it in one go
supabase secrets set VAULT_ENCRYPTION_KEY="$(openssl rand -hex 32)"

# Then redeploy
supabase functions deploy social-webhook
supabase functions deploy subscribe-facebook-webhook  
supabase functions deploy subscribe-facebook-webhooks-bulk
```

## Verification
After setting the key and redeploying, check the logs again:
```bash
supabase functions logs social-webhook
```

You should NO LONGER see the warning about VAULT_ENCRYPTION_KEY.
