# Facebook Pages Integration

This documents the minimal steps to enable per-organization Facebook Page connections.

Environment variables required (set in the Supabase / deploy environment):

- `FACEBOOK_APP_ID` - your Facebook App ID
- `FACEBOOK_APP_SECRET` - your Facebook App Secret
- `SUPABASE_URL` - your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for edge function server-side operations)
- `SUPABASE_ANON_KEY` - Supabase anon key (for edge functions to validate callers)

Database migration:

1. Apply the migration file `supabase/migrations/20251212_create_facebook_pages.sql` to create the `facebook_pages` table.

Edge Function:

- `supabase/functions/facebook-connect` implements:
  - `GET ?action=list` - returns a list of connected pages for the caller's organization (no tokens returned)
  - `POST { action: 'exchange', code, redirectUri }` - exchanges the Facebook OAuth code, fetches pages and saves page access tokens server-side
  - `POST { action: 'disconnect', page_id }` - removes a stored page for the organization

Frontend:

- A "Connect Facebook" button on the `Social Platforms` page redirects the user to Facebook's OAuth flow.
- Facebook redirects to `/facebook-callback` which calls the edge function to exchange the code.

Security notes:

- Page access tokens are stored server-side in `facebook_pages.access_token`. Ensure your database is secured and that only authorized server functions can read these tokens.
- Only users with `client_admin` or `super_admin` roles can create or remove connections (checked by the edge function).
- Do not expose page access tokens to the browser. The edge function avoids returning raw tokens.

Next steps / improvements:

- Add a DB view `facebook_pages_safe` that hides `access_token` for any client-visible queries.
- Add webhook subscription logic to subscribe connected pages to messaging events if needed.
- Implement token refresh/expiration handling and token revocation flows.
