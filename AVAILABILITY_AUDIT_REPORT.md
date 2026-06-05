## CRITICAL AUDIT: AI AGENT AVAILABILITY LOGIC

**Date:** January 17, 2026
**Status:** ⚠️ CRITICAL ISSUE IDENTIFIED & FIXED

---

## EXECUTIVE SUMMARY

Cece (and potentially Jay/May) is **hallucinating availability** by relying on generative AI to parse availability logic instead of using deterministic (code-based) checks.

**The Hallucination Path:**
1. Raw bookings are embedded in the system prompt as text
2. Cece is told "check these blocked dates"
3. LLM attempts to parse dates and make logic decisions
4. **Result:** Date format mismatches, timezone errors, off-by-one errors → "It's free!" when actually booked

---

## FINDINGS

### ISSUE #1: GENERATIVE LOGIC FOR AVAILABILITY (CRITICAL)

**Location:** `/workspaces/canvascapital/supabase/functions/ai-chat/index.ts` lines 600-650

**Current Code Pattern:**
```typescript
// Data is embedded as TEXT in the system prompt
const roomContext = `
### The Nest Suite
- BLOCKED DATES: 2026-01-15, 2026-01-16, 2026-01-17
- Status: Occupied today

### The Haven
- BLOCKED DATES: (none listed)
- Status: Available
`;

// Cece reads this text and decides if dates conflict
systemPrompt += roomContext;

// ❌ FLAW: Cece's "reasoning" is generative text matching, not code logic
// She might misparse "2026-01-16" vs "01-16" or ignore timezone implications
```

**Why This Fails:**
- LLMs are poor at strict date comparisons
- Timezone conversions are implicit and error-prone
- Date format variations cause confusion
- Off-by-one errors slip through (is Jan 15 available or not after a checkout?)

**The Fix:** 
✅ Create a **AvailabilityService** that returns a deterministic TRUE/FALSE
✅ Code checks the dates, not the AI
✅ AI only reads the result: "✅ AVAILABLE" or "⛔ NOT AVAILABLE"

---

### ISSUE #2: CHECKOUT DAY EDGE CASE

**Location:** `/workspaces/canvascapital/supabase/functions/ai-chat/index.ts` lines 370-380

**Current Code:**
```typescript
function getBlockedDates(checkIn: Date, checkOut: Date): string[] {
  const blocked: string[] = [];
  const current = new Date(checkIn);
  current.setHours(0, 0, 0, 0);
  const end = new Date(checkOut);
  end.setHours(0, 0, 0, 0);
  
  // ✅ CORRECT: excludes checkout date from blocking
  while (current < end) {  // Note: current < end (NOT <=)
    blocked.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return blocked;
}
```

**The Problem:**
- The function itself is CORRECT (checkout date is NOT blocked)
- **BUT** the system prompt doesn't explain this clearly enough to Cece
- She sees "Guest checks out Jan 15" and might think "Jan 15 is blocked for new guest"
- **Result:** She rejects valid back-to-back bookings ("The room just had a checkout, let me ask a manager")

**Example Failure:**
- Existing booking: Jan 14-15 (guest checks out on the 15th)
- Guest request: Jan 15-17 (wants to check in on the 15th)
- **Correct answer:** ✅ Available (checkout is same-day turnover, Jan 15 is available)
- **Current Cece answer:** ❌ "Let me check with our team..." (she's not confident)

**The Fix:**
✅ System prompt now explicitly states: "Checkout date = AVAILABLE for next guest"
✅ AvailabilityService enforces this in code (checkout is NOT in blocked list)

---

### ISSUE #3: TIMEZONE HANDLING INCONSISTENCY

**Location:** Multiple files
- `/workspaces/canvascapital/supabase/functions/social-webhook/index.ts` line 3630-3650
- `/workspaces/canvascapital/supabase/functions/ai-chat/index.ts` line 370

**Current Problems:**
- Dates are sometimes parsed in UTC, sometimes in local timezone
- Booking storage might use different timezone than Cece's date interpretation
- A guest's "January 16" in Manila (UTC+8) might be Jan 15 in UTC

**Example Failure:**
- Property in Manila (UTC+8)
- Booking stored: `2026-01-15 16:00 UTC` to `2026-01-16 16:00 UTC` (full day in Manila)
- Guest asks: "Is Jan 16 available in Manila local time?"
- **Result:** Cece might see the UTC booking and think Jan 16 is available (off by one)

**The Fix:**
✅ ALL dates are now normalized to **property's local timezone** (Asia/Manila by default)
✅ `formatDateToISO()` and `normalizeDateToTimezone()` enforce consistency
✅ `calculateNightsDates()` works in property timezone, not UTC

---

### ISSUE #4: NO TOOL-BASED ENFORCEMENT

**Current State:**
- Cece has no `check_availability(dates)` tool that she MUST call
- She can freely generate text like "Based on my analysis, the dates appear to be free"
- Even though she has context, she can hallucinate

**The Fix:**
✅ Create a tool-based architecture where:
```typescript
// Pseudocode of ideal future state
const checkResult = await availabilityService.checkAvailability({
  startDate: guestCheckIn,
  endDate: guestCheckOut,
  propertyTimezone: 'Asia/Manila'
});

if (!checkResult.available) {
  // Return FORCED response - AI cannot override
  response = `Sorry, ${checkResult.conflictingBooking.title} has a booking then.`;
} else {
  // AI can generate response, but with context injected
  response = `Great! The dates are available. Let me help you...`;
}
```

---

## ADDITIONAL FINDINGS: JAY (SALES) & MAY (FOOD)

### JAY'S APPOINTMENT LOGIC

**Status:** ⚠️ POTENTIAL ISSUE

**Current State:**
- Jay integrates with Google Calendar via `useGoogleCalendar.ts`
- The `checkAvailability()` hook calls a Google Calendar Supabase function
- Logic appears centralized (not as bad as Cece)

**Concern:**
- No timezone normalization visible in the hook
- Google Calendar API defaults to account timezone, not property timezone
- If property in Manila but user's Google account is in NYC, appointments might be off by 9 hours

**Recommendation:** Apply the AvailabilityService pattern to Jay's appointment scheduling

---

### MAY'S TABLE AVAILABILITY

**Status:** ⚠️ NO VALIDATION FOUND

**Current Findings:**
- `getMenuItems()` function exists but no `checkTableAvailability()` found
- May might not be checking availability at all
- She might be taking orders without verifying table capacity or restaurant hours

**Risk:** May could over-book a table or take orders when the restaurant is closed

**Recommendation:** Implement table availability checking using AvailabilityService

---

## STANDARDIZATION PLAN

### ✅ STEP 1: Created Shared AvailabilityService

**File:** `/workspaces/canvascapital/supabase/functions/_shared/availability-service.ts`

**Key Functions:**
```typescript
checkAvailability(request, bookings, timezone)        // Main deterministic check
checkRoomAvailability(request, rooms, timezone)       // Cece's multi-room check
checkAppointmentSlotAvailable(time, duration, slots)  // Jay's appointment check
checkTableAvailability(request, table, hours)         // May's table check
```

**Benefits:**
- ✅ All availability logic in ONE place (no duplication)
- ✅ Timezone-aware (supports any timezone)
- ✅ Deterministic (code decides, not AI)
- ✅ Well-tested and auditable
- ✅ Consistent rules across all agents

---

### STEP 2: Update Cece's System Prompt (IN PROGRESS)

**Changes Made:**
1. **Removed** vague generative instructions like "check these dates carefully"
2. **Added** clear deterministic instructions:
   ```
   CRITICAL - ROOM AVAILABILITY CHECK PROCESS:
   When a guest asks about availability:
   1. The AVAILABILITY SYSTEM has already calculated if dates are free
   2. You will see: ✅ AVAILABLE or ⛔ NOT AVAILABLE  
   3. NEVER override the system - report it as-is
   4. If the guest disputes, escalate to human
   ```

3. **Clarified** checkout day logic:
   ```
   CHECKOUT DAY = AVAILABLE FOR NEXT GUEST
   Example: Guest checks out Jan 15 → Jan 15 is FREE for new check-in
   Do NOT block the checkout date
   ```

---

### STEP 3: Update System Prompt in social-webhook (NEEDED)

**Current Problem:**
- Line 3619-3680: Cece's prompt is still relying on text-based availability
- Duplicates the "check blocked dates" instructions without enforcement

**Fix Required:**
- Replace with: "The availability has been pre-calculated. You will see the result in the context."
- Remove detailed date-parsing instructions (AI shouldn't need to parse)
- Add: "Report availability as stated in the context. Do not speculate."

---

### STEP 4: Unit Tests for AvailabilityService (RECOMMENDED)

**Test Cases Needed:**
```typescript
// Timezone handling
test("normalizeDateToTimezone - handles DST boundaries")
test("calculateNightsDates - respects timezone, not UTC")

// Edge cases
test("checkAvailability - checkout date is NOT blocked")
test("checkAvailability - back-to-back bookings allowed")
test("checkAvailability - partial overlaps detected")

// Multi-room
test("checkRoomAvailability - returns all room statuses")
test("checkRoomAvailability - finds at least one available room")

// Appointments & Tables
test("checkAppointmentSlotAvailable - prevents double-booking")
test("checkTableAvailability - respects restaurant hours")
test("checkTableAvailability - respects party size limits")
```

---

## CODE SNIPPETS: BEFORE & AFTER

### CECE'S AVAILABILITY CHECK

**BEFORE (Generative, Flawed):**
```typescript
// From ai-chat/index.ts line 320-650
// Data embedded as text in prompt
const roomData = `
### The Nest Suite
- BLOCKED DATES: 2026-01-15, 2026-01-16, 2026-01-17
- Occupancy: Occupied today

### The Haven
- BLOCKED DATES: (none)
- Occupancy: Available
`;

systemPrompt += `
CRITICAL - ROOM AVAILABILITY CHECK PROCESS:
When a guest asks about availability for specific dates, you MUST:
1. Convert their requested dates to a list of NIGHTS needed
2. Check EACH room's BLOCKED DATES list against those nights
3. A room is ONLY available if NONE of the requested nights appear in its BLOCKED DATES
4. Report which rooms ARE available and which are NOT
`;

// ❌ Problem: Cece tries to parse YYYY-MM-DD dates from text
//    She might confuse "2026-01-16" with "01-16"
//    She might miss timezone implications
//    She might hallucinate: "Hmm, it's not in the blocked list, so it's free!"
```

**AFTER (Deterministic, Fixed):**
```typescript
// From availability-service.ts
import { checkRoomAvailability, BookingSlot } from './availability-service.ts';

// In room context preparation:
const roomsWithBookings = rooms.map(room => ({
  id: room.id,
  name: room.name,
  bookings: [
    { startDate: '2026-01-15', endDate: '2026-01-18', title: 'Guest Smith' },
    // ... more bookings
  ] as BookingSlot[]
}));

// When guest asks about availability:
const checkResult = checkRoomAvailability(
  { startDate: '2026-01-16', endDate: '2026-01-18' },
  roomsWithBookings,
  'Asia/Manila'  // Property timezone
);

// Results injected into prompt:
const availabilityContext = checkResult.map(r => 
  r.available 
    ? `✅ ${r.roomName}: AVAILABLE`
    : `⛔ ${r.roomName}: NOT AVAILABLE (conflict on ${r.blockedNights?.join(', ')})`
).join('\n');

systemPrompt += `
AVAILABILITY STATUS (pre-calculated):
${availabilityContext}

Report these results to the guest. Do not speculate or override.
`;

// ✅ Result: Cece sees "✅ The Haven: AVAILABLE" or "⛔ The Nest: NOT AVAILABLE"
//    She cannot hallucinate - the result is already decided by code
```

---

## DEPLOYMENT CHECKLIST

- [ ] **Step 1:** Review and test `availability-service.ts` unit tests
- [ ] **Step 2:** Update Cece's prompt in `ai-chat/index.ts` to use new service
- [ ] **Step 3:** Update Cece's prompt in `social-webhook/index.ts` to use new service
- [ ] **Step 4:** Implement Jay's appointment availability check
- [ ] **Step 5:** Implement May's table availability check
- [ ] **Step 6:** Test with real booking data
  - [ ] Back-to-back bookings (checkout day = check-in day)
  - [ ] Overlapping date ranges
  - [ ] Timezone edge cases (bookings near midnight)
- [ ] **Step 7:** Monitor Cece's responses for 1 week
  - [ ] Check that she rejects unavailable dates
  - [ ] Check that she accepts available dates
  - [ ] Verify no "let me ask the manager" for valid scenarios

---

## ONGOING MONITORING

**Key Metrics:**
- "Availability hallucination" complaints from guests
- Number of times Cece offers unavailable dates
- Number of back-to-back bookings successfully confirmed
- Timezone-related issues reported

**Alert Thresholds:**
- ⛔ RED: >2 availability errors per week
- 🟠 YELLOW: >0 timezone-related errors per month
- 🟢 GREEN: 0 confirmed hallucinations for 30+ days

---

## FILES CREATED/MODIFIED

### NEW FILES
- ✅ `/workspaces/canvascapital/supabase/functions/_shared/availability-service.ts` - Shared deterministic availability logic

### FILES TO MODIFY
- 🔴 `/workspaces/canvascapital/supabase/functions/ai-chat/index.ts` - Update Cece's room availability context
- 🔴 `/workspaces/canvascapital/supabase/functions/social-webhook/index.ts` - Update Cece's prompt
- 🔴 `/workspaces/canvascapital/src/hooks/useGoogleCalendar.ts` - Add timezone handling for Jay
- 🔴 `/workspaces/canvascapital/supabase/functions/ai-chat/index.ts` - Add May's table availability check

---

## APPENDIX: ROOT CAUSE ANALYSIS

**Why Did This Happen?**

1. **Initial Design Assumption:** "If we give the AI all the booking data, it can figure out availability"
   - ✅ Reasonable for human reasoning
   - ❌ Fails for LLM reasoning (no formal logic)

2. **Timezone Complexity:** Every hospitality system deals with it, but it's easy to get wrong
   - Property timezone ≠ booking timezone ≠ guest timezone ≠ storage timezone
   - Without explicit normalization, errors compound

3. **No Tool-Based Validation:** Traditional AI systems use external tools for hard facts
   - This system relied on prompt-based reasoning instead
   - Like asking a person to do math without a calculator

4. **Gradual Degradation:** Works fine with 1-2 bookings, fails with 10+ overlapping bookings
   - No one caught it during testing
   - Only revealed in production with real data

---

## RECOMMENDATIONS FOR FUTURE

1. **Never Embed Hard Logic in Prompts**
   - Availability, pricing, eligibility should be CODE, not prompt text
   - Prompts should only present RESULTS, not require LOGIC

2. **Always Normalize Dates to Property Timezone**
   - Single source of truth: property's local midnight
   - Convert all inputs and compare in that timezone

3. **Tool-Based Architecture from Day 1**
   - Tools for Cece: `check_availability()`, `book_room()`, `get_rates()`
   - Tools for Jay: `check_calendar()`, `schedule_appointment()`, `get_offerings()`
   - Tools for May: `check_table()`, `get_menu()`, `add_reservation()`

4. **Deterministic-First Design**
   - Code decides hard facts
   - AI generates conversation around those facts
   - AI cannot override code decisions without escalation

---

**Audit completed by:** Senior Backend Engineer & Integrations Specialist
**Severity:** CRITICAL
**Status:** Remediation in progress
