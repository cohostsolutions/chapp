# Supabase Function Trust Model

Date: 2026-04-08

This document describes how Canvas Capital edge functions are expected to be called after the April 2026 backend hardening pass.

Use this file as the current source of truth for deciding whether a function should use platform JWT verification, shared internal-secret auth, webhook signature verification, or deliberately remain public.

## Trust Model Categories

### 1. Authenticated App Endpoint

Use `verify_jwt = true` when the function is called by a logged-in app user through `supabase.functions.invoke(...)` or a frontend `fetch` that carries the user session token.

Examples:

- `facebook-connect`
- `send-social-message`
- `process-document`
- `twilio-voice-token`

Expected controls:

- Supabase platform JWT verification enabled
- optional in-function role or organization checks
- service-role client only for privileged internal DB operations after auth is established

### 2. Internal Scheduled Job

Use `verify_jwt = false` only when the caller is not a user session and the function is triggered by cron, automation, or another controlled backend system.

Examples:

- `cleanup-old-data`
- `send-scheduled-reports`
- `generate-recurring-expenses`
- `refresh-facebook-tokens`
- `health-check`

Expected controls:

- shared secret via `INTERNAL_FUNCTION_SECRET` or `CRON_SECRET`
- request must include `x-internal-function-secret` or `Authorization: Bearer <secret>`
- CORS headers may still exist for consistency, but these are not public browser APIs

### 3. External Webhook

Use `verify_jwt = false` when the caller is an external platform such as Meta or Twilio.

Examples:

- `social-webhook`
- `twilio-voice-webhook`

Expected controls:

- provider signature verification
- endpoint-specific abuse protection and validation
- idempotency and deduplication where replay risk exists

### 4. Public Product Endpoint

Use `verify_jwt = false` when the function is intentionally callable by unauthenticated site visitors.

Examples:

- `book-demo`
- `demo-ai-chat`

Expected controls:

- strong request validation
- rate limiting that does not fail open
- no privileged behavior tied to caller-controlled identifiers without validation

### 5. Pre-Auth Security Endpoint

Use `verify_jwt = false` when the function must run before a user has a valid session, but still handles security-sensitive logic.

Example:

- `login-alert`

Expected controls:

- derive IP and caller context from trusted request metadata, not user body input
- rate limiting that does not fail open
- avoid account-enumeration and data-leak responses

## Current Function Classification

### Authenticated App Endpoints

- `ai-chat`
- `sync-booking-calendar`
- `agent-takeover`
- `agent-handback`
- `google-calendar`
- `send-sms`
- `generate-summary`
- `manage-user`
- `send-welcome-email`
- `change-password`
- `refresh-single-token`
- `send-social-message`
- `send-email`
- `geolocate-ip`
- `revoke-session`
- `test-social-connection`
- `facebook-connect`
- `webhook-health-check`
- `manage-2fa`
- `elevenlabs-tts`
- `process-document`
- `evaluate-training-session`
- `upload-chat-file`
- `reengage-lead`
- `backfill-facebook-messages`
- `process-pending-messages`
- `migrate-assets`
- `undo-migration`
- `twilio-voice-token`
- `send-reaction`

### Internal Scheduled Jobs

- `cleanup-old-data`
- `cleanup-training-retention`
- `sync-calendar-events`
- `auto-update-booking-status`
- `sync-bookings-from-events`
- `generate-recurring-expenses`
- `send-scheduled-reports`
- `refresh-facebook-tokens`
- `send-followup-email`
- `send-email-digest`
- `health-check`

### External Webhooks

- `social-webhook`
- `twilio-voice-webhook`

### Public Product Endpoints

- `book-demo`
- `demo-ai-chat`

### Pre-Auth Security Endpoints

- `login-alert`

## Known Frontend Callers

### `facebook-connect`

Used by:

- `src/components/settings/SocialPlatformsTab.tsx`
- `src/pages/FacebookCallback.tsx`
- `src/pages/InstagramCallback.tsx`
- `src/pages/WhatsAppCallback.tsx`
- `src/components/TokenExpiryAlert.tsx`

Expectation:

- frontend must send the Supabase session token
- platform config remains `verify_jwt = true`

### `send-social-message`

Used by:

- `src/hooks/useCommunications.ts`
- `src/pages/ChatLogs.tsx`

Expectation:

- called from authenticated app state only
- platform config remains `verify_jwt = true`

### `book-demo`

Used by:

- `src/components/landing/LeadCaptureDialog.tsx`

Expectation:

- remains public
- protected by validation and throttling, not JWT

### `demo-ai-chat`

Used by:

- `src/components/landing/AITestChat.tsx`

Expectation:

- remains public
- protected by validation and throttling, not JWT

### `login-alert`

Used by:

- `src/contexts/AuthContext.tsx`

Expectation:

- remains pre-auth because it can run after failed sign-in attempts before a valid session exists
- must never trust client-supplied IP address or equivalent identifiers

## Operational Notes

- Rotate `INTERNAL_FUNCTION_SECRET` whenever it is exposed in logs, shell history, screenshots, or chat.
- For internal jobs, changing the secret also requires updating the caller or scheduler.
- Public webhook endpoints must be validated against their provider’s real signed requests after changes.
- Any new `verify_jwt = false` function should be documented here with its trust model before it is deployed.