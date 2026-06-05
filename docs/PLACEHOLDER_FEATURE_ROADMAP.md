# Placeholder Feature Roadmap

This document tracks placeholder features that are relevant to the product and should remain on the roadmap.

It is intended to answer four delivery questions for each feature:

- What should be built first
- What schema changes are required
- Which frontend files need to change
- What testing is required before the feature can be considered live

## Delivery Strategy

### Phase 1: Close Live CRM And Accommodation Gaps

Build first because these features map directly to active user workflows and remove visible dead ends.

1. Lead offerings relationships
2. Guest preferences
3. Housekeeping tasks

### Phase 2: Strengthen Admin Controls

Build after Phase 1 because this expands administrator capability but is less urgent than core workflow persistence.

4. Custom permission sets

### Phase 3: Add Intelligence Layers Carefully

Build only once the underlying operational data is stable enough to support the feature.

5. Lead scoring

### Phase 4: Improve Supporting Infrastructure

Build later because the app already works without these features, even if they would improve data quality and platform breadth.

6. Multi-currency rate sync
7. TikTok and Viber integrations

## Keep And Build

### 1. Housekeeping Tasks

- Status: Hook exists, but no database table has been deployed yet.
- User impact: Accommodation and operations flows cannot persist housekeeping work.
- Files:
  - `src/hooks/useCreateHousekeepingTask.ts`
  - `src/lib/validations.ts`
- Required backend work:
  - Create `housekeeping_tasks` table
  - Add RLS policies
  - Add create/update queries and any supporting indexes
- Frontend follow-up:
  - Replace explicit unavailable errors with real mutations
  - Add task list/query hooks if the UI is going to surface active tasks

#### Implementation Order

1. Add migration for `housekeeping_tasks`
2. Add indexes for `organization_id`, `property_id`, `room_id`, `assigned_to`, and `status`
3. Add RLS policies for organization-scoped read/write access
4. Replace unavailable mutation errors in `useCreateHousekeepingTask`
5. Add read hooks for listing and filtering tasks if the UI needs task boards or room-level task history

#### Proposed Schema

- `id uuid primary key default gen_random_uuid()`
- `organization_id uuid not null references organizations(id)`
- `property_id uuid not null`
- `room_id uuid null`
- `title text not null`
- `description text null`
- `priority text not null`
- `task_type text not null`
- `status text not null`
- `assigned_to uuid null references profiles(id)`
- `estimated_duration integer null`
- `actual_duration integer null`
- `checklist_items jsonb not null default '[]'::jsonb`
- `notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

#### Testing Scope

- Migration test: table, indexes, and RLS policies exist
- Hook tests for create success, update success, and unauthorized failure
- UI tests for task creation toast, error state, and query invalidation
- Regression test that unavailable placeholder errors no longer appear after implementation

#### Acceptance Criteria

- Users can create and update housekeeping tasks and see persisted state after refresh
- Tasks are isolated by organization
- Room-level task state is queryable without manual refresh workarounds

### 2. Guest Preferences

- Status: Hook exists, but no database table has been deployed yet.
- User impact: Guest preferences cannot be saved persistently.
- Files:
  - `src/hooks/useUpdateGuestPreferences.ts`
  - `src/lib/validations.ts`
- Required backend work:
  - Create `guest_preferences` table
  - Add unique constraint or conflict target for guest-level upserts
  - Add RLS policies
- Frontend follow-up:
  - Replace explicit unavailable errors with real upsert logic
  - Add query hook for loading saved preferences

#### Implementation Order

1. Add migration for `guest_preferences`
2. Add unique constraint on `(organization_id, guest_id)` or equivalent supported entity
3. Add RLS policies for organization-scoped access
4. Implement upsert mutation in `useUpdateGuestPreferences`
5. Add a companion query hook for loading saved guest preferences into UI forms

#### Proposed Schema

- `id uuid primary key default gen_random_uuid()`
- `organization_id uuid not null references organizations(id)`
- `guest_id uuid not null`
- `previous_stay_notes text null`
- `preferred_room_types text[] not null default '{}'`
- `preferred_configurations jsonb not null default '{}'::jsonb`
- `special_requests jsonb not null default '[]'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- unique `(organization_id, guest_id)`

#### Testing Scope

- Migration test for unique guest/org constraint
- Hook tests for first save and update save
- UI tests for loading existing preferences into the form
- RLS tests to ensure cross-organization reads are denied

#### Acceptance Criteria

- Returning guest preferences persist and reload correctly
- Multiple saves update the same record instead of creating duplicates
- Preferences remain isolated by organization

### 3. Lead Offerings Relationships

- Status: UI exists, but counts remain empty because the `lead_offerings` junction table is missing.
- User impact: Sales users see no offering counts even when the product implies the feature exists.
- Files:
  - `src/hooks/useLeadOfferingCounts.ts`
  - `src/components/sales/OfferingCountBadge.tsx`
  - `src/components/sales/LeadsTabContent.tsx`
  - `src/hooks/useSalesData.ts`
  - `src/hooks/useCreateSale.ts`
- Required backend work:
  - Create `lead_offerings` table
  - Define foreign keys to leads and offerings
  - Add organization-scoped RLS
- Frontend follow-up:
  - Implement both count hooks against real queries
  - Add tests for zero, one, and many offerings

#### Implementation Order

1. Add migration for `lead_offerings`
2. Add unique constraint to avoid duplicate lead/offering links
3. Implement count queries in `useLeadOfferingCounts`
4. Replace placeholder comments in sales hooks with real relation writes where applicable
5. Confirm all badge and tooltip UI paths render real counts

#### Proposed Schema

- `id uuid primary key default gen_random_uuid()`
- `organization_id uuid not null references organizations(id)`
- `lead_id uuid not null references leads(id) on delete cascade`
- `offering_id uuid not null references offerings(id) on delete cascade`
- `created_at timestamptz not null default now()`
- unique `(organization_id, lead_id, offering_id)`

#### Testing Scope

- Migration test for FK integrity and duplicate prevention
- Hook tests for aggregate counts and single-lead counts
- Component tests for `OfferingCountBadge` hidden, singular, plural, and tooltip variants
- Regression test around sales flows that currently assume empty offerings arrays

#### Acceptance Criteria

- Leads can be linked to offerings without duplicate rows
- Offering badges display correct counts and names
- Sales flows no longer silently discard offering relationships

### 4. Lead Scoring Configuration And Predictions

- Status: Configuration UI and score hooks exist, but persistence tables are missing.
- User impact: Users can see scoring UI, but configuration is not durable and predictions are incomplete.
- Files:
  - `src/hooks/useLeadScoring.ts`
  - `src/components/leads/LeadScoringConfig.tsx`
  - `src/components/leads/LeadScoreDisplay.tsx`
- Required backend work:
  - Create `lead_scoring_config` table
  - Create `lead_scores` table if durable score snapshots are desired
  - Create `lead_predictions` table if predictive outputs should persist
  - Add RLS and recalculation strategy
- Frontend follow-up:
  - Decide whether scores are computed on demand or persisted
  - Wire save flow to real config mutations
  - Surface unsupported state until fully live if this UI is exposed

#### Implementation Decision Gate

Do not start this feature until the team agrees on one of these models:

1. Configuration only: persist scoring config, compute scores on demand
2. Durable scoring: persist config and score snapshots
3. Predictive scoring: persist config, scores, and model-like predictions

#### Recommended First Slice

1. Persist scoring configuration only
2. Keep score calculation deterministic and rule-based
3. Defer `lead_predictions` unless there is a real predictive model or clear heuristic contract

#### Proposed Schema

`lead_scoring_config`

- `id uuid primary key default gen_random_uuid()`
- `organization_id uuid not null unique references organizations(id)`
- `criteria jsonb not null`
- `weights jsonb not null default '{}'::jsonb`
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Optional `lead_scores`

- `id uuid primary key default gen_random_uuid()`
- `organization_id uuid not null references organizations(id)`
- `lead_id uuid not null references leads(id) on delete cascade`
- `score integer not null`
- `prediction_data jsonb not null default '{}'::jsonb`
- `calculated_at timestamptz not null default now()`

#### Testing Scope

- Hook tests for loading and saving scoring config
- Component tests for config form editing, reset, and save errors
- Score display tests for hot, warm, cold, and no-data cases
- If score persistence is added, RLS and recalculation tests per organization

#### Acceptance Criteria

- Admins can save scoring configuration and retrieve it after refresh
- Score display behavior is deterministic and documented
- No UI claims AI predictions unless the underlying data model actually supports them

### 5. Custom Permission Sets

- Status: Role-based permissions work, but fine-grained permission sets are scaffolded only.
- User impact: Advanced admin access models cannot be configured.
- Files:
  - `src/hooks/usePermissions.ts`
- Required backend work:
  - Create `permission_sets` table
  - Create `user_permissions` table
  - Define data model for resource/action grants
  - Add RLS and admin-only mutation policies
- Frontend follow-up:
  - Build actual management UI if this feature will be exposed
  - Keep role-based fallback for organizations that do not need custom rules

#### Implementation Decision Gate

Do not build this until the team confirms there is a real admin workflow that needs per-resource overrides beyond current role-based access.

#### Recommended First Slice

1. Add data model only
2. Keep current role-based fallback
3. Build read-only inspection before full edit UI if you want lower implementation risk

#### Proposed Schema

`permission_sets`

- `id uuid primary key default gen_random_uuid()`
- `organization_id uuid not null references organizations(id)`
- `name text not null`
- `description text null`
- `permissions jsonb not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`user_permissions`

- `id uuid primary key default gen_random_uuid()`
- `organization_id uuid not null references organizations(id)`
- `user_id uuid not null references profiles(id)`
- `permission_set_id uuid not null references permission_sets(id)`
- `resource_type text not null`
- `created_at timestamptz not null default now()`

#### Testing Scope

- Hook tests for role fallback when no custom permissions exist
- Hook tests for permission set assignment and resource-level checks
- RLS tests for org-admin-only mutation access
- Integration tests around route and action gating once a UI exists

#### Acceptance Criteria

- Existing role-based behavior remains unchanged for customers not using custom permissions
- Admins can assign scoped permission sets without cross-organization leakage

### 6. Multi-Currency Exchange Rate Sync

- Status: Static currency support works; only dynamic exchange-rate syncing is still a placeholder.
- User impact: Currency formatting works, but rates are static and will drift.
- Files:
  - `src/hooks/useMultiCurrency.ts`
  - `src/components/AddOrganizationDialog.tsx`
  - `src/pages/OrganizationSettings.tsx`
- Required backend work:
  - Decide whether exchange rates belong in a `currencies` table or external cache
  - Add scheduled rate refresh job or edge function
- Frontend follow-up:
  - Replace placeholder success mutation with real refresh behavior
  - Show last-updated timestamp if rates become dynamic

#### Recommended Approach

Keep the existing static fallback list and add a real data source behind it. Do not block formatting or organization setup on live exchange-rate fetches.

#### Proposed Schema

If stored in Postgres:

- `code text primary key`
- `name text not null`
- `symbol text not null`
- `exchange_rate numeric not null`
- `is_active boolean not null default true`
- `updated_at timestamptz not null default now()`
- `source text null`

#### Testing Scope

- Hook tests for static fallback when live rates are unavailable
- Hook tests for successful refresh and updated timestamp behavior
- UI tests that organization currency selection still works even if refresh fails

#### Acceptance Criteria

- Currency formatting continues to work during rate refresh failures
- Rate refresh updates persisted rates and invalidates cached currency queries

### 7. TikTok And Viber Social Integrations

- Status: These appear in the social integrations menu as disabled future options.
- User impact: Clearly presented as future functionality, not broken functionality.
- Files:
  - `src/components/settings/SocialPlatformsTab.tsx`
- Required backend work:
  - OAuth or token strategy per platform
  - Webhook ingestion and send-message capabilities where supported
  - Asset/account sync and organization scoping
- Frontend follow-up:
  - Keep disabled until end-to-end implementation is ready
  - Remove menu items if roadmap changes

#### Implementation Guidance

This should remain parked until Meta-related integrations are stable and support volume justifies expansion. Build each platform as its own project slice rather than bundling them together.

#### Acceptance Criteria

- Platform-specific auth, inbound events, outbound messaging, and account sync all work end to end before the menu item is enabled

## Recommended Build Order

1. Lead offerings
2. Guest preferences
3. Housekeeping tasks
4. Lead scoring
5. Custom permission sets
6. Multi-currency rate sync
7. TikTok and Viber integrations

## Suggested Ticket Breakdown

### Sprint A

1. `lead_offerings` migration and hooks
2. `guest_preferences` migration and hooks

### Sprint B

1. `housekeeping_tasks` migration and hooks
2. UI cleanup to remove any remaining false-success messaging

### Sprint C

1. `permission_sets` and `user_permissions` schema
2. Minimal admin inspection or assignment UI

### Sprint D

1. Lead scoring config persistence
2. Deterministic score display hardening

### Sprint E

1. Live exchange-rate sync
2. Later social expansion if justified

## Removed As Non-Roadmap Placeholders

The following unused placeholder modules were removed because they had no callers and did not align with the active product direction:

- `src/hooks/useDashboards.ts`
- `src/hooks/usePortal.ts`
- `src/hooks/useSecurity.ts`

Support tickets remain in the app through the active implementation in `src/pages/SupportTickets.tsx` and related chat/helpdesk hooks, so the removed portal-ticket scaffolding was redundant rather than foundational.