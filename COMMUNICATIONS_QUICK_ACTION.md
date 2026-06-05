# Communications Data Isolation - Quick Action Guide

## Immediate Steps to Investigate

### 1. Check the Browser Console
When you're on the Communications page, open the browser developer tools (F12) and look for:

**Expected logs:**
```
👤 User: [Username] ([User ID])
🏢 Organization ID: [Organization ID]
📊 Fetching conversations for organization: [Organization ID]
```

**Warning signs:**
```
⚠️ WARNING: User has no organization_id assigned
🚨 DATA ISOLATION ERROR: Communication [...] has organization_id [...]
CRITICAL: Cross-organization data detected
```

### 2. Verify Your User Profile
You mentioned you're logged in as "Test user 01" with "Client Admin" role.

**To check your organization assignment:**
1. Go to Settings → User Management
2. Find your user profile
3. Verify which organization you're assigned to

### 3. Run Database Diagnostic
I've created a diagnostic SQL script at: `/workspaces/canvascapital/scripts/diagnose-communications-isolation.sql`

To run it:
```bash
# Copy the script content and run in Supabase SQL Editor
# OR if you have psql access:
psql "$DATABASE_URL" -f scripts/diagnose-communications-isolation.sql
```

This will show:
- All organizations in the system
- Test users and their organization assignments
- Any cross-contaminated communications
- Data distribution per organization
- RLS policy status

### 4. Understand What You're Seeing

When you say "leads under the test organization page":
- Are these leads that belong to OTHER organizations but showing up in your view?
- Or are these test leads that were created but shouldn't exist?

**To identify the issue:**
1. Click on one of the "shouldn't be here" leads
2. Note their name/phone/email
3. Check in the database which organization they actually belong to

### 5. Check for Super Admin Impersonation

If you're a Super Admin user who is impersonating a Client Admin:
- The system should show only the impersonated organization's data
- However, there might be a bug if impersonation isn't working correctly

**To check:**
1. In your user profile/settings, verify your role
2. Check if you're in "View As" mode (impersonating)
3. Try logging out and back in as the actual Client Admin user

## Common Scenarios and Solutions

### Scenario A: Wrong Organization Assignment
**Symptom:** You see data from Organization X but you should only see Organization Y

**Solution:**
```sql
-- Update your user profile to correct organization
UPDATE profiles
SET organization_id = '[correct-org-id]'
WHERE id = '[your-user-id]';
```

### Scenario B: Data Was Imported Incorrectly
**Symptom:** Multiple leads/communications with wrong organization_id

**Solution:**
Run the fix script: `/workspaces/canvascapital/scripts/fix-communications-isolation.sql`
(But run the diagnostic first!)

### Scenario C: RLS Policies Not Working
**Symptom:** You can see ALL organizations' data regardless of your assignment

**Solution:**
```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('communications', 'leads');

-- Should show rowsecurity = t for both
```

### Scenario D: Multiple Test Organizations
**Symptom:** There are multiple "test" organizations and data is mixed between them

**Solution:**
1. Identify which test org should be kept
2. Consolidate data to one test org
3. Delete duplicate test organizations

## Frontend Safeguards Added

I've added defensive checks in the code that will:

1. **Log warnings** when organization_id is missing
2. **Detect and skip** any cross-organization data
3. **Alert in console** if data integrity issues are found

These checks will help identify the exact source of the problem.

## Next Steps

1. **Check browser console NOW** - Look for any error messages
2. **Note which leads** you're seeing that shouldn't be there
3. **Run the diagnostic script** to see the database state
4. **Report back** with:
   - Your user email/ID
   - Your assigned organization
   - Examples of leads you're seeing that shouldn't be there
   - Any error messages from console

## Emergency Data Isolation Check

If you're concerned about data security RIGHT NOW:

```sql
-- Quick check: Count communications per organization
SELECT 
  o.name,
  COUNT(c.id) as communication_count
FROM organizations o
LEFT JOIN communications c ON c.organization_id = o.id
GROUP BY o.id, o.name
ORDER BY o.name;

-- Quick check: Verify YOUR user assignment
SELECT 
  p.email,
  p.full_name,
  o.name as organization
FROM profiles p
JOIN organizations o ON p.organization_id = o.id
WHERE p.email = '[your-email]';
```

## Support Information

**Files Created:**
- `/workspaces/canvascapital/COMMUNICATIONS_ISOLATION_INVESTIGATION.md` - Full investigation guide
- `/workspaces/canvascapital/scripts/diagnose-communications-isolation.sql` - Diagnostic queries
- `/workspaces/canvascapital/scripts/fix-communications-isolation.sql` - Fix script (use with caution)

**Code Changes:**
- `/workspaces/canvascapital/src/hooks/useChatConversations.ts` - Added data integrity checks
- `/workspaces/canvascapital/src/pages/ChatLogs.tsx` - Added organization logging

The system now has built-in warnings that will alert you if there's any cross-organization data leakage.
