# Supabase Backend Audit

Date: 2026-04-08

## Executive Summary

The Supabase backend has a strong multi-tenant foundation with extensive RLS hardening, a large edge-function surface, and active remediation work in recent migrations. The biggest current risks are not basic architecture issues; they are exposure and hygiene issues around unverified edge-function entry points, inconsistent auth models for public-facing functions, migration repair churn, and a few helper behaviors that fail open or degrade silently.

The backend is viable, but it needs a tighter operational posture.

## Remediation Status

This audit is no longer purely advisory. The following hardening work was completed during the April 8, 2026 remediation pass and deployed to the linked Supabase project.

### Completed In This Pass

- `vaultEncrypt()` was changed to fail closed instead of returning plaintext on encryption failure.
- `process-document` was moved onto the shared CORS helper and no longer uses wildcard origin handling.
- Shared internal secret auth was added for internal/scheduled functions including:
	- `cleanup-old-data`
	- `sync-calendar-events`
	- `auto-update-booking-status`
	- `sync-bookings-from-events`
	- `generate-recurring-expenses`
	- `send-scheduled-reports`
	- `refresh-facebook-tokens`
	- `send-followup-email`
	- `send-email-digest`
	- `health-check`
- `facebook-connect` and `send-social-message` were reclassified as authenticated app endpoints and switched to `verify_jwt = true`.
- `twilio-voice-webhook` was hardened with Twilio signature verification using the shared Twilio signature helper.
- `login-alert` was hardened so it no longer trusts client-supplied IP addresses for block checks, geolocation, or auto-blocking.
- `book-demo`, `demo-ai-chat`, and the shared rate-limit helper were changed so DB-backed rate-limit failures fall back to in-memory enforcement instead of failing open.
- Grant repair migrations were added and applied for `operational_expenses` and for core service-role job tables used by scheduled/internal functions.

### Verified During This Pass

- Internal-secret protection for `cleanup-old-data` was verified with both positive and negative HTTP tests.
- Internal-secret protection for `generate-recurring-expenses` was verified end-to-end after grant repair.
- Relevant function deploys and migration pushes were completed successfully in the linked Supabase project.

### Still Requires Operational Follow-Through

- Rotate `INTERNAL_FUNCTION_SECRET` because test values were exposed during manual verification.
- Rotate any other secrets exposed during terminal or chat-based debugging.
- Re-run app-level quality checks when the workspace execution issue is resolved.

## Highest-Risk Findings

### 1. Many edge functions are intentionally exposed without platform JWT verification

`supabase/config.toml` currently marks a meaningful set of functions with `verify_jwt = false`, including public entry points and scheduled/integration endpoints.

Examples:

- `social-webhook`
- `facebook-connect`
- `book-demo`
- `login-alert`
- `cleanup-old-data`
- `send-scheduled-reports`
- `sync-calendar-events`
- `twilio-voice-webhook`

This is not automatically wrong, but it means those functions must fully defend themselves in code through signature checks, bearer-token verification, scheduler secrets, or request validation.

Current remaining `verify_jwt = false` functions fall into these categories:

- Public webhooks: `social-webhook`, `twilio-voice-webhook`
- Public product/demo endpoints: `book-demo`, `demo-ai-chat`
- Pre-auth security endpoint: `login-alert`
- Internal jobs already protected by shared secret or job secret validation: `cleanup-old-data`, `cleanup-training-retention`, `sync-calendar-events`, `auto-update-booking-status`, `sync-bookings-from-events`, `generate-recurring-expenses`, `send-scheduled-reports`, `refresh-facebook-tokens`, `send-followup-email`, `send-email-digest`, `health-check`

### 2. Shared helper quality is mixed, and some helpers fail open

#### Vault encryption degraded to plaintext on failure

This was fixed in `supabase/functions/_shared/vault.ts`. `vaultEncrypt()` now throws on encryption failure instead of returning the original plaintext.

Residual risk: encrypted credential call sites still need periodic verification and monitoring, but the dangerous downgrade behavior has been removed.

#### Rate limiting failed open

This was partially fixed in `supabase/functions/_shared/rateLimit.ts`, `book-demo`, `demo-ai-chat`, and `login-alert` by falling back to in-memory enforcement instead of implicitly allowing requests.

Residual risk: other endpoints with custom throttling should be reviewed for the same pattern.

### 3. Some functions bypassed the shared backend security patterns entirely

`supabase/functions/process-document/index.ts` previously used its own wildcard CORS headers instead of the shared CORS helper and allowed `Access-Control-Allow-Origin: *`.

This was fixed during the remediation pass.

### 4. Migration history shows repeated repair and restore patterns

The migration set includes numerous “repair”, “restore”, and security re-grant migrations.

Representative examples:

- `supabase/migrations/20260208090000_repair_leads_table.sql`
- `supabase/migrations/20260402170000_restore_authenticated_organization_write_grants.sql`
- `supabase/migrations/20260403193000_restore_user_roles_write_grants.sql`
- `supabase/migrations/20260403162000_restore_settings_access_and_avatar_storage.sql`

This pattern strongly suggests previous schema or grant changes broke application behavior and had to be restored incrementally.

That is not a reason to panic, but it is a reason to tighten migration discipline and replay testing.

## Function-Level Notes

### `social-webhook`

File: `supabase/functions/social-webhook/index.ts`

Strengths:

- HMAC verification for Meta webhook signatures
- in-memory deduplication and TTL tracking
- database-backed lock usage via shared helpers
- explicit rate-limiting logic layered on webhook traffic

Risks:

- large and highly complex function surface
- relies on multiple environment variables and helper behaviors that should be audited continuously

### `facebook-connect`

File: `supabase/functions/facebook-connect/index.ts`

Strengths:

- manual bearer-token verification
- explicit role checks for `client_admin` and `super_admin`
- fallback persistence paths for legacy schema compatibility

Risks:

- this mismatch was removed by switching the function to `verify_jwt = true`
- bearer-token and role validation logic still needs ongoing maintenance, but the platform config is now aligned with actual usage

### `send-social-message`

File: `supabase/functions/send-social-message/index.ts`

Strengths:

- uses shared auth guard
- enforces organization access
- decrypts stored platform tokens through vault helper

Risks:

- the auth mismatch was removed by switching the function to `verify_jwt = true`
- still depends on correct connected-account routing and token lifecycle handling

### `process-document`

File: `supabase/functions/process-document/index.ts`

Strengths:

- verifies auth through shared auth guard
- verifies organization ownership before processing a document
- uses file validation and text sanitization helpers

Risks:

- no major CORS inconsistency remains after alignment with the shared helper
- the remaining risk is mostly around AI processing and file handling, not origin policy

### `undo-migration`

File: `supabase/functions/undo-migration/index.ts`

Strengths:

- requires authenticated user
- checks for `super_admin` role
- validates migration existence and undo window

Risks:

- updates many tables directly based on `migration_logs`
- operationally powerful function with limited safety rails beyond role and expiry window
- should be treated as an admin recovery tool, not a normal runtime path

## Migration Hygiene Findings

### Good Signals

- recent migrations focus heavily on RLS hardening and grant repair
- security-definer search path fixes are present
- archive and recovery migrations suggest the team is building safer deletion workflows

### Risk Signals

- high migration volume with many corrective follow-up migrations
- repeated function and grant redefinitions increase replay and dependency risk
- repair-style migrations imply prior drift or broken assumptions in production schema state

### Recommendation

Add a clean-database replay check to confirm the entire migration chain still produces the expected schema and privileges from scratch. The number of restore-style grant migrations is still a real signal even after the targeted privilege fixes applied in this pass.

## Shared Helper Review

### `auth-guard.ts`

Good:

- resolves user context correctly
- enforces organization access in a reusable way
- supports super-admin override in a controlled pattern

Gap:

- no integrated audit trail for auth failures or rejected org mismatches

### `cors.ts`

Good:

- origin allowlist
- avoids `*`
- supports local development and preview origins

Gap:

- only effective if functions actually use it

### `vault.ts`

Good:

- centralizes encryption behavior
- uses prefix detection to avoid double-decrypt assumptions

Gap:

- the fail-open behavior was fixed, but shared credential storage still deserves direct regression coverage

### `rateLimit.ts`

Good:

- burst and sustained controls are split cleanly
- shared limits exist for public, authenticated, form, and webhook traffic

Gap:

- the fail-open behavior was fixed for the shared helper itself
- some public functions still implement custom throttling instead of using one shared abstraction

### `sanitization.ts`

Good:

- bounds AI conversation history
- strips obvious prompt-injection patterns
- validates file uploads and image URLs

Gap:

- limited to specific text-processing cases
- not a universal input-hardening layer for all public/request payloads

## Green Areas

- Supabase configuration is explicit and centrally defined in `supabase/config.toml`
- multi-tenant organization enforcement is a clear architectural priority
- the codebase has shared helpers rather than duplicating auth logic everywhere
- webhook and AI surfaces show evidence of deliberate abuse protection and content handling
- recent migration work indicates active security maintenance rather than neglect

## Immediate Actions

1. Rotate `INTERNAL_FUNCTION_SECRET` and any other secrets exposed during manual testing.
2. Document the trust model for each remaining intentional `verify_jwt = false` endpoint.
3. Verify `twilio-voice-webhook` against a real signed Twilio request after deployment.
4. Add regression coverage for the new internal-secret and rate-limit fallback behaviors.

## Short-Term Actions

1. Standardize public-function auth patterns so there is a clear distinction between webhook, scheduler, OAuth callback, pre-auth security, and authenticated app functions.
2. Migrate any remaining custom throttling logic onto a consistent shared abstraction where practical.
3. Add an internal migration replay check for clean-database verification.
4. Add backend documentation for high-risk functions, expected callers, and required secrets.

## Medium-Term Actions

1. Add correlation IDs and structured request tracing across edge functions.
2. Add audit logging for auth and authorization failures in shared helpers.
3. Review whether some large functions, especially webhook handlers, should be split into smaller orchestration layers.

## Suggested Verification Commands

Use these when doing backend-specific validation:

```bash
npx supabase db reset
npx supabase functions serve social-webhook
npx supabase functions serve facebook-connect
npx supabase functions serve send-social-message
deno test supabase/functions/_tests --allow-env --allow-net
```

Use the app-level checks as well:

```bash
npm run lint
npm run type-check
npm run test
```