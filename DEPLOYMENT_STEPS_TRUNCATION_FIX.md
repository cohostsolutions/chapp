# Deployment Instructions for Message Truncation Fix

## Quick Deployment

Run these commands in the terminal (from `/workspaces/canvascapital` directory):

```bash
# Deploy the updated social-webhook function
supabase functions deploy social-webhook --no-verify-jwt

# Verify deployment
supabase functions describe social-webhook
```

## What Changed

### 1. Increased AI Response Token Limit
**File**: `supabase/functions/social-webhook/index.ts` (line 3808)
- Changed `maxOutputTokens: 500` → `maxOutputTokens: 2000`
- Allows Gemini to generate longer, more complete responses

### 2. Fixed Message Truncation Logic
**File**: `supabase/functions/_shared/burst-messaging.ts` (lines 238-260)
- Rewrote `validateBurstLength()` to actually truncate long messages
- Now truncates at word boundaries (prevents mid-word cuts)
- Changed limit from 1000 to 2000 characters (Facebook/Instagram API limit)

## Testing After Deployment

1. **Send a test message** to one of the connected Facebook pages
2. **Check the response** - should be complete, not cut off mid-word
3. **Verify in database** - query communications table to see full message:
   ```sql
   SELECT content, LENGTH(content) as char_count 
   FROM communications 
   WHERE direction = 'outbound' 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

## Rollback (if needed)

If you need to revert:
```bash
git checkout supabase/functions/social-webhook/index.ts
git checkout supabase/functions/_shared/burst-messaging.ts
supabase functions deploy social-webhook --no-verify-jwt
```

## Expected Results

**Before Fix**: 
- Messages cut off mid-word
- Example: "That's a great question, and it gives me a chance to clarify!\n\nI don"

**After Fix**:
- Complete messages without truncation
- Example: "That's a great question, and it gives me a chance to clarify!\n\nI'd be happy to explain more about our services..."

## Files Modified

1. ✅ `/supabase/functions/social-webhook/index.ts`
   - Line 3808: `maxOutputTokens: 500` → `2000`

2. ✅ `/supabase/functions/_shared/burst-messaging.ts`
   - Lines 238-260: Complete rewrite of message validation logic
   - Now properly truncates long messages at word boundaries

## Notes

- The burst-messaging.ts file is a shared helper used by social-webhook
- Changes are backward compatible - single message responses still work
- No database schema changes needed
- No configuration updates needed
