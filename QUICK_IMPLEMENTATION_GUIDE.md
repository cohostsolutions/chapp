# Quick Implementation Guide - Industry-Specific Features

**Date**: January 17, 2026  
**Target Audience**: Development Team  
**Time to Implement**: Varies by feature (2 hours - 2 weeks)

---

## 🎯 Quick Wins (2-4 hours each)

### Jay: Add Offering Count Badge to Sales List

**File to Modify**: [src/components/sales/LeadsTabContent.tsx](src/components/sales/LeadsTabContent.tsx)

**Step 1**: Update the query to fetch offering count
```typescript
// In useSalesData.ts, update the leads query
const { data } = await supabase
  .from('leads')
  .select(`
    *,
    lead_offerings(count)
  `)
  .eq('organization_id', profile.organization_id);
```

**Step 2**: Add badge to lead card
```tsx
<div className="flex items-center gap-2">
  {lead.lead_offerings && (
    <Badge variant="outline" className="text-xs">
      {lead.lead_offerings.length} {lead.lead_offerings.length === 1 ? 'offering' : 'offerings'}
    </Badge>
  )}
</div>
```

**Expected Time**: 30 minutes  
**Complexity**: Low  
**User Value**: High (quick visual reference)

---

### May: Add Menu Item Selector Instead of Free Text

**File to Modify**: [src/components/restaurant/OrdersTabContent.tsx](src/components/restaurant/OrdersTabContent.tsx)

**Step 1**: Replace text area with multi-select
```tsx
// OLD
<Textarea
  id="items"
  placeholder="e.g. 2x Burger, 1x Fries"
  value={newOrder.items}
  onChange={(e) => setNewOrder(prev => ({ ...prev, items: e.target.value }))}
/>

// NEW
const [selectedItems, setSelectedItems] = useState<{ [key: string]: number }>({});

<div className="space-y-3 max-h-[200px] overflow-y-auto border rounded-lg p-3">
  {items.map(item => (
    <div key={item.id} className="flex items-center justify-between p-2">
      <div className="flex-1">
        <div className="font-medium">{item.title}</div>
        <div className="text-sm text-muted-foreground">₱{item.price}</div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => removeItem(item.id)}
        >
          −
        </Button>
        <span className="w-6 text-center">{selectedItems[item.id] || 0}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => addItem(item.id)}
        >
          +
        </Button>
      </div>
    </div>
  ))}
</div>
```

**Step 2**: Update order creation to use menu items
```typescript
const orderItems = Object.entries(selectedItems)
  .map(([itemId, quantity]) => {
    const item = items.find(i => i.id === itemId);
    return {
      id: itemId,
      name: item?.title,
      quantity,
      price: item?.price || 0,
    };
  });
```

**Expected Time**: 2 hours  
**Complexity**: Medium  
**User Value**: High (better UX, auto-pricing)

---

### Cece: Add Guest Count to Room Capacity Validation

**File to Modify**: [src/components/accommodation/AvailabilityTabContent.tsx](src/components/accommodation/AvailabilityTabContent.tsx)

**Step 1**: Add guest count to validation
```typescript
const validateBooking = () => {
  // Existing checks...
  
  // New: Check capacity
  if (newBooking.guestCount > room.capacity) {
    toast({
      title: 'Room Capacity Exceeded',
      description: `Room capacity is ${room.capacity} guests`,
      variant: 'destructive',
    });
    return false;
  }
  return true;
};
```

**Expected Time**: 30 minutes  
**Complexity**: Low  
**User Value**: Medium (prevents overbooking)

---

## 🔧 Medium Complexity (4-8 hours)

### Jay: Add "Last Contact" Tracking

**Files to Create/Modify**:
- Create `src/types/sales.ts` - New file
- Modify [src/components/sales/LeadsTabContent.tsx](src/components/sales/LeadsTabContent.tsx)

**Step 1**: Create type definitions
```typescript
// src/types/sales.ts
export interface SaleWithContact {
  id: string;
  name: string;
  // ... existing fields
  last_contact_date: string | null;
  last_contact_type: 'call' | 'email' | 'meeting' | null;
  next_followup_date: string | null;
}
```

**Step 2**: Add migration
```sql
-- supabase/migrations/[timestamp]_add_contact_tracking.sql
ALTER TABLE leads 
ADD COLUMN last_contact_date TIMESTAMP NULL,
ADD COLUMN last_contact_type TEXT CHECK (last_contact_type IN ('call', 'email', 'meeting')),
ADD COLUMN next_followup_date TIMESTAMP NULL;

CREATE INDEX idx_leads_followup 
ON leads(next_followup_date) 
WHERE next_followup_date IS NOT NULL;
```

**Step 3**: Add UI to track contact
```tsx
<Button
  size="sm"
  variant="outline"
  onClick={() => logContact(selectedLead.id, 'call')}
>
  <Phone className="w-4 h-4 mr-2" />
  Log Call
</Button>
```

**Expected Time**: 6 hours  
**Complexity**: Medium  
**User Value**: High (improves follow-up discipline)

---

### May: Add Order Status Notifications

**Files to Create/Modify**:
- Create `src/hooks/useOrderNotifications.ts` - New file
- Modify [src/components/restaurant/OrdersTabContent.tsx](src/components/restaurant/OrdersTabContent.tsx)

**Step 1**: Create notification hook
```typescript
// src/hooks/useOrderNotifications.ts
export function useOrderNotifications() {
  const { profile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!profile?.organization_id) return;

    const channel = supabase
      .channel(`orders:${profile.organization_id}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          filter: `organization_id=eq.${profile.organization_id}`
        },
        (payload) => {
          if (payload.new.status === 'ready') {
            toast({
              title: 'Order Ready',
              description: `Order for ${payload.new.pickup_name} is ready for pickup`,
            });
          }
        }
      )
      .subscribe();

    return () => channel.unsubscribe();
  }, [profile?.organization_id, toast]);
}
```

**Step 2**: Use in component
```tsx
useOrderNotifications(); // Add to OrdersTabContent
```

**Expected Time**: 4 hours  
**Complexity**: Medium  
**User Value**: Medium (real-time alerts)

---

### Cece: Add Booking Status Timeline

**Files to Create/Modify**:
- Create `src/components/accommodation/BookingTimeline.tsx` - New file
- Modify [src/components/accommodation/BookingsTabContent.tsx](src/components/accommodation/BookingsTabContent.tsx)

**Step 1**: Create timeline component
```tsx
export function BookingTimeline({ booking }: { booking: Booking }) {
  const statuses = [
    { date: booking.created_at, status: 'Created', icon: Plus },
    { date: booking.confirmed_at, status: 'Confirmed', icon: Check },
    { date: booking.checked_in_at, status: 'Checked In', icon: LogIn },
    { date: booking.checked_out_at, status: 'Checked Out', icon: LogOut },
  ];

  return (
    <div className="space-y-2">
      {statuses.map((item, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            item.date ? 'bg-success/20 text-success' : 'bg-gray-200 text-gray-500'
          }`}>
            <item.icon className="w-4 h-4" />
          </div>
          <div>
            <div className="font-medium">{item.status}</div>
            {item.date && <div className="text-sm text-muted-foreground">{format(item.date, 'PPP p')}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Expected Time**: 4 hours  
**Complexity**: Medium  
**User Value**: High (better visibility)

---

## 🚀 High Impact (8+ hours)

### Jay: Sales Pipeline Dashboard

**File Structure**:
```
src/
├── components/
│   └── sales/
│       ├── SalesPipeline.tsx          # Main pipeline view
│       ├── PipelineStage.tsx          # Individual stage column
│       ├── SalesMetricsCard.tsx       # Stats cards
│       └── FunnelChart.tsx            # Chart visualization
└── hooks/
    └── useSalesPipeline.ts            # Data aggregation
```

**Step 1**: Create hook for pipeline data
```typescript
export function useSalesPipeline() {
  const { leads, offerings } = useSalesData();
  
  const stages = ['new', 'contacted', 'qualified', 'converted', 'lost'];
  
  const pipeline = useMemo(() => {
    return stages.map(stage => ({
      stage,
      leads: leads.filter(l => l.status === stage),
      count: leads.filter(l => l.status === stage).length,
      value: leads
        .filter(l => l.status === stage)
        .reduce((sum, l) => sum + (l.deal_value || 0), 0),
    }));
  }, [leads]);

  return { pipeline, stages };
}
```

**Step 2**: Create pipeline component
```tsx
export function SalesPipeline() {
  const { pipeline } = useSalesPipeline();

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {pipeline.map(stage => (
        <PipelineStage key={stage.stage} stage={stage} />
      ))}
    </div>
  );
}
```

**Expected Time**: 12 hours  
**Complexity**: High  
**User Value**: Very High (strategic visibility)

---

### May: Kitchen Display System (KDS)

**File Structure**:
```
src/
├── components/
│   └── restaurant/
│       ├── KitchenDisplay.tsx         # Main KDS screen
│       ├── OrderTicket.tsx            # Individual order
│       └── KDSSettings.tsx            # Configuration
└── hooks/
    └── useKitchenOrders.ts            # Real-time orders
```

**Step 1**: Create real-time order hook
```typescript
export function useKitchenOrders() {
  const [orders, setOrders] = useState([]);
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.organization_id) return;

    const channel = supabase
      .channel(`kitchen:${profile.organization_id}`)
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `organization_id=eq.${profile.organization_id}`
        },
        (payload) => {
          if (['pending', 'preparing'].includes(payload.new.status)) {
            setOrders(prev => updateOrders(prev, payload));
          }
        }
      )
      .subscribe();

    return () => channel.unsubscribe();
  }, [profile?.organization_id]);

  return orders;
}
```

**Step 2**: Create KDS component
```tsx
export function KitchenDisplay() {
  const orders = useKitchenOrders();
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const pendingOrders = orders.filter(o => o.status === 'pending');

  return (
    <div className="grid grid-cols-3 gap-4 p-4 bg-black">
      {/* Pending */}
      <div className="space-y-2">
        <h2 className="text-white font-bold">PENDING</h2>
        {pendingOrders.map(order => (
          <OrderTicket key={order.id} order={order} />
        ))}
      </div>

      {/* Preparing */}
      <div className="space-y-2">
        <h2 className="text-white font-bold">PREPARING</h2>
        {preparingOrders.map(order => (
          <OrderTicket key={order.id} order={order} />
        ))}
      </div>

      {/* Ready */}
      <div className="space-y-2">
        <h2 className="text-white font-bold">READY</h2>
        {orders.filter(o => o.status === 'ready').map(order => (
          <OrderTicket key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
}
```

**Expected Time**: 16 hours  
**Complexity**: High  
**User Value**: Very High (operational efficiency)

---

### Cece: Dynamic Pricing Engine

**File Structure**:
```
src/
├── components/
│   └── accommodation/
│       ├── DynamicPricingConfig.tsx   # Configuration UI
│       └── PricingRulesList.tsx       # Rule management
└── hooks/
    └── useDynamicPricing.ts           # Pricing calculations
└── lib/
    └── pricingEngine.ts               # Core logic
```

**Step 1**: Create pricing logic
```typescript
// src/lib/pricingEngine.ts
export interface PricingRule {
  id: string;
  name: string;
  basePrice: number;
  rules: {
    occupancyPercentage: number;    // 0-100
    priceMultiplier: number;         // 1.0 = no change
    minStay?: number;
    blackoutDates?: string[];
  }[];
}

export function calculateDynamicPrice(
  basePrice: number,
  occupancyRate: number,
  rules: PricingRule[]
): number {
  const rule = rules.find(r => {
    const condition = r.rules.find(c => c.occupancyPercentage <= occupancyRate);
    return condition;
  });

  if (!rule) return basePrice;

  const multiplier = rule.rules.find(
    r => r.occupancyPercentage <= occupancyRate
  )?.priceMultiplier || 1;

  return basePrice * multiplier;
}
```

**Expected Time**: 20 hours  
**Complexity**: High  
**User Value**: Very High (revenue optimization)

---

## 📊 Implementation Priority Matrix

### Quick Wins (Start This Week)

| Feature | Industry | Time | Value | Effort |
|---------|----------|------|-------|--------|
| Offering count badge | Jay | 30m | ⭐⭐⭐ | ⭐ |
| Menu item selector | May | 2h | ⭐⭐⭐⭐ | ⭐⭐ |
| Guest count validation | Cece | 30m | ⭐⭐⭐ | ⭐ |

### Medium Priority (Next 2 Weeks)

| Feature | Industry | Time | Value | Effort |
|---------|----------|------|-------|--------|
| Contact tracking | Jay | 6h | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Order notifications | May | 4h | ⭐⭐⭐ | ⭐⭐ |
| Booking timeline | Cece | 4h | ⭐⭐⭐ | ⭐⭐ |

### High Impact (Next Month)

| Feature | Industry | Time | Value | Effort |
|---------|----------|------|-------|--------|
| Pipeline dashboard | Jay | 12h | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Kitchen display system | May | 16h | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Dynamic pricing | Cece | 20h | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## ✅ Testing Each Feature

### Example Test: Menu Item Selector (May)

```typescript
describe('OrdersTabContent - Menu Item Selector', () => {
  it('should display all active menu items', () => {
    const { getByText } = render(
      <OrdersTabContent ordersData={mockData} />
    );
    
    expect(getByText('Burger')).toBeInTheDocument();
    expect(getByText('Fries')).toBeInTheDocument();
  });

  it('should update quantity with +/- buttons', async () => {
    const { getByRole } = render(
      <OrdersTabContent ordersData={mockData} />
    );
    
    fireEvent.click(getByRole('button', { name: '+' }));
    expect(getByDisplayValue('1')).toBeInTheDocument();
  });

  it('should calculate total from selected items', () => {
    // Select items and verify total
  });

  it('should create order with correct items and prices', async () => {
    // Submit form and verify database insert
  });
});
```

---

## 🎓 Knowledge Base

### Supabase Real-Time Subscriptions
- [Docs](https://supabase.com/docs/guides/realtime)
- Use for: Order updates, booking changes, inventory alerts
- Best practices: Unsubscribe on unmount, handle reconnections

### React Query Patterns
- [Docs](https://tanstack.com/query/latest)
- Use for: Caching API responses, background sync
- Best practices: Set appropriate staleTime, implement retry logic

### TypeScript Best Practices
- Use strict mode
- Implement generics for reusable patterns
- Use discriminated unions for complex types

---

## 🚀 Getting Started Checklist

- [ ] Review this guide
- [ ] Pick one quick win to implement
- [ ] Create feature branch
- [ ] Implement feature following the guide
- [ ] Test manually in browser
- [ ] Add unit tests
- [ ] Get code review
- [ ] Merge and deploy
- [ ] Gather user feedback
- [ ] Iterate based on feedback

---

**Last Updated**: January 17, 2026  
**Status**: Ready to Implement ✅
