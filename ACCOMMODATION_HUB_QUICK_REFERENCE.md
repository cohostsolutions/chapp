# Accommodation Hub - Quick Reference Guide

## Feature Quick Start

### Batch Operations
1. **Select Bookings:**
   - Click checkbox on booking card
   - Or click "Select All" in toolbar when needed
   - Blue bar shows count

2. **Change Multiple Statuses:**
   - Click "Change Status" button
   - Select new status from dropdown
   - Confirm - all bookings updated with undo

3. **Delete Multiple Bookings:**
   - Select bookings with checkboxes
   - Click "Delete All" button
   - Confirm deletion
   - 10-second undo window

### CSV Export
- Click **Export** button in toolbar
- File downloads as `bookings-YYYY-MM-DD-HHmmss.csv`
- Includes all visible bookings (respects filters)
- Open in Excel for analysis, reports, pivot tables

### Mobile Filters
- Tap **Filter** button on mobile
- Bottom drawer slides up with all options
- Choose date range, status, room, sort
- Tap **Done** to apply
- Tap **Reset** to clear all filters

### Form Validation
- **Create Booking:**
  - Room required
  - Guest name required
  - Check-in and Check-out required
  - Checkout must be after check-in
  - Guest count must be ≥1
  
- **Edit Booking:**
  - Same validation as create
  - Prevents saving incomplete data

### Auto-Features
- ✅ Prices auto-calculated based on room tiers
- ✅ Orphaned leads auto-deleted (no other bookings)
- ✅ External bookings marked read-only (from calendar)
- ✅ Search input debounced (300ms)
- ✅ Overlap detection (prevents double-booking)

---

## New Functions Reference

### Batch Operations
```typescript
toggleBookingSelection(bookingId)      // Add/remove from selection
selectAllVisibleBookings()             // Select all displayed
clearSelection()                       // Deselect all
handleBatchStatusChange()              // Bulk status update with undo
handleBatchDelete()                    // Bulk delete with undo
```

### Validation
```typescript
validateNewBooking(): boolean          // Check new booking form
validateEditBooking(): boolean         // Check edit form
```

### Export
```typescript
exportToCSV()                          // Download bookings as CSV
```

### Performance (Availability)
```typescript
getParsedBookingDates(booking)         // Get cached parsed dates
getNightCount(booking)                 // Calculate nights (cached)
```

---

## File Locations

**Main Component:**
- `src/components/accommodation/BookingsTabContent.tsx`

**Availability Calendar:**
- `src/components/accommodation/AvailabilityTabContent.tsx`

**Data Hook:**
- `src/hooks/useAccommodationData.ts`

---

## UI Components Used

**Batch Operations:**
- Blue selection toolbar
- Checkboxes on cards
- Dialog for status change
- Alert dialog for deletion

**Mobile Filters:**
- Bottom sheet drawer
- Full-width filter panel
- Reset/Done buttons

**Export:**
- Download button in toolbar
- SVG download icon

---

## Performance Tips

1. **Large Datasets (100+ bookings):**
   - Use filters to reduce displayed count
   - Batch operations instead of individual edits
   - Export to Excel for bulk analysis

2. **Mobile Performance:**
   - Dates are memoized (cached)
   - Calendar renders faster
   - Less CPU usage during scrolling

3. **Booking Creation:**
   - Fill required fields first
   - Validation happens automatically
   - Prices calculate on the fly

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Create Booking | `Ctrl/Cmd + B` (when focused) |
| Toggle Filters | Click Filter button |
| Export | Click Export button |
| Select All | Click "Select All" (when visible) |
| Clear Selection | Click "Clear Selection" (when visible) |

---

## Undo Support

**10-Second Undo Window for:**
- Creating bookings
- Editing bookings
- Deleting bookings
- Batch status changes
- Batch deletions (includes lead restoration)

**Access Undo:**
- Keyboard: `Ctrl/Cmd + Z`
- Toast notification button (appears after operation)
- Success message shows undo option

---

## Error Messages & Solutions

| Error | Solution |
|-------|----------|
| "Room not available" | Change dates - booking overlaps another |
| "Invalid dates" | Check-out must be after check-in |
| "Missing required fields" | Fill in room, guest name, dates |
| "Failed to sync calendar" | Booking created, calendar sync optional |
| "Lead has other bookings" | Lead stays if other bookings exist |

---

## Mobile Optimizations

✅ Responsive checkboxes (touch-friendly)
✅ Full-screen filter drawer on mobile
✅ Desktop inline filters remain
✅ Optimized date parsing (memoization)
✅ Smooth scrolling performance

---

## Data Export Fields

CSV includes:
- Guest Name
- Phone
- Email
- Room Name
- Check-in Date
- Check-out Date
- Nights (calculated)
- Guest Count
- Booking Status
- Payment Status
- Total Price
- Notes

---

## Best Practices

1. **Before Bulk Operations:**
   - Apply filters to verify you're selecting the right bookings
   - Review selection count in toolbar

2. **Export Workflow:**
   - Apply date/status filters first
   - Export to get relevant bookings
   - Analyze in Excel pivot tables

3. **Mobile Experience:**
   - Use drawer filters instead of inline
   - Tap Done to apply all filters at once
   - Swipe up on filter button

4. **Data Quality:**
   - Validation prevents incomplete bookings
   - Overlap detection prevents double-booking
   - Lead cleanup prevents database bloat

---

## Common Workflows

### Workflow 1: Confirm 50 Pending Bookings
1. Filter by status: Pending
2. Click "Select All"
3. Click "Change Status"
4. Select "Confirmed"
5. Done! All 50 updated instantly with undo

### Workflow 2: Generate Monthly Report
1. Filter by date: "This Month"
2. Click "Export"
3. Open CSV in Excel
4. Create pivot table / charts

### Workflow 3: Check-in Guests Today
1. Filter by date: "Today"
2. View all arriving bookings
3. Click each to mark "Checked In"
4. Done!

### Workflow 4: Clean Up Cancelled Bookings
1. Filter by status: "Cancelled"
2. Select all
3. Click "Delete All"
4. Confirm
5. Orphaned leads auto-deleted

---

## Support & Resources

**Documentation:**
- [Phase 1 Complete](./ACCOMMODATION_PHASE1_COMPLETE.md) - Critical fixes
- [Phase 2 Complete](./ACCOMMODATION_PHASE2_COMPLETE.md) - Enhancements
- [Full Summary](./ACCOMMODATION_HUB_COMPLETE_SUMMARY.md) - Complete overview

**Key Files:**
- Booking validation: `validateNewBooking()`, `validateEditBooking()`
- Batch operations: `handleBatchStatusChange()`, `handleBatchDelete()`
- Export: `exportToCSV()`
- Overlap detection: `checkBookingOverlap()`

---

## Version History

**Phase 1 (Critical Fixes):** Jan 2026
- Payment status typing
- Overlap validation
- External booking indicators
- Auto pricing
- Lead cleanup
- Calendar sync improvements
- Form validation
- Search debounce

**Phase 2 (Enhancements):** Jan 2026
- Edit mode validation
- Date memoization
- Batch operations
- CSV export
- Mobile filters

---

**Last Updated:** January 2026
**Status:** Production Ready ✅
**Maintained By:** Canvas Capital Team
