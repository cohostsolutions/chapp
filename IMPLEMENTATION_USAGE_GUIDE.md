# Quick Implementation Guide - Using New Components

## Using CreateBookingDialog (Accommodation)

```tsx
import { CreateBookingDialog } from '@/components/accommodation/CreateBookingDialog';
import { useAccommodationData } from '@/hooks/useAccommodationData';

export function BookingsView() {
  const { rooms, isLoading, refetchAll } = useAccommodationData();

  return (
    <div>
      <CreateBookingDialog 
        rooms={rooms}
        isLoading={isLoading}
        onSuccess={refetchAll}
      />
      {/* Rest of your component */}
    </div>
  );
}
```

## Using CreateOrderDialog (Food/Restaurant)

```tsx
import { CreateOrderDialog } from '@/components/food/CreateOrderDialog';
import { useOrdersData } from '@/hooks/useOrdersData';

export function OrdersView() {
  const { menuItems, isLoading, refetchAll } = useOrdersData();

  return (
    <div>
      <CreateOrderDialog 
        menuItems={menuItems}
        isLoading={isLoading}
        onSuccess={refetchAll}
      />
      {/* Rest of your component */}
    </div>
  );
}
```

## Using CreateSaleDialog (Sales)

```tsx
import { CreateSaleDialog } from '@/components/sales/CreateSaleDialog';
import { useSalesData } from '@/hooks/useSalesData';

export function SalesView() {
  const { offerings, isLoading, refetchAll } = useSalesData();

  return (
    <div>
      <CreateSaleDialog 
        offerings={offerings}
        isLoading={isLoading}
        onSuccess={refetchAll}
      />
      {/* Rest of your component */}
    </div>
  );
}
```

## Using OfferingCountBadge

```tsx
import { OfferingCountBadge, OfferingCountBadgeWithTooltip } from '@/components/sales/OfferingCountBadge';

// Simple variant
<OfferingCountBadge leadId={lead.id} />

// With tooltip showing offering names
<OfferingCountBadgeWithTooltip leadId={lead.id} showIcon={true} />
```

## Using RoomCapacityAlert

```tsx
import { RoomCapacityAlert } from '@/components/accommodation/RoomCapacityAlert';

<RoomCapacityAlert 
  guestCount={guestCount}
  roomCapacity={selectedRoom?.capacity}
  roomName={selectedRoom?.name}
/>
```

## Using Validation Schemas Directly

```tsx
import { bookingSchema, orderSchema, saleSchema } from '@/lib/validations';
import { z } from 'zod';

// Type-safe form data
type BookingFormData = z.infer<typeof bookingSchema>;
type OrderFormData = z.infer<typeof orderSchema>;
type SaleFormData = z.infer<typeof saleSchema>;

// Manual validation
const result = bookingSchema.safeParse(formData);
if (!result.success) {
  console.error(result.error.format());
}
```

## Using Custom Hooks Independently

```tsx
import { useCreateBooking } from '@/hooks/useCreateBooking';
import { useCreateOrder } from '@/hooks/useCreateOrder';
import { useCreateSale } from '@/hooks/useCreateSale';

// Create booking
const { createBooking, isLoading, error } = useCreateBooking();
const result = await createBooking({
  guestName: 'John Doe',
  checkIn: '2026-01-20',
  checkOut: '2026-01-22',
  roomId: 'room-123',
  guestCount: 2,
});

// Create order
const { createOrder, isLoading } = useCreateOrder();
const result = await createOrder({
  customerName: 'Jane Smith',
  items: [
    { menuItemId: 'menu-1', quantity: 2, notes: 'No spicy' },
    { menuItemId: 'menu-2', quantity: 1, notes: null },
  ],
});

// Create sale
const { createSale, isLoading } = useCreateSale();
const result = await createSale({
  name: 'ABC Company',
  temperature: 'warm',
  selectedOfferings: ['offering-1', 'offering-2'],
  notes: 'Follow up next week',
});
```

## Component Props Quick Reference

### CreateBookingDialog
```typescript
interface CreateBookingDialogProps {
  rooms: Array<{ id: string; name: string; capacity?: number }>;
  isLoading?: boolean;
  onSuccess?: () => void;
}
```

### CreateOrderDialog
```typescript
interface MenuItem {
  id: string;
  name: string;
  price?: number;
}

interface CreateOrderDialogProps {
  menuItems: MenuItem[];
  isLoading?: boolean;
  onSuccess?: () => void;
}
```

### CreateSaleDialog
```typescript
interface Offering {
  id: string;
  name: string;
  description?: string;
}

interface CreateSaleDialogProps {
  offerings: Offering[];
  isLoading?: boolean;
  onSuccess?: () => void;
}
```

## Form Field Types Supported

The GenericFormDialog supports these input types:
- `text` - Standard text input
- `email` - Email validation
- `phone` - Phone number format
- `number` - Numeric input with min/max/step
- `date` - Date picker (YYYY-MM-DD)
- `datetime-local` - Date + time picker
- `textarea` - Multi-line text
- `select` - Dropdown (single select)
- `checkbox` - Toggle boolean
- `multi-select` - Multi-select with badge display

## Validation Schemas at a Glance

### Booking Schema
- `guestName`: string (2-100 chars)
- `checkIn`: ISO date string
- `checkOut`: ISO date string (must be after checkIn)
- `roomId`: UUID string
- `guestCount`: number (1-20)
- `specialRequests`: optional string

### Order Schema
- `customerName`: string (2-100 chars)
- `items`: array of { menuItemId, quantity } (1-50 items)
- `pickupTime`: optional ISO datetime
- `deliveryAddress`: optional string
- `specialInstructions`: optional string

### Sale Schema
- `name`: string (2-100 chars)
- `temperature`: enum ('cold', 'warm', 'hot')
- `selectedOfferings`: optional array of UUIDs
- `notes`: optional string

## Error Handling Pattern

All create* hooks follow this pattern:
```tsx
const { createX, isLoading, error } = useCreateX();

try {
  const result = await createX(data);
  if (!result) {
    // Error was already toasted
    return;
  }
  // Success - data was created
  onSuccess?.();
} catch (err) {
  // Additional error handling if needed
  console.error(err);
}
```

## Mobile Responsiveness

All components are mobile-optimized:
- Dialogs use `sm:max-w-[500px]` for desktop
- Forms stack vertically on mobile
- Touch-friendly button sizes
- Proper viewport meta tags assumed

## TypeScript Support

Full TypeScript support throughout:
```tsx
import type { 
  BookingFormData, 
  OrderFormData, 
  SaleFormData,
  OrderItemInput 
} from '@/lib/validations';
```

---

**All components are production-ready and follow React 18+ best practices.**
