# SPRING CLEANING AUDIT MANIFEST
## AlCor Nexus Repository Cleanup
**Date:** January 18, 2026  
**Audit Type:** Comprehensive Codebase Spring Cleaning  
**Status:** ⏳ AWAITING APPROVAL

---

## SUMMARY OF FINDINGS

| Category | Count | Status |
|----------|-------|--------|
| **Zombie Components** | 30 | Ready to move to _deprecated |
| **Debug Console.log** | 402 | Ready to review for cleanup |
| **Placeholder Assets** | 1 | Ready to delete |

**Total Lines of Code Scanned:**
- Components: 312 files
- Backend Functions: 40+ files
- Total Project Size: ~15,000+ files

---

## 1. ZOMBIE COMPONENT HUNT (STEP 1)

### Unused Components Found: 30

These files exist in the codebase but are **NEVER imported** by any other file:

#### Pricing & Sales Components (4 files)
```
src/components/pricing/PlanComparisonTool.tsx        (unused plan comparison)
src/components/ReengageLeadsDialog.tsx               (unused reengage dialog)
src/components/sales/LeadTemperatureTrends.tsx       (duplicate temp tracking)
src/components/LeadTemperatureSummary.tsx            (redundant summary)
```

#### Accommodation & Booking Components (4 files)
```
src/components/accommodation/CreateBookingDialog.tsx     (duplicate booking creation)
src/components/accommodations/GuestPreferencesCard.tsx   (unused guest prefs UI)
src/components/accommodations/HousekeepingBoard.tsx      (unused housekeeping board)
src/components/bookings/LinkGuestConversationDialog.tsx  (unused guest linking)
```

#### Admin & Configuration Components (3 files)
```
src/components/roles/RoleHistoryViewer.tsx          (unused role history viewer)
src/components/operations/AddMaintenanceBlockDialog.tsx  (unused maintenance UI)
src/components/auth/TwoFactorVerifyDialog.tsx       (unused 2FA dialog)
```

#### Data & Reports Components (3 files)
```
src/components/reports/AdvancedCharts.tsx           (unused advanced charting)
src/components/LeadImportExport.tsx                 (unused import/export UI)
src/components/CalendarManager.tsx                  (duplicate calendar manager)
```

#### Shared Utility Components (13 files - mostly UI utilities)
```
src/components/shared/ResponsiveGrid.tsx            (unused responsive grid)
src/components/shared/LazyImage.tsx                 (unused lazy image loader)
src/components/shared/DataList.tsx                  (unused data list wrapper)
src/components/shared/PageWrapper.tsx               (unused page wrapper)
src/components/shared/LoadingStates.tsx             (unused loading state UI)
src/components/shared/OrganizationFilter.tsx        (unused org filter)
src/components/shared/LeadTable.tsx                 (unused lead table)
src/components/shared/FlowFeedback.tsx              (unused flow feedback)
src/components/shared/AccessibleButton.tsx          (unused accessible button)
src/components/shared/OfflineSyncIndicator.tsx      (unused offline sync UI)
src/components/shared/CategoryDraggableGrid.tsx     (unused draggable grid)
src/components/shared/RetryableQuery.tsx            (unused retry wrapper)
src/components/shared/ResponsiveDialog.tsx          (unused responsive dialog)
src/components/shared/AdvancedFilter.tsx            (unused filter component)
```

#### Landing & Demo Components (2 files)
```
src/components/landing/AnimatedChatDemo.tsx         (unused animated chat demo)
src/components/workflows/WorkflowAutomation.tsx     (unused workflow automation)
```

### Action Plan for Zombie Components
```
1. Create _deprecated/components directory
2. Move all 30 unused component files to _deprecated/components/
3. Preserve directory structure (e.g., _deprecated/components/shared/, _deprecated/components/accommodation/)
4. Create _deprecated/ZOMBIE_COMPONENTS_MANIFEST.md for tracking
```

**Estimated Size Reduction:** ~150-200 KB (reduced component bundle)

---

## 2. DEAD CODE SCRUB (STEP 2)

### Console Logging Analysis

**Total console.log Statements Found: 402**

#### Breakdown by Type:
- **Structural Logging** (KEEP): ~350 statements
  - Error logging: `console.error()`
  - Status tracking: `[AI Chat] Request received:`, `[Recurring Expenses]`
  - System events: `Auth error:`, `Welcome email sent`
  - This logging is NECESSARY for debugging production issues

- **Debug/Testing Logging** (REVIEW): ~52 statements
  - Generic info logs that can be removed
  - Mostly in functions like `manage-user`, `login-alert`, `sync-calendar-events`

#### Example Debug Logs (Safe to Remove):
```typescript
// From supabase/functions/manage-user/index.ts:
console.log("Welcome email sent successfully");                    // ← REMOVE
console.log("Auth error:", userError);                            // ← KEEP (error)
console.log("Action:", action, "Params:", JSON.stringify(params)); // ← REMOVE
console.log("User created successfully:", newUser.user.id);       // ← REMOVE
console.log("User updated successfully:", userId);                // ← REMOVE
console.log("User active status updated:", userId, isActive);     // ← REMOVE
console.log("Password reset successfully for user:", userId);     // ← REMOVE
console.log("User deleted successfully:", userId);                // ← REMOVE

// From supabase/functions/login-alert/index.ts:
console.log("Alert email sent:", emailResponse);                  // ← REMOVE

// From supabase/functions/sync-calendar-events/index.ts:
console.log('[Calendar Sync] Starting calendar sync job...');     // ← REMOVE
console.log('[Calendar Sync] Vault encryption:', vaultEnabled ? 'enabled' : 'disabled'); // ← REMOVE
```

#### High-Value Logs (KEEP - Structural):
```typescript
// These provide essential diagnostic information
console.error('Error processing booking:', e);                    // ← KEEP
console.log(`[AI Safety] Lead ${leadId} AI check passed`);       // ← KEEP
console.log(`Rate limit exceeded for user ${userId}`);            // ← KEEP
console.log(`[Recurring Expenses] Created instance for ${id}`);   // ← KEEP (status tracking)
```

### Commented-Out Code Analysis
**Status:** ✅ **CLEAN** - No significant commented-out code blocks found

The codebase is well-maintained with minimal commented code. Git history is being used instead.

### Dead Code Cleanup Action Plan

**Phase 1: Safe Removals** (No impact on functionality)
```bash
# Remove ~50 generic "success" logging statements
# Remove ~15 "action completed" logs
# Total: ~65 lines of debug logging to delete
```

**Phase 2: Keep Structural Logging**
```bash
# Retain all console.error() calls
# Retain all tagged logs: [AI Chat], [Recurring], [Calendar Sync], etc.
# Retain all business-logic status tracking
```

**Estimated Impact:** 50-100 line reduction per file, cleaner production logs

---

## 3. ASSET OPTIMIZATION (STEP 3)

### Placeholder & Unused Assets Found: 1

```
public/placeholder.svg  (3.2 KB)
```

**Details:**
- **File:** `public/placeholder.svg`
- **Size:** 3.2 KB
- **Purpose:** SVG placeholder image (likely used for testing)
- **Status:** Not referenced in any CSS, HTML, or component imports

**Question for You:**
- Is this placeholder still needed for:
  - UI development/testing?
  - Default fallback images?
  - Component Storybook stories?

**If NO longer needed:**
```bash
# Action: Move to _deprecated/assets/
rm public/placeholder.svg
# Or archive: mv public/placeholder.svg _deprecated/assets/
```

**Verified Logo Assets (KEEP):**
```
✅ public/og-image.png              (OG meta tag)
✅ public/alcor-logo.png            (Brand logo)
✅ public/pwa-192x192.png           (PWA icon)
✅ public/pwa-512x512.png           (PWA icon)
✅ public/favicon.png               (Favicon)
✅ public/AlCor Favicon/             (Favicon set)
✅ public/lovable-uploads/           (User-uploaded assets - KEEP)
```

---

## CLEANUP EXECUTION PLAN

### Step A: Create Deprecated Directory Structure
```bash
mkdir -p _deprecated
mkdir -p _deprecated/components
mkdir -p _deprecated/components/accommodation
mkdir -p _deprecated/components/accommodations
mkdir -p _deprecated/components/auth
mkdir -p _deprecated/components/bookings
mkdir -p _deprecated/components/landing
mkdir -p _deprecated/components/operations
mkdir -p _deprecated/components/pricing
mkdir -p _deprecated/components/reports
mkdir -p _deprecated/components/roles
mkdir -p _deprecated/components/shared
mkdir -p _deprecated/components/workflows
mkdir -p _deprecated/assets
```

### Step B: Move Zombie Components
```bash
# Move all 30 unused components to _deprecated
# Preserves git history and allows easy restoration
mv src/components/pricing/PlanComparisonTool.tsx _deprecated/components/pricing/
mv src/components/roles/RoleHistoryViewer.tsx _deprecated/components/roles/
# ... etc for all 30 files
```

### Step C: Clean Debug Logging
```bash
# Remove ~65 lines of debug console.log statements from backend functions
# Keep all console.error() and structural logging
# Files affected:
#   - supabase/functions/manage-user/index.ts
#   - supabase/functions/login-alert/index.ts
#   - supabase/functions/sync-calendar-events/index.ts
#   - etc.
```

### Step D: Handle Placeholder Assets
```bash
# Decision: Awaiting your approval
# Option 1: Delete (if not used)
# Option 2: Move to _deprecated/assets/
# Option 3: Keep (if used for testing)
```

---

## MANIFEST CHECKLIST

### ✅ AUDIT COMPLETE
- [x] Scanned all 312 component files
- [x] Identified 30 unused components (never imported)
- [x] Analyzed 40+ backend edge functions
- [x] Found 402 console.log statements (mostly structural)
- [x] Located 1 placeholder asset
- [x] Verified zero commented-out code blocks
- [x] Created safety plan (move to _deprecated, not delete)

### ⏳ AWAITING APPROVAL
- [ ] Approve zombie component deprecation
- [ ] Confirm debug logging cleanup scope
- [ ] Decide on placeholder.svg handling
- [ ] Authorize execution of cleanup

---

## EXPECTED BENEFITS

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Component Files** | 312 | 282 | -30 (9.6%) |
| **Unused Code** | Present | Cleaned | Faster builds |
| **Debug Clutter** | 402 logs | ~350 logs | Cleaner output |
| **Build Size** | Baseline | -150-200KB | 2-3% reduction |
| **Maintainability** | Good | Excellent | Easier navigation |

---

## SAFETY MEASURES IN PLACE

✅ **No Immediate Deletions**
- All unused files moved to `_deprecated/` folder
- Original git history preserved
- Easy restoration if any issues arise

✅ **Version Control**
- All changes tracked in git
- Single commit for entire cleanup
- Easy rollback if needed

✅ **Backup Strategy**
- `_deprecated/` folder serves as recovery point
- Can restore individual files if needed
- Keeps team confidence high

---

## FILES READY FOR YOUR DECISION

**Ready to Move to _deprecated:**
```
30 zombie components
1 placeholder asset
~65 debug log lines (identified)
```

**Ready to Keep:**
```
All UI component library files (/components/ui/)
All functional components in use
All structural logging
All verified assets
```

---

## NEXT STEPS

### 1. Review This Manifest
Please review the list of unused components and placeholder assets.

### 2. Provide Approval
Give me a signal:
```
"APPROVE" → Execute the cleanup immediately
"REVIEW" → You want to manually verify specific files first
"MODIFY" → You'd like to adjust the criteria
```

### 3. Execute Cleanup
Once approved, I will:
1. Create _deprecated directory structure
2. Move all zombie components
3. Remove identified debug logging
4. Handle placeholder assets per your decision
5. Create tracking document in _deprecated/
6. Commit everything with clear messages

---

## ESTIMATED CLEANUP TIME

- **Phase 1 (File Moves):** 2-3 minutes
- **Phase 2 (Debug Logging):** 5-7 minutes
- **Phase 3 (Asset Cleanup):** 1 minute
- **Phase 4 (Testing/Verification):** 10-15 minutes
- **Total:** ~20-25 minutes

**Build Test Required After Cleanup:** ~5 minutes

---

## QUESTIONS FOR YOU

### 1. Zombie Components
✅ OK to move all 30 unused components to _deprecated?
- Any you want to keep in src/?
- Any you want to delete instead?

### 2. Debug Logging
✅ OK to remove ~65 debug "success" logs?
- Should I be more aggressive (remove ALL non-error logs)?
- Should I be more conservative (keep current state)?

### 3. Placeholder Asset
❓ What to do with `public/placeholder.svg`?
- Delete it?
- Move to _deprecated/assets/?
- Keep it for testing?

---

**Status:** ⏳ **AWAITING YOUR APPROVAL**

Please provide:
1. Approval/Changes for zombie components
2. Approval for debug logging cleanup scope
3. Decision on placeholder.svg

Once I have your signal, I'll execute the complete spring cleaning immediately.
