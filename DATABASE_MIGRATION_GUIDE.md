# Database Migration Guide - Complete

**Target:** Supabase Project `domipubyjkhsrmdwtabh`  
**Date:** January 19, 2026

---

## Quick Check

Run this to see your migration status:

```bash
chmod +x scripts/verify-database-migrations.sh
./scripts/verify-database-migrations.sh
```

Or manually:

```bash
supabase migration list
```

---

## Quick Migration (If Needed)

If you have pending migrations:

```bash
# Apply all pending migrations
supabase db push
```

---

## What We Have

### Local Migration Files
- **177 migration files** in `supabase/migrations/`
- These define all your database tables, functions, triggers, RLS policies, etc.

### Expected Tables (Major ones)
Based on migration analysis, your database should have these tables:

**Core Business** (10 tables):
- `organizations`
- `profiles`
- `user_roles`
- `leads`
- `conversations` (or `chat_messages`)
- `communications`
- `offerings`
- `bookings`
- `room_units`
- `orders`

**AI & Social** (13 tables):
- `ai_conversations`
- `ai_messages`
- `social_platforms`
- `facebook_pages`
- `knowledge_base_entries`
- `knowledge_base_documents`
- `knowledge_base_performance`
- `knowledge_base_versions`
- `ai_performance_metrics`
- `ai_analytics_snapshots`
- `ai_alert_rules`
- `ai_alert_history`
- `webhook_processed_messages`

**Lead Management** (8 tables):
- `lead_scoring_config`
- `lead_scores`
- `lead_predictions`
- `lead_engagement_profiles`
- `lead_qualification_scores`
- `lead_offerings`
- `qualification_events`
- `demo_requests`

**Communication & Engagement** (10 tables):
- `message_templates`
- `message_buffer`
- `message_reactions`
- `re_engagement_campaigns`
- `re_engagement_templates`
- `handoff_events`
- `notification_history`
- `notification_preferences`
- `edge_function_logs`
- `conversation_metadata`

**Calendar & Scheduling** (4 tables):
- `calendar_events`
- `calendar_sync_events`
- `google_calendar_tokens`
- `maintenance_blocks`

**Documents & Workflows** (8 tables):
- `documents`
- `document_folders`
- `document_versions`
- `document_signatures`
- `workflows`
- `workflow_executions`
- `workflow_runs`

**Training System** (3 tables):
- `training_modules`
- `training_sessions`
- `rubric_templates`

**Portal & Support** (6 tables):
- `portal_access`
- `support_tickets`
- `ticket_messages`
- `helpdesk_tickets`
- `team_chats`
- `team_chat_messages`
- `team_chat_members`
- `team_chat_reactions`

**Financial** (5 tables):
- `currencies`
- `organization_currencies`
- `operational_expenses`
- `inventory_items`

**Accommodation/Booking** (8 tables):
- `properties`
- `filter_presets`
- `booking_templates`
- `booking_note_history`

**Security & Compliance** (12 tables):
- `audit_logs`
- `security_audit_logs`
- `user_sessions`
- `two_factor_auth`
- `secret_rotation_tracking`
- `login_attempts`
- `ip_blocklist`
- `data_export_requests`
- `data_deletion_requests`
- `consent_logs`
- `user_role_audit`

**Analytics & Reporting** (8 tables):
- `reports`
- `report_schedules`
- `analytics_events`
- `analytics_snapshots`
- `performance_metrics`
- `dashboard_layouts`
- `dashboards`
- `dashboard_widgets`

**Alerts & Monitoring** (7 tables):
- `alert_rules`
- `alert_notifications`
- `alert_history`
- `email_queue`
- `health_check_thresholds`
- `health_check_history`
- `webhook_health`

**Permissions & Teams** (7 tables):
- `permission_sets`
- `user_permissions`
- `user_permission_sets`
- `teams`
- `team_members`

**Misc** (6 tables):
- `rate_limits`
- `agent_priorities`
- `onboarding_progress`
- `migration_logs`
- `token_refresh_logs`

**Total: ~140+ tables**

---

## Verification Steps

### 1. Check Migration Status

```bash
supabase migration list
```

This shows:
- ✓ Applied migrations (green)
- ⏳ Pending migrations (yellow)

### 2. Check Tables in Supabase

Go to: https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh/editor

Count the tables in the `public` schema.

### 3. Compare Counts

```bash
# Count local migrations
find supabase/migrations -name "*.sql" -type f | wc -l

# Count CREATE TABLE statements
grep -r "CREATE TABLE" supabase/migrations/*.sql | wc -l
```

---

## If Tables Are Missing

### Option 1: Push All Migrations (Recommended)

```bash
# Apply all pending migrations
supabase db push
```

This will:
- Apply all unapplied migrations in order
- Create missing tables
- Add missing columns, indexes, triggers
- Set up RLS policies

### Option 2: Reset Database (Nuclear Option)

⚠️ **WARNING: This deletes ALL data!**

```bash
# Only do this if you're okay losing all data
supabase db reset
```

### Option 3: Manual Migration

If specific migrations failed:

```bash
# List migrations
supabase migration list

# Apply specific migration
supabase migration apply <migration-name>
```

---

## Common Issues

### Issue: "Migration already applied"
This happens if migrations were manually run. Solution:
- Check `supabase_migrations.schema_migrations` table
- Verify which migrations are tracked

### Issue: "Migration failed"
- Check error message
- Look at the failing migration file
- May need to fix SQL syntax or dependencies

### Issue: "Table already exists"
- Some migrations use `CREATE TABLE IF NOT EXISTS`
- Others use plain `CREATE TABLE`
- Safe to ignore if table already exists correctly

### Issue: "Column already exists"
- Check if migration adds existing column
- May need to manually mark as applied

---

## Checking Applied Migrations

### Via CLI

```bash
supabase migration list
```

### Via SQL

Connect to your database and run:

```sql
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC;
```

This shows all applied migrations.

---

## Migration Files Analysis

You have 177 migration files covering:

1. **Initial Schema** (Dec 2-4, 2024)
   - Core tables: organizations, profiles, leads
   - Social platforms, AI features

2. **Enhanced Features** (Dec 12-15, 2024)
   - Lead scoring
   - Workflows
   - Documents
   - Calendars
   - Training modules

3. **Security & Compliance** (Dec-Jan, 2025/2026)
   - Audit logs
   - RLS policies
   - Permission systems

4. **Recent Features** (Jan 2026)
   - Multi-property accommodation
   - Alert systems
   - Enhanced AI communication
   - Security audit remediation

---

## Migration Workflow

1. **Development**: Create migration files
   ```bash
   supabase migration new my_migration_name
   ```

2. **Testing**: Apply locally
   ```bash
   supabase db reset  # Fresh start
   ```

3. **Production**: Push to Supabase
   ```bash
   supabase db push
   ```

---

## Quick Commands

```bash
# Check status
supabase migration list

# Apply pending
supabase db push

# Create new migration
supabase migration new my_feature

# Reset database (⚠️ deletes data)
supabase db reset

# Generate types
supabase gen types typescript --local > src/types/database.ts
```

---

## What to Do Now

### Step 1: Check Status

```bash
supabase migration list
```

### Step 2: If Pending Migrations Exist

```bash
supabase db push
```

### Step 3: Verify Tables

Go to Supabase Dashboard and count tables:
https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh/editor

Should have **140+ tables** in the `public` schema.

### Step 4: If Still Missing Tables

Let me know which specific tables are missing and I'll help identify which migrations need to be applied.

---

## Support

- **Dashboard:** https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh
- **Schema Editor:** https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh/editor
- **SQL Editor:** https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh/sql

---

**Next Step:** Run `./scripts/verify-database-migrations.sh` to check your migration status!
