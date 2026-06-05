# QUICK START: FEATURE INTEGRATION GUIDE

## Overview
This guide shows how to integrate each of the 4 completed features into your existing pages.

---

## PHASE 1: Quick Actions Menu (Jay)

### Step 1: Add to Lead List Item Component
```tsx
import { LeadQuickActions } from '@/components/sales/LeadQuickActions';

function LeadListItem({ lead }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="flex items-center justify-between p-4 border rounded">
      <div>
        <h3>{lead.name}</h3>
        <p className="text-sm text-slate-600">{lead.company}</p>
      </div>
      
      {/* ADD THIS */}
      <LeadQuickActions 
        leadId={lead.id} 
        leadName={lead.name}
        onActionSuccess={() => setRefreshTrigger(prev => prev + 1)}
      />
    </div>
  );
}
```

### Step 2: Verify Calendar Events
Ensure `calendar_events` table has these columns:
- id (UUID)
- lead_id (UUID)
- organization_id (UUID)
- event_type (call/email/meeting)
- duration (INT)
- notes (TEXT)
- created_at (TIMESTAMP)

**Result:** Right-click context menu appears on lead items with 5 actions

---

## PHASE 2: Deal Value Tracking (Jay)

### Step 1: Create Migration
```sql
ALTER TABLE leads ADD COLUMN deal_value DECIMAL(15,2);
ALTER TABLE leads ADD COLUMN expected_close_date DATE;
ALTER TABLE leads ADD COLUMN deal_stage TEXT CHECK (deal_stage IN ('prospecting','qualification','proposal','negotiation','closed_won','closed_lost'));
ALTER TABLE leads ADD COLUMN deal_probability INT CHECK (deal_probability BETWEEN 0 AND 100) DEFAULT 25;

CREATE INDEX idx_leads_deal_stage ON leads(deal_stage);
CREATE INDEX idx_leads_deal_probability ON leads(deal_probability);
```

### Step 2: Add to Lead Card Component
```tsx
import { DealValueInfo } from '@/components/sales/DealValueInfo';

function LeadCard({ lead }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h2>{lead.name}</h2>
      
      {/* ADD THIS */}
      <DealValueInfo
        leadId={lead.id}
        leadName={lead.name}
        dealValue={lead.deal_value}
        expectedCloseDate={lead.expected_close_date}
        dealStage={lead.deal_stage}
        probability={lead.deal_probability}
        expectedRevenue={(lead.deal_value || 0) * ((lead.deal_probability || 25) / 100)}
        onUpdate={() => setRefreshTrigger(prev => prev + 1)}
      />
    </div>
  );
}
```

### Step 3: Update Lead Query
```tsx
// Your existing query
const { data: leads } = useQuery({
  queryKey: ['jay-leads', organizationId],
  queryFn: async () => {
    const { data } = await supabase
      .from('leads')
      .select('id, name, company, deal_value, expected_close_date, deal_stage, deal_probability')
      .eq('organization_id', organizationId);
    return data;
  }
});
```

**Result:** Deal value cards appear on lead items with edit capability

---

## PHASE 3: Guest Preferences (Cece)

### Step 1: Create Table
```sql
CREATE TABLE guest_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  previous_stay_notes TEXT,
  preferred_room_types TEXT[],
  preferred_configurations JSONB DEFAULT '{}',
  special_requests JSONB[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(guest_id, organization_id)
);

-- RLS Policy
ALTER TABLE guest_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their org's guest preferences"
  ON guest_preferences FOR SELECT
  USING (organization_id = auth.jwt() ->> 'org_id');

CREATE POLICY "Users can update their org's guest preferences"
  ON guest_preferences FOR UPDATE
  USING (organization_id = auth.jwt() ->> 'org_id');

CREATE POLICY "Users can insert their org's guest preferences"
  ON guest_preferences FOR INSERT
  WITH CHECK (organization_id = auth.jwt() ->> 'org_id');
```

### Step 2: Add to Guest/Booking Card
```tsx
import { GuestPreferencesCard } from '@/components/accommodations/GuestPreferencesCard';

function GuestCard({ guest }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Query guest preferences
  const { data: preferences } = useQuery({
    queryKey: ['guest-preferences', guest.id, refreshTrigger],
    queryFn: async () => {
      const { data } = await supabase
        .from('guest_preferences')
        .select('*')
        .eq('guest_id', guest.id)
        .single();
      return data;
    }
  });

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h2>{guest.name}</h2>
      
      {/* ADD THIS */}
      <GuestPreferencesCard
        guestId={guest.id}
        guestName={guest.name}
        preferences={preferences}
        onUpdate={() => setRefreshTrigger(prev => prev + 1)}
      />
    </div>
  );
}
```

**Result:** Guest preference cards appear on guest items with edit capability

---

## PHASE 4: Housekeeping Workflow (Cece)

### Step 1: Create Tables
```sql
CREATE TABLE housekeeping_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT CHECK (priority IN ('low','medium','high','urgent')) DEFAULT 'medium',
  task_type TEXT CHECK (task_type IN ('cleaning','maintenance','inspection','turnover')) DEFAULT 'cleaning',
  status TEXT CHECK (status IN ('pending','in_progress','completed','cancelled')) DEFAULT 'pending',
  assigned_to UUID REFERENCES staff(id),
  assigned_at TIMESTAMP,
  completed_at TIMESTAMP,
  checklist_items JSONB[] DEFAULT '{}',
  estimated_duration INT,
  actual_duration INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE room_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  room_id UUID NOT NULL REFERENCES rooms(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  inspection_type TEXT CHECK (inspection_type IN ('pre_checkin','post_checkout','maintenance','deep_clean')),
  overall_condition TEXT CHECK (overall_condition IN ('excellent','good','fair','poor')),
  issues JSONB[] DEFAULT '{}',
  notes TEXT,
  photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS on both tables
ALTER TABLE housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_inspections ENABLE ROW LEVEL SECURITY;

-- Add similar RLS policies as guest_preferences
```

### Step 2: Add to Property Dashboard
```tsx
import { HousekeepingBoard } from '@/components/accommodations/HousekeepingBoard';

function PropertyDashboard({ propertyId }) {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Query housekeeping tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['housekeeping-tasks', propertyId, refreshTrigger],
    queryFn: async () => {
      const { data } = await supabase
        .from('housekeeping_tasks')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

  const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
    const { error } = await supabase
      .from('housekeeping_tasks')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', taskId);
    
    if (!error) {
      setRefreshTrigger(prev => prev + 1);
    }
  };

  return (
    <div className="space-y-4">
      <h1>Property Dashboard</h1>
      
      {/* ADD THIS */}
      <HousekeepingBoard
        propertyId={propertyId}
        tasks={tasks.map(task => ({
          id: task.id,
          title: task.title,
          taskType: task.task_type,
          priority: task.priority,
          status: task.status,
          roomName: task.room?.name || 'Unknown Room',
          assignedTo: task.assigned_staff?.name,
          estimatedDuration: task.estimated_duration,
          checklist: task.checklist_items
        }))}
        onTaskStatusChange={handleTaskStatusChange}
        onCreateTask={() => setRefreshTrigger(prev => prev + 1)}
      />
    </div>
  );
}
```

**Result:** Housekeeping board with 3 columns appears with task management

---

## INTEGRATION CHECKLIST

### Phase 1: Quick Actions (30 min)
- [x] Import LeadQuickActions component
- [x] Add to lead list/card
- [x] Verify calendar_events table exists
- [x] Test right-click menu
- [ ] Test activity logging
- [ ] Test mark as won/lost

### Phase 2: Deal Tracking (1 hour)
- [x] Create database migration
- [x] Import DealValueInfo component
- [x] Add to lead cards
- [x] Update lead query to include deal columns
- [ ] Test form submission
- [ ] Test revenue calculation

### Phase 3: Guest Preferences (1 hour)
- [x] Create guest_preferences table
- [x] Add RLS policies
- [x] Import GuestPreferencesCard component
- [x] Add to guest/booking cards
- [x] Create guest preferences query
- [ ] Test form submission
- [ ] Test preference display

### Phase 4: Housekeeping (1 hour)
- [x] Create housekeeping_tasks table
- [x] Create room_inspections table
- [x] Add RLS policies
- [x] Import HousekeepingBoard component
- [x] Add to property dashboard
- [x] Create task query
- [ ] Test task creation
- [ ] Test status changes

---

## COMMON ISSUES & FIXES

### Issue: "Cannot find module '@/components/sales/LeadQuickActions'"
**Fix:** Ensure file path is correct relative to src/ directory

### Issue: "Property 'deal_value' does not exist on type 'Lead'"
**Fix:** Ensure database migration ran successfully, restart TypeScript server

### Issue: Dialog doesn't open
**Fix:** Check isOpen prop is passed correctly, verify state management

### Issue: Form doesn't submit
**Fix:** Check network tab, ensure Supabase client is initialized, verify RLS policies

### Issue: "Organization_id is required"
**Fix:** Ensure useAuth() hook is working and profile.organization_id is available

---

## TESTING THE INTEGRATION

### Quick Actions Menu
```
1. Right-click on a lead
2. Click "Create Call"
3. Fill form and submit
4. Verify calendar_events created
5. Check lead timeline
```

### Deal Value Tracking
```
1. Click "Add deal value" on lead card
2. Enter deal amount and stage
3. Set probability to 75%
4. Expected revenue = amount × 0.75
5. Verify overdue alert on old dates
```

### Guest Preferences
```
1. Click "Add guest preferences" on guest card
2. Fill preferences (room type, notes, etc.)
3. Add special requests
4. Submit and verify saved
5. Reopen to verify data persisted
```

### Housekeeping
```
1. Click "New Task" on property
2. Create task with checklist
3. Click "Start" to move to In Progress
4. Click "Complete" to mark done
5. Verify board updates
```

---

## NEXT STEPS

1. **Create tables** - Run SQL migrations
2. **Deploy components** - Integrate into pages
3. **Test integration** - Follow testing checklist
4. **Add RLS policies** - Ensure organization isolation
5. **Go live** - Deploy to production

---

**Estimated Integration Time:** 4-6 hours total
**Estimated Testing Time:** 2-3 hours total
**Estimated Deployment Time:** 1 hour total

**Total to Production:** 7-10 hours from start of integration

---

*For detailed integration examples, see QUICK_REFERENCE_IMPLEMENTATION.md*
