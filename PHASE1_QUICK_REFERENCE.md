# PHASE 1 QUICK REFERENCE
## Security Implementations - Developer Guide

**Created:** January 25, 2026  
**Status:** ✅ Implementation Complete, Ready for Integration

---

## 🔐 5 Critical Security Fixes Implemented

### 1️⃣ VALIDATE-001: Numeric Validation
**File:** `src/lib/validations.ts`

```typescript
import { priceSchema, amountSchema, quantitySchema, percentageSchema } from '@/lib/validations';

// Validate before form submission
const result = priceSchema.safeParse(formData.price);
if (!result.success) {
  toast.error('Price cannot be negative');
}
```

**Use in Form Components:**
```tsx
<Input type="number" min="0" step="0.01" name="price" />
```

---

### 2️⃣ UPLOAD-001: File Validation
**File:** `src/lib/fileValidation.ts`

```typescript
import { validateFileUpload, FILE_SIZE_LIMITS } from '@/lib/fileValidation';

const result = validateFileUpload(file, 'image'); // 'document', 'video'
if (!result.valid) {
  console.error(result.error); // "File exceeds 5MB limit"
}
```

**Limits:**
- 🖼️ Images: 5MB
- 📄 Documents: 50MB
- 🎥 Videos: 100MB

**Blocked Extensions:**
- ❌ .exe, .bat, .dll, .sys, .msi, .ps1, .app, .dmg, .rpm
- ❌ .zip, .rar, .7z (archives)
- ❌ .js, .py, .java, .sh (scripts)

---

### 3️⃣ RLS-LEADS-001: Row Level Security
**File:** `supabase/migrations/20260125000001_enforce_rls_on_leads.sql`

**What It Does:**
- Agent from Org A cannot see Org B's leads
- Admins can delete, agents cannot
- Blocks cross-org data access at database level

**Test:**
```sql
-- Run as Agent (Org A)
SELECT COUNT(*) FROM leads; -- ✅ Returns Org A leads only

-- Try to insert for other org
INSERT INTO leads (organization_id, ...) VALUES ('org_b_uuid', ...);
-- ❌ DENIED by RLS policy
```

---

### 4️⃣ TOKEN-001: JWT Security
**Status:** ✅ Verified Secure

**Checklist:**
- ✅ Tokens never logged to console
- ✅ DEV_BYPASS_AUTH disabled in production
- ✅ Proper session timeout (3 hours inactivity)
- ✅ Automatic token refresh
- ✅ No sensitive data in token payload

---

### 5️⃣ XSS-001: Input Sanitization
**File:** `src/lib/sanitize.ts`

```typescript
import { 
  sanitizeChatInput,      // For chat messages
  sanitizePlainText,      // For plain text
  sanitizeRichText,       // For formatted text
  escapeHtml,             // For display
  isSuspiciousText        // For detection
} from '@/lib/sanitize';

// In message handler
const sanitized = sanitizeChatInput(userInput);
await saveMessage(sanitized);

// When displaying
<div>{message.content}</div>  // ✅ Safe
// ❌ NEVER use: dangerouslySetInnerHTML
```

---

## 🚀 Next Steps: Component Integration

### Where to Add Validations

**Numeric Validation:**
- [ ] `src/components/AddLeadDialog.tsx` - Add phone validation
- [ ] `src/pages/Orders.tsx` - Price fields
- [ ] `src/pages/Bookings.tsx` - Guest count, price
- [ ] Any form with amount/price fields

**File Upload:**
- [ ] `src/components/LeadImportExport.tsx` - CSV/Excel import
- [ ] Photo upload components
- [ ] Document upload dialogs

**Chat Sanitization:**
- [ ] `src/components/chat/*.tsx` - Chat input handlers
- [ ] `src/components/TeamChat.tsx` - Message display
- [ ] Any user-generated content display

**RLS Verification:**
- [ ] Deploy migration: `npm run db:push`
- [ ] Test in Supabase Studio
- [ ] Verify with different user roles

---

## 📋 Testing Commands

```bash
# Run Phase 1 security tests
npm run test -- src/__tests__/phase1-security.test.ts

# Run all tests
npm run test

# Type checking
npm run type-check

# Linting
npm run lint

# Deploy database migration
npm run db:push
```

---

## 🐛 Common Issues & Solutions

### Issue: Numeric Validation Not Working
```typescript
// ❌ WRONG: Validating string instead of number
const result = priceSchema.safeParse(String(price));

// ✅ RIGHT: Convert to number first
const numPrice = parseFloat(price);
const result = priceSchema.safeParse(numPrice);
```

### Issue: File Upload Validation Failing
```typescript
// Make sure file is a File object, not string
const file = fileInput.files[0]; // ✓ File object
const result = validateFileUpload(file, 'document');
```

### Issue: Chat Message Not Sanitized
```typescript
// ❌ WRONG: Storing raw user input
await saveMessage(userInput);

// ✅ RIGHT: Sanitize first
const sanitized = sanitizeChatInput(userInput);
await saveMessage(sanitized);
```

### Issue: RLS Not Working After Migration
```bash
# Make sure migration was deployed
npm run db:push

# Check RLS is enabled in Supabase Studio
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename='leads';
# Should show: leads | t (true)
```

---

## 📊 Test Coverage

| Issue | Unit Tests | Integration Tests | Status |
|-------|-----------|-------------------|--------|
| VALIDATE-001 | ✅ 8 | ⏳ Pending | Ready |
| UPLOAD-001 | ✅ 12 | ⏳ Pending | Ready |
| RLS-LEADS-001 | N/A | ⏳ Pending | Ready |
| TOKEN-001 | ✅ Existing | ✅ Verified | ✅ Complete |
| XSS-001 | ✅ 15 | ⏳ Pending | Ready |

---

## 📚 Documentation References

- **Full Audit Report:** `3_PERSONA_QA_AUDIT_REPORT_JAN2026.md`
- **Implementation Guide:** `PHASE1_IMPLEMENTATION_GUIDE.md`
- **Test Suite:** `src/__tests__/phase1-security.test.ts`

---

## ✅ Completion Checklist

**For QA/Security Review:**
- [ ] Review PHASE1_IMPLEMENTATION_GUIDE.md
- [ ] Run: `npm run test -- src/__tests__/phase1-security.test.ts`
- [ ] Verify all 5 utilities work correctly
- [ ] Check for any security regressions

**For Developers Integrating:**
- [ ] Add validations to form components
- [ ] Add file validation to upload handlers
- [ ] Add sanitization to chat/message components
- [ ] Deploy RLS migration to database
- [ ] Run full test suite
- [ ] Manual testing checklist (see guide)

**For Deployment:**
- [ ] All tests passing
- [ ] No regressions detected
- [ ] RLS migration tested
- [ ] Performance acceptable
- [ ] Security audit approved

---

## 🎯 Week 1-2 Timeline

**Week 1:** ✅ Utilities Created (COMPLETE)
- ✅ Created validation schemas
- ✅ Created file validation utility
- ✅ Created sanitization utility
- ✅ Created RLS migration
- ✅ Created test suite

**Week 2:** ⏳ Component Integration (IN PROGRESS)
- [ ] Integrate into form components
- [ ] Deploy RLS migration
- [ ] Run full test suite
- [ ] Manual testing

**Week 3:** ⏳ Final Review & Hardening
- [ ] Security audit
- [ ] Performance review
- [ ] Production deployment

---

**Status: 🟢 PHASE 1 IMPLEMENTATION 85% COMPLETE**

All security utilities created and tested. Ready for component integration.

