# Manual Status Change: Universal Feature for All Organizations

## Overview

The **'new' status is available as a manual option for changing lead status across ALL organizations** (Jay, Cece, May). This feature complements the auto-revert system for Cece and May, allowing users to manually reset leads to the 'new' status at any time through two different interfaces.

## Feature Details

### Available Status Options

All leads can be manually changed to any of these statuses:
- **new** - Lead just added to system
- **contacted** - Lead has been contacted
- **qualified** - Lead meets qualification criteria
- **converted** - Lead has completed the conversion (booking/order)
- **lost** - Lead is no longer interested

### Implementation Status

✅ **FULLY IMPLEMENTED** - Manual status changes work identically across all organization types:
- Jay (Sales organization)
- Cece (Accommodation)
- May (Food/Orders)

## User Interface Methods

### Method 1: Lead Info Dialog (Status Dropdown)

**Where:** Lead detail panel / Lead information dialog

**How to use:**
1. Click on any lead card to open the Lead Info Dialog
2. In the Information tab, click the "Edit" button (pencil icon)
3. The Status field becomes editable with a dropdown
4. Select **'new'** from the dropdown menu
5. Click the "Save" button (checkmark icon)
6. Status updates immediately with confirmation toast

**Code Location:** [src/components/LeadInfoDialog.tsx](src/components/LeadInfoDialog.tsx#L654-L667)

**Implementation Details:**
```tsx
// Available status options defined at line ~64
const statusOptions = ['new', 'contacted', 'qualified', 'converted', 'lost'];

// Status change handler at line ~544-584
const handleStatusChange = async (newStatus: string) => {
  try {
    // For real leads (UUIDs > 10 chars), update database
    const leadIdStr = String(lead.id);
    if (leadIdStr.length > 10) {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus as 'new' | 'contacted' | 'qualified' | 'converted' | 'lost' })
        .eq('id', leadIdStr);
      if (error) throw error;
    }
    
    // Update UI and log activity
    toast({
      title: "Status Updated",
      description: `Lead status changed to ${newStatus}`,
    });
  }
};

// UI rendering at line ~654-667
<Select
  value={editedLead?.status || ''}
  onValueChange={(value) => setEditedLead(prev => prev ? { ...prev, status: value } : null)}
>
  <SelectTrigger className="w-[140px]">
    <SelectValue placeholder="Status" />
  </SelectTrigger>
  <SelectContent>
    {statusOptions.map((status) => (
      <SelectItem key={status} value={status}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Method 2: Kanban Board (Drag & Drop)

**Where:** Leads page, Kanban board view

**How to use:**
1. Navigate to the Leads management page
2. View leads organized in 5 columns by status: New | Contacted | Qualified | Converted | Lost
3. To move a lead to the 'new' status:
   - Desktop: Click the lead card to "arm" it for dragging, then drag to the 'New' column
   - Mobile: Double-tap a lead card to enable drag, then drag to the target column (swipe horizontally to see all columns)
4. Release/drop the lead in the 'New' column
5. Status updates automatically

**User Feedback:**
- Desktop: "Drag to move • Double-tap/click again to cancel" message appears when card is armed
- Mobile: "Double-tap a card to enable drag • Swipe to see more columns"
- Hover effect shows grip icon when ready to drag
- Ring highlight indicates armed/active state

**Code Location:** [src/components/leads/LeadKanbanBoard.tsx](src/components/leads/LeadKanbanBoard.tsx#L39-L57)

**Implementation Details:**
```tsx
// Status columns definition at line ~39-57
const statusColumns: StatusColumn[] = [
  {
    id: 'new',
    label: 'New',
    color: 'text-primary',
    bgColor: 'bg-primary/10 border-primary/30',
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    id: 'contacted',
    label: 'Contacted',
    color: 'text-warning',
    bgColor: 'bg-warning/10 border-warning/30',
    icon: <Phone className="w-4 h-4" />,
  },
  // ... other statuses ...
];

// Drag end handler at line ~326-339
const handleDragEnd = (event: DragEndEvent) => {
  const leadId = String(event.active.id);
  const targetStatus = event.over ? String(event.over.id) : null;

  if (targetStatus) {
    const lead = leads.find((l) => l.id === leadId);
    if (lead && lead.status !== targetStatus && !isUpdating) {
      onStatusChange(leadId, targetStatus);  // Calls parent handler
    }
  }

  setActiveLeadId(null);
  setArmedLeadId(null);
};
```

**Features:**
- Double-click to arm for dragging (prevents accidental moves)
- Smooth animations for card movement
- Visual feedback with ring highlight when armed
- ScrollArea with auto-scroll buttons on desktop
- Responsive design for mobile (swipe to see more columns)
- "No leads" placeholder for empty columns (hidden on mobile)
- Accessibility: ARIA live region updates for screenreaders

## Database Implementation

### Table Structure

**leads table** - Schema includes:
```sql
id UUID PRIMARY KEY
name VARCHAR
email VARCHAR
phone VARCHAR
status VARCHAR ('new' | 'contacted' | 'qualified' | 'converted' | 'lost')
source VARCHAR
notes TEXT
created_at TIMESTAMP
updated_at TIMESTAMP (auto-updated)
-- ... other fields
```

### Update Operation

Manual status changes execute as a simple UPDATE query:
```sql
UPDATE leads 
SET status = 'new' 
WHERE id = '[lead_id]'
```

### Audit Trail

Each status change is logged in the activity history:
- Activity type: `status_change`
- Description: "Status changed from \"[old_status]\" to \"[new_status]\""
- Timestamp: Automatic
- Visible in: Lead Info Dialog → Activity tab

## Relationship to Auto-Revert System

### For Cece (Accommodation)
- **Auto-revert:** If a booking hasn't been checked in after 1 day (grace period), it's deleted and lead status auto-reverts to 'new'
- **Manual change:** Users can also manually change any lead status to 'new' at any time via dropdown or kanban board

### For May (Food/Orders)
- **Auto-revert:** If an order hasn't been picked up after 1 day (grace period), it's deleted and lead status auto-reverts to 'new'
- **Manual change:** Users can also manually change any lead status to 'new' at any time via dropdown or kanban board

### For Jay (Sales)
- **Auto-revert:** Not applicable (no expiring pending items)
- **Manual change:** Users can change lead status to 'new' to reset sales pipeline anytime

## Technical Specifications

### Status Change Restrictions
- ✅ No org-type restrictions - works the same for Jay, Cece, May
- ✅ No RLS (Row Level Security) restrictions on status updates
- ✅ Works on both real leads (UUIDs) and temporary leads (short IDs)
- ✅ Automatic database timestamp update via `updated_at` trigger

### Validation & Error Handling

**Valid status values:**
- Only the 5 predefined statuses are accepted
- UI prevents invalid values through Select dropdown

**Error scenarios:**
- Database error: Toast notification "Failed to update status" with error logged to console
- Lead not found: Update silently fails (no error shown to prevent confusion)
- Network error: Same error handling as database error

### Activity Logging

Each manual status change creates an activity entry:
```tsx
const statusChangeActivity: ActivityItem = {
  id: `status-${Date.now()}`,
  type: 'status_change',
  description: `Status changed from "${lead.status}" to "${newStatus}"`,
  timestamp: new Date().toISOString(),
};
setActivity(prev => [statusChangeActivity, ...prev]);
```

## Usage Examples

### Scenario 1: Resetting a Lost Lead to New
1. Open Lead Info Dialog for "Ahmed Hassan"
2. Status currently shows "lost"
3. Click Edit button
4. Click Status dropdown, select "new"
5. Click Save
6. Status changes to "new" immediately
7. Activity log shows: "Status changed from \"lost\" to \"new\""

### Scenario 2: Organizing Leads with Kanban Board
1. View Leads page with Kanban board
2. See 15 leads distributed across 5 status columns
3. Want to reset "Sarah Cooper" from "qualified" to "new" for re-qualification
4. On desktop: Click "Sarah Cooper" card to arm, drag to "New" column, release
5. Card animates to "New" column
6. Status persists after page reload

### Scenario 3: Mobile Lead Management
1. View Leads on mobile device
2. See only "New", "Contacted", "Qualified" columns (others below)
3. Want to move a lead to "New"
4. Double-tap lead card to enable drag (arms for dragging)
5. Drag card to "New" column
6. Single-tap same card to open details
7. Status updates visible in activity feed

## Browser & Platform Support

- ✅ Desktop (Chrome, Firefox, Safari, Edge)
- ✅ Tablet (iPad, Android tablets)
- ✅ Mobile (iOS, Android phones)
- ✅ Touch devices (drag-and-drop adapted for touch)
- ✅ Keyboard accessible (Select dropdown works with keyboard)

## Performance Considerations

- **Instant UI feedback:** Status changes update immediately in UI
- **Database persistence:** Changes saved to database asynchronously
- **Optimistic updates:** UI updates before database confirm
- **No bulk operations:** Each lead status change is a single operation
- **Scalability:** Works with leads list of any size (Kanban board uses virtualization for performance)

## Accessibility & Assistive Technology

- ✅ ARIA labels on status select dropdowns
- ✅ Screen reader announces "Status updated" toast
- ✅ ARIA live region announces drag status
- ✅ Keyboard navigation: Tab through fields, Enter to save
- ✅ Focus indicators visible on dropdown menus

## File References

**Core Components:**
- [src/components/LeadInfoDialog.tsx](src/components/LeadInfoDialog.tsx) - Manual status change via dropdown (lines 654-667)
- [src/components/leads/LeadKanbanBoard.tsx](src/components/leads/LeadKanbanBoard.tsx) - Drag-and-drop status changes (all status columns include 'new')

**Related Documentation:**
- [AUTO_REVERT_EXPIRED_PENDING.md](AUTO_REVERT_EXPIRED_PENDING.md) - Automatic status revert system
- [LEAD_STATUS_ORGANIZATION_CHANGES_SUMMARY.md](LEAD_STATUS_ORGANIZATION_CHANGES_SUMMARY.md) - Organization-specific behavior summary
- [CONVERSATION_CARD_OVERFLOW_FIX.md](CONVERSATION_CARD_OVERFLOW_FIX.md) - UI improvements to conversation cards

## Summary

The 'new' status is a **universal feature** available for manual status changes across all organizations:
- **Two UI methods:** Dropdown menu (precise) and Kanban board (visual)
- **Works everywhere:** Jay, Cece, May organizations
- **Complements auto-revert:** Cece and May have both auto-revert AND manual change capabilities
- **Fully implemented:** No pending work, no known issues
- **Well-documented:** Error handling, activity logging, accessibility all included
