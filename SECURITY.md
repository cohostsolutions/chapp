# AlCor Nexus - Security Architecture

This document describes the security architecture of AlCor Nexus for developers and auditors.

## Table of Contents

1. [Authentication](#authentication)
2. [Authorization](#authorization)
3. [Row Level Security (RLS)](#row-level-security-rls)
4. [Edge Functions Security](#edge-functions-security)
5. [Secrets Management](#secrets-management)
6. [Audit Logging](#audit-logging)
7. [Input Validation](#input-validation)
8. [Public Endpoints](#public-endpoints)
9. [Security Best Practices](#security-best-practices)

---

## Authentication

### Overview

AlCor Nexus uses Supabase Auth for authentication with the following configuration:

- **Sign-up**: Disabled for public users. All users are created by Super Admins or Client Admins through the User Management system
- **Email Confirmation**: Auto-confirm is enabled for streamlined onboarding
- **Password Requirements**: Minimum 6 characters (enforced in edge functions)
- **Account Lockout**: 5 failed attempts triggers a 15-minute lockout

### Session Management

```typescript
// Sessions are managed via Supabase Auth
// Always use onAuthStateChange to listen for session changes
supabase.auth.onAuthStateChange((event, session) => {
  setSession(session);
  setUser(session?.user ?? null);
});
```

### Login Attempt Tracking

Failed login attempts are tracked in the `login_attempts` table with automatic cleanup of old records.

---

## Authorization

### Role Hierarchy

The platform implements a three-tier role hierarchy:

| Role | Description | Permissions |
|------|-------------|-------------|
| `super_admin` | Platform administrators | Full access to all organizations and features |
| `client_admin` | Organization administrators | Manage users and data within their organization |
| `agent` | Human agents | Access assigned leads and conversations |

### Role Storage

**CRITICAL**: Roles are stored in a separate `user_roles` table, NOT in the profiles table. This prevents privilege escalation attacks.

```sql
-- Role checking uses a SECURITY DEFINER function to prevent RLS recursion
CREATE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

### Organization Isolation

Data is isolated per organization using the `get_user_org()` function:

```sql
CREATE FUNCTION public.get_user_org(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id
$$;
```

---

## Row Level Security (RLS)

### Core Principle

All tables have RLS enabled. Access is controlled through policies that use:

1. `auth.uid()` - Current authenticated user's ID
2. `has_role()` - Check if user has specific role
3. `get_user_org()` - Get user's organization ID

### Policy Patterns

**Super Admin Access:**
```sql
CREATE POLICY "Super admins can view all"
ON public.some_table
FOR SELECT
USING (public.has_role(auth.uid(), 'super_admin'));
```

**Organization-Scoped Access:**
```sql
CREATE POLICY "Org users can view their org data"
ON public.some_table
FOR SELECT
USING (organization_id = public.get_user_org(auth.uid()));
```

**Agent Assignment Access:**
```sql
CREATE POLICY "Agents view assigned leads"
ON public.leads
FOR SELECT
USING (
  public.has_role(auth.uid(), 'agent') 
  AND assigned_agent_id = auth.uid()
);
```

### Tables with RLS

All 21+ tables in the public schema have RLS enabled, including:
- `profiles`, `user_roles`, `organizations`
- `leads`, `ai_conversations`, `ai_messages`
- `bookings`, `orders`, `room_units`, `offerings`
- `knowledge_base_entries`, `knowledge_base_documents`
- `social_platforms`, `audit_logs`

---

## Edge Functions Security

### Authentication Verification

Protected edge functions verify JWT tokens:

```typescript
// Extract and verify user from JWT
const authHeader = req.headers.get('Authorization');
const token = authHeader?.replace('Bearer ', '');

const { data: { user }, error } = await supabaseClient.auth.getUser(token);
if (error || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}
```

### Authorization in Edge Functions

After authentication, edge functions verify roles:

```typescript
// Check user roles from database
const { data: roles } = await supabaseClient
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id);

const isSuperAdmin = roles?.some(r => r.role === 'super_admin');
const isClientAdmin = roles?.some(r => r.role === 'client_admin');

if (!isSuperAdmin && !isClientAdmin) {
  return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
}
```

### CORS Configuration

All edge functions include proper CORS headers:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle preflight
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

---

## Secrets Management

### Server-Side Secrets

Secrets are stored in Supabase Edge Function secrets and accessed via `Deno.env.get()`:

| Secret | Purpose | Rotation Interval |
|--------|---------|-------------------|
| `TWILIO_AUTH_TOKEN` | SMS/Voice API | 90 days |
| `META_APP_SECRET` | Facebook/WhatsApp/Instagram webhooks | 90 days |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google Calendar integration | 180 days |
| `RESEND_API_KEY` | Email delivery | 90 days |
| `JAY_AI_WEBHOOK_SECRET` | AI service authentication | 90 days |

### Secret Rotation Tracking

The `secret_rotation_tracking` table tracks when secrets were last rotated and alerts when rotation is due.

### Client-Side Variables

Only publishable keys are exposed to the client:

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbG...
VITE_SUPABASE_PROJECT_ID=xxx
```

---

## Audit Logging

### What's Logged

Sensitive operations are logged to the `audit_logs` table:

- User creation, updates, and deactivation
- Password resets
- Role changes
- Organization modifications

### Log Structure

```typescript
interface AuditLog {
  id: string;
  user_id: string;      // Who performed the action
  action: string;       // e.g., 'user_created', 'password_reset'
  resource_type: string; // e.g., 'user', 'organization'
  resource_id: string;  // ID of affected resource
  details: object;      // Additional context (sanitized)
  ip_address: string;
  user_agent: string;
  created_at: string;
}
```

### Access Control

Only Super Admins can view audit logs through the Settings page.

---

## Input Validation

### Server-Side Validation

All edge functions use Zod for input validation:

```typescript
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const createUserSchema = z.object({
  email: z.string().email().max(255),
  full_name: z.string().min(1).max(100),
  role: z.enum(['super_admin', 'client_admin', 'agent']),
  organization_id: z.string().uuid().optional(),
});
```

### Client-Side Validation

Forms use react-hook-form with Zod resolvers for consistent validation.

---

## Public Endpoints

Two edge functions are intentionally public (`verify_jwt = false`):

### book-demo

- **Purpose**: Allow anonymous users to submit demo requests
- **Security Controls**:
  - Rate limiting: 10 requests per IP per hour
  - Input validation with Zod
  - Service role only for database insert

### social-webhook

- **Purpose**: Receive webhooks from Meta (Facebook, WhatsApp, Instagram)
- **Security Controls**:
  - HMAC signature verification using `META_APP_SECRET`
  - Message deduplication to prevent replay attacks
  - Rate limiting: 20 messages per sender per minute
  - Fail-closed: rejects if secret not configured

---

## Security Best Practices

### Do's

✅ Always use `has_role()` function for role checks  
✅ Use `get_user_org()` for organization scoping  
✅ Validate all inputs with Zod on server-side  
✅ Log sensitive operations to audit_logs  
✅ Use service role only when necessary  
✅ Set `search_path = public` on SECURITY DEFINER functions  

### Don'ts

❌ Never store roles in profiles or users table  
❌ Never trust client-side role storage (localStorage)  
❌ Never expose service role key to client  
❌ Never log sensitive data (passwords, tokens)  
❌ Never execute raw SQL in edge functions  
❌ Never use `dangerouslySetInnerHTML` with user content  

### Code Review Checklist

- [ ] All new tables have RLS enabled
- [ ] RLS policies use `auth.uid()`, not request body
- [ ] Edge functions validate JWT before processing
- [ ] Sensitive operations are logged
- [ ] Input is validated server-side
- [ ] No secrets exposed in client code
- [ ] CORS headers properly configured

---

## Incident Response

If a security incident is detected:

1. Check `audit_logs` for suspicious activity
2. Review `login_attempts` for brute force patterns
3. Rotate affected secrets immediately
4. Update `secret_rotation_tracking` after rotation
5. Document incident and remediation steps

---

## Known Security Issues

### ✅ FIXED: SECURITY DEFINER Functions Missing search_path

**Issue**: 5 functions had `SECURITY DEFINER` without explicit `search_path` (privilege escalation risk).

**Status**: ✅ **FIXED** - Migration applied

**Vulnerable Functions (Now Fixed)**:
1. `check_alert_thresholds()` - Alert system
2. `send_alert_notifications()` - Alert system
3. `auto_checkout_from_chat()` - Booking automation
4. `run_booking_status_updates()` - Booking automation
5. `training_stats()` - Training module

**Risk**: Schema shadowing could allow attackers to hijack function behavior.

**Fix Applied**: [supabase/migrations/20260121100002_fix_security_definer_search_path.sql](supabase/migrations/20260121100002_fix_security_definer_search_path.sql)

All functions now have: `SET search_path = public, pg_catalog`

---

### message_template_assignments Table - ORPHANED & UNSECURED

**Issue**: Orphaned table exists with NO RLS policies (security vulnerability).

**Status**: 🚨 **ACTION REQUIRED**

**Details**:
- Table exists in database but has NO code usage
- RLS is **DISABLED** - anyone with DB access can read/write
- No migration file (created manually/outside version control)
- Foreign keys to `message_templates` and `auth.users`

**Current Access Model**: NONE (no RLS = unrestricted access)

**Security Risk**: 🟡 MEDIUM
- Low immediate risk (no code using it)
- High risk if code is added without RLS

**Resolution**: Drop the orphaned table (migration ready)

**Action Required**:
```bash
# Apply migration to drop table
supabase db push

# Migration: supabase/migrations/20260121000000_drop_message_template_assignments.sql
```

**Full Investigation**: See [MESSAGE_TEMPLATE_ASSIGNMENTS_FALSE_POSITIVE.md](MESSAGE_TEMPLATE_ASSIGNMENTS_FALSE_POSITIVE.md)

---

## Contact

For security concerns, contact the Super Admin at acornilla@alcornexus.com
