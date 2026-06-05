# Communications Data Isolation Investigation

## Issue Report
**Date:** January 19, 2026  
**Reporter:** Client observing test organization page  
**Concern:** Seeing leads from different organizations in communications page

## Problem Statement
The user is concerned that:
1. They're seeing leads under the test organization page that shouldn't be there
2. Organizations might be getting messages from different organizations (data isolation breach)

## System Architecture Review

### Data Flow
```
User Login → Profile → organization_id → RLS Policies → Filtered Data
```

### RLS Policies (communications table)
The system uses several RLS policies on the `communications` table:

1. **Super Admins (not impersonating)**
   ```sql
   organization_id = get_user_org(auth.uid())
   ```

2. **Client Admins**
   ```sql
   organization_id = get_user_org(auth.uid())
   ```

3. **Agents**
   ```sql
   organization_id = get_user_org(auth.uid())
   AND (org_uses_shared_access(organization_id) OR lead_id IS NULL OR is_assigned_to_lead(auth.uid(), lead_id))
   ```

### Data Fetching (useChatConversations.ts)
```typescript
const { data: page, error: commError } = await supabase
  .from('communications')
  .select('id, lead_id, organization_id, channel, direction, role, content, subject, status, external_id, metadata, created_at, updated_at, user_id')
  .eq('organization_id', organizationId)  // ✅ Explicit filter
  .order('created_at', { ascending: false })
  .range(from, from + pageSize - 1);
```

### Authentication Context
```typescript
const organizationId = profile?.organization_id;
const { conversations, isLoading, refetch } = useChatConversations(organizationId);
```

## Potential Root Causes

### 1. **User Profile Issue**
- The test user's `organization_id` in the `profiles` table might be incorrect
- The user might have been assigned to the wrong organization

### 2. **Lead Data Issue**
- Leads in the database might have incorrect `organization_id` values
- Lead data might have been imported/created with wrong organization associations

### 3. **Communications Data Issue**  
- Communications records might have incorrect `organization_id` values
- Historical data migration might have caused cross-contamination

### 4. **RLS Policy Not Applied**
- The RLS policies might not be properly enforced
- Service role might be used somewhere bypassing RLS

### 5. **Frontend Filtering Issue**
- The `organizationId` parameter might be null/undefined
- The hook might be fetching without proper organization filtering

## Investigation Steps

### Step 1: Verify Test User's Profile
```sql
-- Check the test user's organization assignment
SELECT id, email, full_name, organization_id, created_at
FROM profiles
WHERE email = 'test@example.com' OR full_name LIKE '%Test%';

-- Check what organization they should belong to
SELECT o.id, o.name, o.slug
FROM organizations o
JOIN profiles p ON p.organization_id = o.id
WHERE p.email = 'test@example.com';
```

### Step 2: Verify Communications Data
```sql
-- Check for communications with mismatched organization_ids
SELECT 
  c.id,
  c.organization_id as comm_org_id,
  c.lead_id,
  l.organization_id as lead_org_id,
  l.name as lead_name,
  o1.name as comm_org_name,
  o2.name as lead_org_name,
  CASE WHEN c.organization_id != l.organization_id THEN 'MISMATCH' ELSE 'OK' END as status
FROM communications c
LEFT JOIN leads l ON c.lead_id = l.id
LEFT JOIN organizations o1 ON c.organization_id = o1.id
LEFT JOIN organizations o2 ON l.organization_id = o2.id
WHERE c.organization_id != l.organization_id;
```

### Step 3: Verify Lead Data
```sql
-- Check all leads and their organization associations
SELECT 
  l.id,
  l.name,
  l.phone,
  l.email,
  l.organization_id,
  o.name as org_name
FROM leads l
JOIN organizations o ON l.organization_id = o.id
ORDER BY o.name, l.name;
```

### Step 4: Check RLS Policy Enforcement
```sql
-- Verify RLS is enabled on communications table
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'communications';
-- Expected: rowsecurity = t (true)

-- List all RLS policies on communications
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'communications'
ORDER BY policyname;
```

### Step 5: Test Query with Specific Organization
```sql
-- Test what a specific organization user should see
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "<user-id>"}';

SELECT 
  c.id,
  c.lead_id,
  c.organization_id,
  c.content,
  l.name as lead_name
FROM communications c
LEFT JOIN leads l ON c.lead_id = l.id
WHERE c.organization_id = '<test-org-id>'
ORDER BY c.created_at DESC
LIMIT 10;
```

## Immediate Actions Required

1. **Verify User Identity**
   - Which organization is the test user assigned to?
   - What role does the test user have?

2. **Data Integrity Check**
   - Run the mismatch query to find any cross-contaminated records
   - Identify which communications have incorrect organization_id

3. **Code Audit**
   - Verify that `organizationId` is never null when calling `useChatConversations`
   - Check if any edge functions use service role inappropriately

4. **Frontend Verification**
   - Add console logs to verify what `organizationId` is being used
   - Check browser developer tools for the actual API calls being made

## Recommendations

### Short-term Fix
1. Add defensive checks in the frontend:
   ```typescript
   if (!organizationId) {
     console.error('No organization ID - cannot fetch conversations');
     return [];
   }
   ```

2. Add validation in the query function:
   ```typescript
   if (!organizationId) {
     throw new Error('Organization ID required for fetching conversations');
   }
   ```

### Medium-term Fix
1. Run data integrity scripts to fix any mismatched records
2. Add database constraints to prevent future mismatches
3. Add audit logging for organization changes

### Long-term Fix
1. Implement comprehensive testing for RLS policies
2. Add organization-switching audit trails
3. Create data integrity monitoring dashboards
4. Add automated alerts for cross-org data leaks

## Testing Checklist

- [ ] Verify test user's organization_id in profiles table
- [ ] Check for communications with mismatched organization_ids
- [ ] Verify RLS policies are enabled and correct
- [ ] Test with different user roles (super_admin, client_admin, agent)
- [ ] Verify impersonation doesn't cause data leakage
- [ ] Check for null/undefined organizationId in frontend
- [ ] Validate all leads have correct organization_id
- [ ] Test edge cases (archived orgs, deleted users, etc.)

## Status
**INVESTIGATION IN PROGRESS**

Next step: Need to query the database to verify the actual data and user configuration.
