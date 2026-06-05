# Deploy Functions to New Supabase Project - Step by Step

## Issue
Your functions exist in code but aren't deployed to the NEW Supabase project (`domipubyjkhsrmdwtabh`).

## Solution: Deploy via Supabase Dashboard (No CLI Needed)

### Step 1: Access Edge Functions Dashboard

Go to: https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh/functions

### Step 2: Set Environment Variables First

1. Go to: https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh/settings/functions
2. Click **"Add new secret"**
3. Add these secrets:

```
Name: META_VERIFY_TOKEN
Value: alcornexus
```

```
Name: META_APP_SECRET
Value: d17a6665e2b0dae5c774dd2cafc5dfd2
```

### Step 3: Deploy social-webhook Function

**Option A: Via Dashboard UI**

1. Go to Edge Functions: https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh/functions
2. Click **"Create a new function"** or **"Deploy function"**
3. Method: Upload from local files
4. Select: `/workspaces/canvascapital/supabase/functions/social-webhook/`
5. Click **Deploy**

**Option B: Manual Code Paste**

1. Create new function named: `social-webhook`
2. Copy the entire content from: `/workspaces/canvascapital/supabase/functions/social-webhook/index.ts`
3. Paste it in the editor
4. Deploy

### Step 4: Verify Deployment

Test the webhook:
```bash
curl "https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=alcornexus&hub.challenge=test123"
```

**Expected response:** `test123`

### Step 5: Update Facebook/Instagram Webhooks

Now go back to Facebook and configure:
- Callback URL: `https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook`
- Verify Token: `alcornexus`

Click "Verify and save" - it should work now!

---

## Alternative: Install Supabase CLI Properly

If you need the CLI, use these methods:

### Method 1: Direct Binary Download (Recommended for Codespaces)

```bash
# Download and install
curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz
sudo mv supabase /usr/local/bin/supabase

# Verify installation
supabase --version
```

### Method 2: Using npx (No Installation)

You can run Supabase commands without installing:

```bash
# Login
npx supabase login

# Link project
npx supabase link --project-ref domipubyjkhsrmdwtabh

# Set secrets
npx supabase secrets set META_VERIFY_TOKEN=alcornexus
npx supabase secrets set META_APP_SECRET=d17a6665e2b0dae5c774dd2cafc5dfd2

# Deploy function
npx supabase functions deploy social-webhook
```

### Method 3: Using Homebrew (if available)

```bash
brew install supabase/tap/supabase
```

---

## Other Functions to Deploy

You'll also need to deploy these functions for your app to work:

### Critical Functions (Deploy These):
1. ✅ `social-webhook` - For receiving Meta messages
2. ✅ `facebook-connect` - For OAuth
3. ✅ `send-social-message` - For sending messages
4. ✅ `ai-chat` - For AI responses
5. ✅ `twilio-voice-webhook` - For phone calls

### Deploy All Functions Script

```bash
# Using npx (no installation needed)
npx supabase functions deploy social-webhook
npx supabase functions deploy facebook-connect
npx supabase functions deploy send-social-message
npx supabase functions deploy ai-chat
npx supabase functions deploy twilio-voice-webhook
npx supabase functions deploy google-calendar
npx supabase functions deploy send-email
npx supabase functions deploy send-sms
```

---

## Quick Fix for Right Now

**Just use the Dashboard method - it's fastest:**

1. Go to: https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh/settings/functions
2. Add environment variables (META_VERIFY_TOKEN, META_APP_SECRET)
3. Go to: https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh/functions
4. Click "Create function" → Upload `social-webhook` folder
5. Test with curl command
6. Update Facebook webhook settings

That's it!
