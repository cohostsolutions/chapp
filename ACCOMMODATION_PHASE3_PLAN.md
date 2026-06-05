# Accommodation Hub - Phase 3 Enhancement Plan

## Overview
Phase 3 focuses on power-user features, analytics, and system integrations to transform the Accommodation Hub into an enterprise-grade property management system.

**Total Improvements Planned:** 10 features across 3 priority tiers

---

## Priority 1: User Productivity (4 Features)
*Estimated Time: 3-4 hours | High User Impact*

### 1.1 Advanced Multi-Field Search 🔍
**Current State:** Basic search on guest name only  
**Target State:** Search across guest name, email, phone, notes, booking reference

**Technical Approach:**
- Add search fields: `email`, `phone`, `notes`, `reference_number` to query
- Implement debounced multi-field filter in `useAccommodationData`
- Add search scope selector (All Fields | Guest | Contact | Reference)
- Use PostgreSQL `ILIKE` or full-text search for performance

**Files to Modify:**
- `src/hooks/useAccommodationData.ts` - Enhanced search query builder
- `src/components/accommodation/BookingsTabContent.tsx` - Search UI updates

**Estimated Lines:** ~150 lines

---

### 1.2 Saved Filter Presets 💾
**Current State:** Users re-apply filters each session  
**Target State:** Save/load custom filter combinations with names

**Technical Approach:**
- Create `filter_presets` table (user_id, name, filters_json, is_default)
- Add preset dropdown in filter bar
- Save/load/delete preset operations
- Store in localStorage as backup for offline use

**Files to Modify:**
- `supabase/migrations/` - New table schema
- `src/components/accommodation/BookingsTabContent.tsx` - Preset UI
- `src/hooks/useFilterPresets.ts` - New hook for preset operations

**Database Schema:**
```sql
CREATE TABLE filter_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Estimated Lines:** ~200 lines

---

### 1.3 Booking Templates 📋
**Current State:** Manual entry for recurring bookings  
**Target State:** Save booking details as template, quick-create from template

**Technical Approach:**
- Create `booking_templates` table (name, default_values, room_id)
- Add "Save as Template" button in booking form
- Template picker dropdown in "Add Booking" dialog
- Pre-fill form with template values

**Files to Modify:**
- `supabase/migrations/` - New table
- `src/components/accommodation/BookingsTabContent.tsx` - Template UI
- `src/components/AddBookingDialog.tsx` - Template integration

**Database Schema:**
```sql
CREATE TABLE booking_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  room_id UUID REFERENCES room_units(id),
  template_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Estimated Lines:** ~180 lines

---

### 1.4 Notes History Tracking 📝
**Current State:** Notes can be edited but history lost  
**Target State:** Track all note changes with timestamps and user attribution

**Technical Approach:**
- Create `booking_note_history` table (booking_id, note_text, user_id, timestamp)
- Add "View History" button next to notes field
- Show timeline of changes in popover/modal
- Store snapshot on every note save

**Files to Modify:**
- `supabase/migrations/` - New history table
- `src/components/accommodation/BookingsTabContent.tsx` - History UI
- `src/hooks/useBookingNotes.ts` - New hook for note operations

**Database Schema:**
```sql
CREATE TABLE booking_note_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  note_text TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Estimated Lines:** ~140 lines

---

## Priority 2: Analytics & Insights (2 Features)
*Estimated Time: 4-5 hours | Medium-High Impact*

### 2.1 Occupancy Analytics Dashboard 📊
**Current State:** No visual analytics  
**Target State:** Charts showing occupancy rate, revenue, booking trends

**Technical Approach:**
- Create new "Analytics" tab in AccommodationHub
- Use Recharts library for visualizations
- Metrics: Occupancy %, Revenue by Month, Average Stay, Room Performance
- Date range selector (Last 30/60/90 days, Custom)
- Calculate metrics from existing booking data

**Components to Create:**
- `src/components/accommodation/AnalyticsTabContent.tsx` - Main analytics view
- `src/components/accommodation/OccupancyChart.tsx` - Line/bar chart
- `src/components/accommodation/RevenueChart.tsx` - Revenue trends
- `src/hooks/useAnalytics.ts` - Data aggregation hook

**Chart Types:**
1. **Occupancy Rate Chart** - Line graph showing % occupied per day/week/month
2. **Revenue Chart** - Bar chart showing revenue by time period
3. **Booking Distribution** - Pie chart by status (confirmed, pending, cancelled)
4. **Average Stay Duration** - Bar chart by room
5. **Top Performing Rooms** - Ranked list by revenue/occupancy

**Dependencies:**
```bash
npm install recharts
```

**Estimated Lines:** ~400 lines

---

### 2.2 Smart Dynamic Pricing (Basic) 💰
**Current State:** Static pricing from room configuration  
**Target State:** Suggest price adjustments based on occupancy and season

**Technical Approach:**
- Calculate occupancy rate for target dates
- Apply multipliers: High (>80%): +20%, Medium (50-80%): +10%, Low (<50%): -10%
- Show suggested price vs base price in booking form
- User can accept or override suggestion
- Store pricing rules in `pricing_rules` table

**Files to Modify:**
- `src/utils/calculateBookingPrice.ts` - Add dynamic pricing logic
- `src/components/accommodation/BookingsTabContent.tsx` - Show price suggestion
- `supabase/migrations/` - Pricing rules table

**Algorithm:**
```typescript
suggestedPrice = basePrice * (1 + occupancyMultiplier + seasonalMultiplier)
occupancyMultiplier = occupancyRate > 0.8 ? 0.2 : occupancyRate > 0.5 ? 0.1 : -0.1
seasonalMultiplier = from pricing_rules (peak season, holidays, etc.)
```

**Estimated Lines:** ~200 lines

---

## Priority 3: External Integrations (4 Features)
*Estimated Time: 8-10 hours | High Complexity*

### 3.1 Guest Communication System 📧
**Current State:** Manual external communication  
**Target State:** Automated email/SMS for confirmations, reminders, check-in info

**Technical Approach:**
- Supabase Edge Function for sending notifications
- Integration with SendGrid (email) and Twilio (SMS)
- Templates: Booking Confirmation, 24h Reminder, Check-in Instructions
- Trigger on booking creation/status change
- Message history log

**Files to Create:**
- `supabase/functions/send-booking-notification/index.ts` - Edge function
- `src/components/accommodation/CommunicationSettings.tsx` - Template editor
- `src/hooks/useCommunications.ts` - Send/history hooks

**Message Templates:**
- Booking Confirmed: Guest name, dates, room, total price, cancellation policy
- Check-in Reminder (24h before): Address, check-in time, access instructions
- Check-out Reminder (day of): Check-out time, thank you message

**Required Environment Variables:**
```bash
SENDGRID_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

**Estimated Lines:** ~350 lines

---

### 3.2 Channel Manager Integration (Airbnb/Booking.com) 🌐
**Current State:** Manual entry for external bookings  
**Target State:** Two-way sync with Airbnb, Booking.com calendars

**Technical Approach:**
- OAuth integration with Airbnb API
- Booking.com XML API integration
- Import external bookings automatically
- Block calendar on external platforms when internally booked
- Store channel credentials in `channel_connections` table

**Files to Create:**
- `src/integrations/airbnb/` - Airbnb OAuth and API client
- `src/integrations/booking-com/` - Booking.com API client
- `supabase/functions/sync-channel-bookings/` - Sync edge function
- `src/components/ChannelManagerSettings.tsx` - Connection UI

**APIs Required:**
- Airbnb Calendar API (iCal format)
- Booking.com API (XML/JSON)

**Database Schema:**
```sql
CREATE TABLE channel_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  channel_name TEXT NOT NULL, -- 'airbnb', 'booking_com', etc.
  credentials JSONB NOT NULL,
  room_mappings JSONB, -- Map external listings to internal rooms
  last_sync_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Estimated Lines:** ~600 lines

---

### 3.3 Multi-Property Management 🏢
**Current State:** Single property view  
**Target State:** Manage multiple properties with centralized dashboard

**Technical Approach:**
- Add `property_id` to rooms and bookings tables
- Property selector in navigation
- Dashboard showing all properties
- Property-specific settings and permissions
- Create `properties` table with address, manager, settings

**Files to Modify:**
- `supabase/migrations/` - Add property_id columns, properties table
- `src/contexts/PropertyContext.tsx` - New context for selected property
- `src/components/PropertySelector.tsx` - Dropdown selector
- `src/hooks/useAccommodationData.ts` - Filter by property
- `src/pages/Properties.tsx` - Property management page

**Database Schema:**
```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  owner_id UUID REFERENCES auth.users(id),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE room_units ADD COLUMN property_id UUID REFERENCES properties(id);
ALTER TABLE bookings ADD COLUMN property_id UUID REFERENCES properties(id);
```

**Estimated Lines:** ~350 lines

---

### 3.4 Payment Gateway Integration 💳
**Current State:** Manual payment tracking  
**Target State:** Process payments via Stripe, record transactions automatically

**Technical Approach:**
- Stripe integration for card payments
- Create payment intents for bookings
- Record payment transactions in `payments` table
- Refund capability for cancellations
- Payment status auto-updates booking status

**Files to Create:**
- `supabase/functions/create-payment-intent/` - Stripe payment endpoint
- `src/integrations/stripe/` - Stripe client utilities
- `src/components/PaymentDialog.tsx` - Payment UI
- `src/hooks/usePayments.ts` - Payment operations hook

**Database Schema:**
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  stripe_payment_intent_id TEXT UNIQUE,
  status TEXT, -- 'pending', 'completed', 'failed', 'refunded'
  payment_method TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
```

**Required Environment Variables:**
```bash
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

**Estimated Lines:** ~450 lines

---

## Implementation Strategy

### Phase 3A: Quick Wins (Priority 1)
**Week 1 Goal:** Implement 4 user productivity features
1. Day 1-2: Advanced search + Saved filter presets
2. Day 3-4: Booking templates + Notes history

**Deliverables:**
- Multi-field search working
- Presets saved/loaded
- Templates functional
- Note history tracked

---

### Phase 3B: Analytics (Priority 2)
**Week 2 Goal:** Add analytics capabilities
1. Day 1-2: Occupancy analytics dashboard
2. Day 3: Dynamic pricing suggestions

**Deliverables:**
- 5 analytics charts rendering
- Pricing suggestions displayed

---

### Phase 3C: Integrations (Priority 3)
**Weeks 3-4 Goal:** External system connections
1. Week 3 Day 1-2: Guest communication
2. Week 3 Day 3-4: Channel manager basics
3. Week 4 Day 1-2: Multi-property support
4. Week 4 Day 3-4: Payment gateway

**Deliverables:**
- Email/SMS sending
- Channel sync working
- Multi-property switching
- Stripe payments processing

---

## Success Metrics

### User Productivity (Phase 3A)
- Search speed: <500ms for 1000+ bookings
- Filter preset usage: 60%+ of users create presets
- Template usage: 30%+ of bookings use templates
- Note history: 100% change tracking

### Analytics (Phase 3B)
- Chart render time: <2s for 12 months data
- Pricing accuracy: ±15% of market rate
- User engagement: 40%+ check analytics weekly

### Integrations (Phase 3C)
- Email delivery rate: >95%
- Channel sync: <5min delay
- Payment success rate: >98%
- Multi-property: Support 10+ properties per user

---

## Technical Dependencies

### New NPM Packages
```bash
npm install recharts          # Charts and analytics
npm install @stripe/stripe-js # Payment processing
npm install date-fns-tz      # Timezone handling
```

### Supabase Edge Functions
1. `send-booking-notification` - Email/SMS sender
2. `sync-channel-bookings` - Channel manager sync
3. `create-payment-intent` - Stripe payment
4. `webhook-stripe` - Handle Stripe webhooks

### Environment Variables Required
```env
# Communication
SENDGRID_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Payments
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Channels
AIRBNB_CLIENT_ID=
AIRBNB_CLIENT_SECRET=
BOOKING_COM_USERNAME=
BOOKING_COM_PASSWORD=
```

---

## Risk Assessment

### High Risk
- **Channel Manager Integration**: API rate limits, authentication complexity
- **Payment Gateway**: PCI compliance, refund handling, dispute management
- **Multi-Property**: Migration complexity for existing data

### Medium Risk
- **Guest Communication**: SMS costs, email deliverability
- **Dynamic Pricing**: Algorithm accuracy, user trust

### Low Risk
- **Advanced Search**: Performance with large datasets
- **Filter Presets**: User adoption
- **Booking Templates**: Data consistency
- **Note History**: Storage growth

---

## Rollback Plan

Each feature is independent and can be rolled back without affecting others:

1. **Database migrations**: Use Supabase rollback commands
2. **Feature flags**: Wrap new features in conditional rendering
3. **API integrations**: Disable via environment variables
4. **Edge functions**: Version control with instant rollback

---

## Testing Strategy

### Unit Tests
- Search query builder logic
- Pricing calculation accuracy
- Template validation
- Payment intent creation

### Integration Tests
- Filter preset save/load cycle
- Note history tracking
- Channel sync workflow
- Stripe payment flow

### E2E Tests
- Complete booking with payment
- Multi-property switching
- Channel manager sync
- Email/SMS delivery

---

## Documentation Plan

Files to create:
1. `ACCOMMODATION_PHASE3_SEARCH.md` - Search feature guide
2. `ACCOMMODATION_PHASE3_ANALYTICS.md` - Analytics usage
3. `ACCOMMODATION_PHASE3_INTEGRATIONS.md` - Setup guides
4. `ACCOMMODATION_PHASE3_COMPLETE.md` - Final summary

---

## Next Steps

**Before Starting Phase 3:**
1. ✅ Review this plan with team
2. ⏳ Prioritize features (can skip or defer some)
3. ⏳ Set up external API accounts (Stripe, SendGrid, Twilio)
4. ⏳ Confirm budget for API costs
5. ⏳ Schedule implementation timeline

**Recommended Start:**
Focus on **Phase 3A (Priority 1)** first - these are high-impact, low-risk features that users will love immediately.

---

## Questions for Stakeholders

1. **Priority Confirmation**: Are Priority 1 features the right starting point?
2. **Integrations**: Which channel managers are most important (Airbnb, Booking.com, others)?
3. **Communication**: Email-only or also SMS? (SMS has per-message costs)
4. **Payments**: Stripe only or support multiple gateways?
5. **Multi-Property**: How many properties do users typically manage?
6. **Timeline**: Aggressive (all in 4 weeks) or phased (2-3 months)?

---

**Status:** 📋 Planning Complete - Awaiting Approval to Begin Phase 3A
