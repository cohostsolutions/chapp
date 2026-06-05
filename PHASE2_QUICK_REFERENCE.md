# Phase 2 Quick Reference
## Copy-Paste Code Examples for Each Fix

---

## RATELIMIT-001: Request Debouncing

### Basic Form Submission with Debouncing

```typescript
import { debouncer } from '@/lib/requestDebouncer';
import { useState } from 'react';
import { EnhancedButton } from '@/components/ui/button-enhanced';

export function LeadForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (formData: LeadData) => {
    setIsSubmitting(true);
    try {
      // This debounces: rapid clicks = 1 API call
      const result = await debouncer.debounce(
        'create-lead', // unique operation key
        async () => {
          return supabase
            .from('leads')
            .insert([formData])
            .select()
            .single();
        },
        500 // debounce delay in ms
      );
      return result;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      await handleSubmit(getFormData());
    }}>
      {/* Form fields */}
      <EnhancedButton 
        isLoading={isSubmitting}
        type="submit"
      >
        Save Lead
      </EnhancedButton>
    </form>
  );
}
```

### Multiple Different Operations

```typescript
// Different keys = different debounce windows
const saveLead = async () => {
  return debouncer.debounce('save-lead', fetchSaveLead, 500);
};

const saveOrder = async () => {
  return debouncer.debounce('save-order', fetchSaveOrder, 500);
};

// Can call same function twice if needed
const deleteAndRecreate = async () => {
  await debouncer.debounce('delete-lead', fetchDelete, 500);
  await debouncer.debounce('create-lead', fetchCreate, 500);
};
```

### Cancel Pending Operation

```typescript
// User navigates away before operation completes
useEffect(() => {
  return () => {
    // Clean up pending requests on unmount
    debouncer.cancel('save-lead');
  };
}, []);
```

---

## UX-BUTTON-001: Enhanced Buttons

### Basic Loading Button

```tsx
import { EnhancedButton } from '@/components/ui/button-enhanced';

<EnhancedButton
  isLoading={isLoading}
  onClick={handleSave}
>
  Save Changes
</EnhancedButton>
```

### Button with Custom Loading Text

```tsx
<EnhancedButton
  isLoading={isSaving}
  loadingText="Saving..."
  onClick={handleSave}
>
  Save
</EnhancedButton>
```

### Error State Button

```tsx
const [error, setError] = useState<string | null>(null);

<EnhancedButton
  isError={!!error}
  onClick={handleRetry}
>
  {error ? 'Try Again' : 'Continue'}
</EnhancedButton>
```

### Auto-Debounced Button

```tsx
import { DebouncedButton } from '@/components/ui/button-enhanced';

// Automatically debounces onclick - no additional setup needed
<DebouncedButton 
  debounceMs={500}
  onClick={handleClick}
>
  Click Me
</DebouncedButton>
```

### Different Button Variants

```tsx
// Default (blue)
<EnhancedButton isLoading={loading}>Save</EnhancedButton>

// Destructive (red)
<EnhancedButton variant="destructive" isLoading={loading}>
  Delete
</EnhancedButton>

// Outline
<EnhancedButton variant="outline" isLoading={loading}>
  Cancel
</EnhancedButton>

// Ghost (minimal)
<EnhancedButton variant="ghost" isLoading={loading}>
  More Options
</EnhancedButton>
```

### Button Sizes

```tsx
// Small
<EnhancedButton size="sm">Small</EnhancedButton>

// Default (44px height)
<EnhancedButton size="default">Normal</EnhancedButton>

// Large
<EnhancedButton size="lg">Large</EnhancedButton>

// Icon button (square)
<EnhancedButton size="icon" isLoading={loading}>
  <Icon />
</EnhancedButton>
```

---

## FORM-001: Error Messages

### Field-Level Error with Hint & Example

```tsx
import { FieldError } from '@/components/form/FormErrorComponents';
import { useForm } from 'react-hook-form';

export function ContactForm() {
  const { register, formState: { errors } } = useForm();

  return (
    <div>
      <label>Email</label>
      <Input {...register('email')} />
      <FieldError
        error={errors.email?.message}
        hint="We'll never share your email"
        example="john@example.com"
      />
    </div>
  );
}
```

### Form-Level Error Alert

```tsx
import { FormErrorAlert } from '@/components/form/FormErrorComponents';
import { useState } from 'react';

export function PaymentForm() {
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {error && (
        <FormErrorAlert
          title="Payment Failed"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}
      {/* Form fields */}
    </>
  );
}
```

### Success Confirmation

```tsx
import { FormSuccessAlert } from '@/components/form/FormErrorComponents';
import { useState } from 'react';

export function AddLeadDialog() {
  const [success, setSuccess] = useState(false);

  return (
    <>
      {success && (
        <FormSuccessAlert
          title="Lead Created"
          message="The new lead has been added to your system"
          onDismiss={() => setSuccess(false)}
        />
      )}
      {/* Form fields */}
    </>
  );
}
```

### Warning Message

```tsx
import { FormWarningAlert } from '@/components/form/FormErrorComponents';

<FormWarningAlert
  title="Warning"
  message="This action cannot be undone"
/>
```

### Info/Help Message

```tsx
import { FormInfoAlert } from '@/components/form/FormErrorComponents';

<FormInfoAlert
  title="Did you know?"
  message="You can use keyboard shortcuts to navigate faster"
/>
```

---

## NAV-001: Settings Navigation

### Settings Page with Back Button

```tsx
import { SettingsHeader } from '@/components/navigation/SettingsNavigation';
import { useNavigate } from 'react-router-dom';

export function SettingsPage() {
  const navigate = useNavigate();

  return (
    <>
      <SettingsHeader
        title="Settings"
        subtitle="Manage your account and preferences"
        onBack={() => navigate('/dashboard')}
      />
      
      {/* Your settings content here */}
      <div className="space-y-6">
        <section>
          <h2>Account</h2>
          {/* Account settings */}
        </section>
      </div>
    </>
  );
}
```

### Manual Back Button (Minimal)

```tsx
import { BackButton } from '@/components/navigation/SettingsNavigation';
import { useNavigate } from 'react-router-dom';

export function MyPage() {
  const navigate = useNavigate();

  return (
    <>
      <BackButton 
        onClick={() => navigate(-1)}
        label="Back"
      />
      <h1>Page Title</h1>
    </>
  );
}
```

### Manual Breadcrumb

```tsx
import { Breadcrumb } from '@/components/navigation/SettingsNavigation';
import { useNavigate } from 'react-router-dom';

export function DeepPage() {
  const navigate = useNavigate();

  return (
    <>
      <Breadcrumb items={[
        { label: 'Dashboard', onClick: () => navigate('/') },
        { label: 'Settings', onClick: () => navigate('/settings') },
        { label: 'Advanced', isActive: true },
      ]} />
      {/* Page content */}
    </>
  );
}
```

### Keyboard Escape Support

```tsx
import { useBackNavigation } from '@/components/navigation/SettingsNavigation';
import { useNavigate } from 'react-router-dom';

export function SettingsModal() {
  const navigate = useNavigate();
  
  // User can now press ESC to close
  useBackNavigation(() => navigate(-1));

  return <div>{/* content */}</div>;
}
```

---

## A11Y-001: Accessibility

### Using Enhanced Button (Automatic)

The `EnhancedButton` already includes:
- ✅ Minimum 44x44px size (touch target)
- ✅ Clear focus outline
- ✅ Hover effects with appropriate contrast
- ✅ Disabled state clearly visible

```tsx
// This button automatically meets WCAG 2.1 AA
<EnhancedButton onClick={handleClick}>
  Click Me
</EnhancedButton>
```

### Import Accessibility CSS

```typescript
// In src/main.tsx or index.tsx
import '@/styles/accessibility.css';
```

### Keyboard Navigation Hook

```typescript
// Automatically handles Tab order and focus management
import { useNavigate } from 'react-router-dom';
import { useBackNavigation } from '@/components/navigation/SettingsNavigation';

// ESC key navigates back
useBackNavigation(() => navigate('/'));
```

### Form Labels (Accessibility)

```tsx
// Good: label linked to input
<label htmlFor="email">Email Address</label>
<Input id="email" {...register('email')} />

// With aria-describedby for error
<label htmlFor="phone">Phone</label>
<Input 
  id="phone"
  aria-describedby={errors.phone ? 'phone-error' : undefined}
  {...register('phone')}
/>
<FieldError 
  id="phone-error"
  error={errors.phone?.message}
/>
```

### Test Accessibility (Tools)

```bash
# Check for accessibility issues
npm run test:a11y

# Or manually test:
# 1. Tab through page - verify logical order
# 2. Test with screen reader (NVDA/JAWS/VoiceOver)
# 3. Check 200% zoom readability
# 4. Check color contrast (should be 4.5:1)
```

---

## Combined Example: Form with All Phase 2 Features

```tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { EnhancedButton } from '@/components/ui/button-enhanced';
import { FieldError, FormErrorAlert, FormSuccessAlert } from '@/components/form/FormErrorComponents';
import { debouncer } from '@/lib/requestDebouncer';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// Schema with validation
const leadSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email'),
  phone: z.string().regex(/^\+63|^09/, 'Philippine phone required'),
});

export function CreateLeadForm() {
  const { register, formState: { errors }, handleSubmit } = useForm({
    resolver: zodResolver(leadSchema),
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (data: z.infer<typeof leadSchema>) => {
    setFormError(null);
    setIsSubmitting(true);

    try {
      // RATELIMIT-001: Debounce prevents duplicate submission
      await debouncer.debounce('create-lead', async () => {
        const response = await fetch('/api/leads', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        
        if (!response.ok) throw new Error('Failed to create lead');
        return response.json();
      }, 500);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* FORM-001: Error alerts */}
      {formError && (
        <FormErrorAlert
          title="Could not create lead"
          message={formError}
          onDismiss={() => setFormError(null)}
        />
      )}

      {success && (
        <FormSuccessAlert
          title="Lead Created!"
          message="The new lead has been added successfully"
          onDismiss={() => setSuccess(false)}
        />
      )}

      {/* Name field */}
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" {...register('name')} />
        {/* FORM-001: Field errors with hints */}
        <FieldError error={errors.name?.message} />
      </div>

      {/* Email field */}
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" {...register('email')} />
        <FieldError 
          error={errors.email?.message}
          example="john@example.com"
        />
      </div>

      {/* Phone field */}
      <div>
        <label htmlFor="phone">Phone</label>
        <input id="phone" {...register('phone')} />
        <FieldError 
          error={errors.phone?.message}
          hint="Philippine phone numbers"
          example="+639123456789"
        />
      </div>

      {/* UX-BUTTON-001: Enhanced button with loading state */}
      <EnhancedButton
        type="submit"
        isLoading={isSubmitting}
        loadingText="Creating..."
      >
        Create Lead
      </EnhancedButton>
    </form>
  );
}
```

---

## Test Command Quick Reference

```bash
# Run all Phase 2 tests
npm run test -- src/__tests__/phase2-ux.test.ts

# Run specific test suite
npm run test -- src/__tests__/phase2-ux.test.ts -t "RATELIMIT-001"

# Run with coverage
npm run test -- --coverage src/__tests__/phase2-ux.test.ts

# Watch mode
npm run test -- --watch src/__tests__/phase2-ux.test.ts
```

---

## Import Cheat Sheet

```typescript
// Request Debouncing
import { debouncer, RequestDebouncer } from '@/lib/requestDebouncer';
import { RateLimiter, rateLimiter } from '@/lib/requestDebouncer';

// Buttons
import { EnhancedButton, LoadingButton, DebouncedButton } from '@/components/ui/button-enhanced';

// Form Errors
import {
  FieldError,
  FormErrorAlert,
  FormSuccessAlert,
  FormWarningAlert,
  FormInfoAlert,
} from '@/components/form/FormErrorComponents';

// Navigation
import {
  BackButton,
  Breadcrumb,
  SettingsHeader,
  useBackNavigation,
} from '@/components/navigation/SettingsNavigation';

// Accessibility CSS
import '@/styles/accessibility.css';
```

---

## File Locations Summary

| Feature | File | Export |
|---------|------|--------|
| Debouncing | `src/lib/requestDebouncer.ts` | `debouncer`, `RequestDebouncer` |
| Buttons | `src/components/ui/button-enhanced.tsx` | `EnhancedButton`, `LoadingButton` |
| Form Errors | `src/components/form/FormErrorComponents.tsx` | `FieldError`, `FormErrorAlert` |
| Navigation | `src/components/navigation/SettingsNavigation.tsx` | `BackButton`, `SettingsHeader` |
| Styles | `src/styles/accessibility.css` | (CSS only) |
| Tests | `src/__tests__/phase2-ux.test.ts` | (Test file) |

---

## Common Patterns

### Pattern 1: Form with All Validations

```tsx
<form onSubmit={handleSubmit(onSubmit)}>
  <Input {...register('field')} />
  <FieldError error={errors.field?.message} />
  <EnhancedButton isLoading={isSubmitting} type="submit">
    Save
  </EnhancedButton>
</form>
```

### Pattern 2: Async Button Click

```tsx
const handleClick = async () => {
  const result = await debouncer.debounce('operation', async () => {
    return fetchData();
  }, 500);
};

<EnhancedButton isLoading={loading} onClick={handleClick}>
  Click Me
</EnhancedButton>
```

### Pattern 3: Settings Page

```tsx
<SettingsHeader title="Settings" onBack={() => navigate('/')} />
<div>Settings content...</div>
```

---

**Phase 2 Complete!** Ready for integration into your components.
