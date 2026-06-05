# Troubleshooting Guide

Common issues and their solutions for AlCor Nexus.

## 📋 Table of Contents

- [Build Issues](#build-issues)
- [Database Issues](#database-issues)
- [Authentication Issues](#authentication-issues)
- [Edge Function Issues](#edge-function-issues)
- [Performance Issues](#performance-issues)
- [UI/Component Issues](#uicomponent-issues)
- [Integration Issues](#integration-issues)

---

## 🔨 Build Issues

### Large Bundle Size Warning

**Problem**: Build shows warnings about chunk sizes exceeding 500kB.

**Solution**:
1. Check if lazy loading is working:
   ```bash
   npm run build
   ls -la dist/assets/*.js
   ```
2. Ensure React.lazy is used for page components
3. Check for accidental imports of large libraries

### TypeScript Errors

**Problem**: Type errors during build.

**Solution**:
```bash
# Run type check to see all errors
npm run type-check

# Common fixes:
# 1. Add proper types to function parameters
# 2. Use type guards for unknown data
# 3. Check for null/undefined before accessing properties
```

### Missing Dependencies

**Problem**: Module not found errors.

**Solution**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install

# If using bun
rm -rf node_modules
bun install
```

---

## 🗄️ Database Issues

### Data Not Showing

**Problem**: Query returns empty array even though data exists.

**Possible Causes**:
1. **RLS Policies**: User doesn't have access
2. **Organization Scope**: Wrong organization_id
3. **Query Limit**: Supabase default limit is 1000

**Solutions**:
```typescript
// Check RLS by testing with service role (in Edge Function only)
const supabase = createClient(url, serviceRoleKey);

// Verify organization context
console.log('Current org:', organizationId);

// Handle pagination for large datasets
const { data, count } = await supabase
  .from('table')
  .select('*', { count: 'exact' })
  .range(0, 999);
```

### Row Level Security Errors

**Problem**: `new row violates row-level security policy`

**Solutions**:
1. Check if the user has the required role
2. Verify organization_id matches
3. Review RLS policies in Supabase Dashboard

```sql
-- Check existing policies
SELECT * FROM pg_policies WHERE tablename = 'your_table';
```

### Foreign Key Errors

**Problem**: `violates foreign key constraint`

**Solution**: Ensure referenced records exist before inserting:
```typescript
// Check if related record exists first
const { data: profile } = await supabase
  .from('profiles')
  .select('id')
  .eq('id', userId)
  .single();

if (!profile) {
  // Create profile first
}
```

---

## 🔐 Authentication Issues

### Login Not Working

**Symptoms**: Login form submits but nothing happens.

**Debug Steps**:
1. Check browser console for errors
2. Verify Supabase connection
3. Check network tab for API responses

```typescript
// Add debug logging
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});
console.log('Login result:', { data, error });
```

### Session Not Persisting

**Problem**: User gets logged out on page refresh.

**Solution**: Check Supabase client configuration:
```typescript
// Verify client uses correct storage
const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    storage: localStorage,
  },
});
```

### OAuth Redirect Issues

**Problem**: Social login redirects to wrong URL.

**Solution**:
1. Check redirect URL in Supabase Dashboard
2. Verify Site URL configuration
3. Add all valid redirect URLs

---

## ⚡ Edge Function Issues

### Function Not Deploying

**Problem**: Edge function changes not reflecting.

**Solutions**:
1. Check for syntax errors in the function
2. Verify `supabase/config.toml` configuration
3. Check edge function logs for deployment errors

### CORS Errors

**Problem**: `Access-Control-Allow-Origin` errors.

**Solution**: Ensure CORS headers are set:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Handle OPTIONS request
if (req.method === 'OPTIONS') {
  return new Response(null, { headers: corsHeaders });
}
```

### Secret Not Found

**Problem**: `Deno.env.get('SECRET_NAME')` returns undefined.

**Solution**:
1. Add secret via Lovable Cloud secrets tool
2. Verify secret name matches exactly (case-sensitive)
3. Redeploy the function after adding secrets

### Rate Limit Exceeded

**Problem**: Getting 429 Too Many Requests.

**Solution**: Check rate limiting configuration:
```typescript
// Increase limits or add caching
const RATE_LIMIT_MAX = 100; // per hour
```

---

## 🐌 Performance Issues

### Slow Page Load

**Debug Steps**:
1. Open DevTools Network tab
2. Look for slow API calls
3. Check for unnecessary re-renders

**Solutions**:
```typescript
// Add loading states
if (isLoading) return <Skeleton />;

// Use React.memo for expensive components
const ExpensiveComponent = React.memo(({ data }) => { ... });

// Debounce search inputs
const debouncedSearch = useDebounce(searchTerm, 300);
```

### Slow Database Queries

**Debug Steps**:
```typescript
// Check query performance
const start = performance.now();
const { data } = await supabase.from('table').select();
console.log(`Query took ${performance.now() - start}ms`);
```

**Solutions**:
1. Add database indexes for frequently queried columns
2. Limit returned columns with `.select('id, name')`
3. Use pagination for large datasets

### Memory Leaks

**Symptoms**: App becomes slower over time.

**Common Causes**:
1. Missing cleanup in useEffect
2. Accumulated event listeners
3. Growing state arrays

**Solution**:
```typescript
useEffect(() => {
  const subscription = supabase
    .channel('changes')
    .subscribe();

  // Always cleanup!
  return () => {
    subscription.unsubscribe();
  };
}, []);
```

---

## 🎨 UI/Component Issues

### Command Palette Not Working

**Problem**: Cmd+K / Ctrl+K doesn't open palette.

**Solutions**:
1. Verify CommandPalette is imported in App.tsx
2. Check for conflicting keyboard shortcuts
3. Ensure component is rendered (not conditionally hidden)

### Dropdowns Appearing Behind Other Elements

**Problem**: Select/dropdown menus are cut off or behind other content.

**Solution**: Add higher z-index:
```tsx
<SelectContent className="z-[9999] bg-popover">
  ...
</SelectContent>
```

### Dark Mode Issues

**Problem**: Some elements don't respect dark mode.

**Solution**: Use semantic color tokens:
```tsx
// ❌ Wrong
<div className="bg-white text-black">

// ✅ Correct
<div className="bg-background text-foreground">
```

### Toast Notifications Not Showing

**Problem**: toast() calls don't display anything.

**Solution**: Ensure Toaster component is in the app:
```tsx
// In App.tsx
import { Toaster } from '@/components/ui/sonner';

function App() {
  return (
    <>
      <YourApp />
      <Toaster />
    </>
  );
}
```

---

## 🔗 Integration Issues

### Google Calendar Not Syncing

**Debug Steps**:
1. Check if OAuth tokens are valid
2. Verify calendar permissions
3. Check edge function logs

**Solution**: Reconnect calendar:
1. Go to Settings > Calendar
2. Click "Disconnect"
3. Click "Connect Google Calendar"
4. Authorize all requested permissions

### WhatsApp Messages Not Sending

**Debug Steps**:
1. Check Meta webhook configuration
2. Verify access token is valid
3. Check phone number format

**Common Issues**:
- Token expired: Re-authenticate with Meta
- Wrong phone format: Use E.164 format (+1234567890)
- Template not approved: Wait for Meta approval

### Email Not Sending

**Problem**: Emails not being delivered.

**Debug Steps**:
1. Check Resend API key is configured
2. Verify sender email domain
3. Check edge function logs

```typescript
// Add logging to email sending
console.log('Sending email to:', recipient);
const result = await resend.emails.send({ ... });
console.log('Email result:', result);
```

---

## 🆘 Still Having Issues?

### Collect Debug Information

Before asking for help, gather:
1. Error messages from browser console
2. Network request/response details
3. Edge function logs
4. Steps to reproduce the issue

### Where to Get Help

1. Check existing documentation
2. Search for similar issues
3. Open a GitHub issue with debug info
4. Contact the development team

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [React Query Guide](https://tanstack.com/query/latest/docs)
- [Tailwind CSS Reference](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)
