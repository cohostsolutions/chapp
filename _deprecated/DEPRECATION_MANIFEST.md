# Deprecated Components Manifest

**Date Deprecated:** January 18, 2026  
**Last Updated:** January 18, 2026 (Restoration of accommodation components)  
**Migration Reason:** Spring Cleaning - Removal of unused zombie components  
**Status:** ✅ All remaining components verified safe for removal (0 active imports)

---

## Summary

**Total Components in Deprecation:** 21 unused components  
**Total Size Reduction:** ~130 KB  
**Build Status:** ✅ PASSED - No breaking changes

**Components Restored to src/:** 4 accommodation components identified as Phase 3 enhancement patterns

### Components Restored from Deprecation (4 files)

Restored on Jan 18, 2026 for Phase 3 enhancement development:

1. **accommodation/CreateBookingDialog.tsx** - Booking creation dialog pattern
2. **accommodations/GuestPreferencesCard.tsx** - Guest preferences UI component
3. **accommodations/HousekeepingBoard.tsx** - Housekeeping management board
4. **bookings/LinkGuestConversationDialog.tsx** - Guest conversation linking UI

**Reason for Restoration:** Comprehensive audit confirmed these are legitimate design patterns and UX approaches for accommodation hub Phase 3 features. While not currently integrated, they represent valid enhancement patterns for future booking management improvements.

### Components Excluded from Removal (Kept in src/)

The following 4 components are documented planned enhancements:

1. **RoleHistoryViewer.tsx** - Role hierarchy audit viewer (ROLE_HIERARCHY_USAGE_GUIDE.md)
2. **ReengageLeadsDialog.tsx** - AI re-engagement manager (AI_COMMUNICATION_ANALYSIS.md)
3. **LeadImportExport.tsx** - Bulk lead import/export (TESTING_SETUP.md)
4. **AdvancedFilter.tsx** - Advanced filtering (Improvements documentation)

Additionally, **ResponsiveDialog.tsx** was kept in src/components/shared/ despite being included in the initial audit because it has 15+ active imports throughout the codebase.

---

## Deprecated Components List (21 Total)

### Shared Utilities (12 files)
- `shared/AccessibleButton.tsx` - Unused accessible button wrapper
- `shared/CategoryDraggableGrid.tsx` - Unused draggable grid component
- `shared/DataList.tsx` - Unused data list wrapper
- `shared/FlowFeedback.tsx` - Unused flow feedback UI
- `shared/LazyImage.tsx` - Unused lazy image loader
- `shared/LeadTable.tsx` - Unused lead table component
- `shared/LoadingStates.tsx` - Unused loading state UI
- `shared/OfflineSyncIndicator.tsx` - Unused offline sync indicator
- `shared/OrganizationFilter.tsx` - Unused organization filter
- `shared/PageWrapper.tsx` - Unused page wrapper utility
- `shared/ResponsiveGrid.tsx` - Unused responsive grid layout
- `shared/RetryableQuery.tsx` - Unused retry wrapper component

### Operations & Admin (3 files)
- `auth/TwoFactorVerifyDialog.tsx` - Unused 2FA dialog (referenced in auth audit but not implemented)
- `operations/AddMaintenanceBlockDialog.tsx` - Unused maintenance block dialog
- `workflows/WorkflowAutomation.tsx` - Unused workflow automation (referenced in guides but not implemented)

### Sales & Reporting (3 files)
- `pricing/PlanComparisonTool.tsx` - Unused plan comparison tool
- `reports/AdvancedCharts.tsx` - Unused advanced charting component
- `sales/LeadTemperatureTrends.tsx` - Duplicate temperature tracking component

### Miscellaneous (3 files)
- `AnimatedChatDemo.tsx` - Unused animated chat demo
- `CalendarManager.tsx` - Duplicate calendar manager (CalendarGrid.tsx is active)
- `LeadTemperatureSummary.tsx` - Redundant temperature summary (duplicate)

---

## Verification Summary

### Initial Audit (25 Components Identified)
- ✅ All 25 components verified with **0 active imports**
- ✅ Cross-referenced against **7+ enhancement documentation files**
- ✅ Identified 4 accommodation components as legitimate Phase 3 patterns
- ✅ Build tested successfully after initial migration

### Comprehensive Enhancement Audit
- ✅ Scanned all 25 deprecated components against ALL enhancement docs
- ✅ Found **0 planned features** marked as "to implement" in phases
- ✅ Confirmed 4 accommodation components as valid design patterns for Phase 3
- ✅ Verified remaining 21 components are documentation examples only

### Post-Restoration Audit
- ✅ Restored 4 accommodation components to src/ for Phase 3 development
- ✅ Full build test passed with restored components (`npm run build`)
- ✅ Git history preserved for both deprecation and restoration
- ✅ Remaining 21 components safely archived in _deprecated with clear audit trail
- ✅ No breaking imports in active codebase
- ✅ Git history preserved with `git mv` operations

---

## Revival Instructions

If a deprecated component needs to be reactivated:

```bash
# Restore component back to src/
git mv _deprecated/components/CATEGORY/ComponentName.tsx src/components/CATEGORY/ComponentName.tsx

# Update imports if necessary
# Run: npm run build to verify no issues
```

---

## Cleanup Statistics

| Metric | Count |
|--------|-------|
| Components Initially Identified | 30 |
| Components Moved to _deprecated | 25 |
| Components Restored to src/ | 4 |
| Final Count in _deprecated | 21 |
| Components Excluded (Planned Features) | 4 |
| Total Size Reduction | ~130 KB |
| Active Imports Found in Deprecated | 0 |
| Enhancement Conflicts | 0 |
| Build Status | ✅ PASS |

---

## Audit Trail

- **Initial Audit:** Identified 30 unused components from 312 total
- **Enhancement Review:** Excluded 4 components as planned features
- **Build Validation:** Found 1 false positive (ResponsiveDialog)
- **Final Count:** 25 safe components verified and moved
- **Build Test:** ✅ Passed with zero errors

