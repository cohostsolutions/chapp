# Component Location Verification Protocol

**Purpose**: Prevent mistakes like refactoring the wrong component (ConversationListItem.tsx instead of ChatLogs.tsx)

**Created**: Following discovery that conversation list rendering happens directly in ChatLogs.tsx, NOT in ConversationListItem.tsx

---

## The Problem That Happened

When asked to fix conversation list truncation on the `/chats` page, I modified:
- ❌ **WRONG**: `/src/components/chat/ConversationListItem.tsx` (reusable component)
- ✅ **CORRECT**: `/src/pages/ChatLogs.tsx` lines 1498-1680 (where it's actually rendered)

**Root Cause**: The request used a semantic component name without explicit file location, so I assumed the named component was the one doing the rendering.

**Impact**: 
- 4,000+ lines of documentation created for wrong component
- Zero impact on /chats page (still broken)
- Wasted effort and delayed fix

---

## Protocol: 5-Step Verification Before Modifications

### Step 1: Require Explicit File Path
**When requesting changes**, ALWAYS include the exact file path.

```
✅ GOOD: "Fix the conversation list in /src/pages/ChatLogs.tsx around lines 1498-1680"
❌ BAD: "Fix the conversation list component"
```

### Step 2: Grep for Actual Usage
**Before modifying**, search for where the component is ACTUALLY used/rendered.

```bash
# Example: Search for "ConversationListItem" usage
grep -r "ConversationListItem" src/

# Result shows it's imported but may not be used on /chats
```

### Step 3: Verify Page Implementation
**Search the target page file** to confirm what's rendering the UI.

```bash
# For /chats page:
grep -n "className" src/pages/ChatLogs.tsx | grep -E "flex|grid|w-full"

# This reveals lines 1498-1680 contain the conversation row markup directly
```

### Step 4: Cross-Reference with Browser Inspector
**Use browser DevTools** to verify the exact DOM structure and component name.

```
In browser console:
1. Open /chats page
2. Right-click on a conversation row
3. Inspect element
4. Verify class names match your target file
5. Check React DevTools to see component hierarchy
```

### Step 5: Document the Location
**Create a comment in the code** to prevent future confusion.

```tsx
// CRITICAL: This conversation list is rendered DIRECTLY in ChatLogs.tsx (lines 1498-1680)
// NOT in ConversationListItem.tsx (which is only used for [specific use cases])
// When modifying conversation UI, update ChatLogs.tsx
<div className="w-full overflow-hidden px-2.5 py-2.5">
  {/* Conversation rows rendered here... */}
</div>
```

---

## Required Pre-Modification Checklist

Before I start ANY component modification:

- [ ] **Explicit file path provided** (e.g., `/src/pages/ChatLogs.tsx:1498-1680`)
- [ ] **Location verified** via grep for where component is rendered
- [ ] **Cross-reference confirmed** (Does semantic component name match actual location?)
- [ ] **Multiple render paths checked** (Does this component render in multiple places?)
- [ ] **Browser verification done** (Does DevTools match expected file?)
- [ ] **Slack/document notes provided** (Why this is the right location)

---

## Search Commands for Verification

### Find where a component is used:
```bash
grep -r "ComponentName" src/ --include="*.tsx" --include="*.ts"
```

### Find all render points in a specific file:
```bash
grep -n "className=" src/pages/ChatLogs.tsx | head -20
grep -n "return (" src/pages/ChatLogs.tsx | head -20
```

### Verify inline vs component rendering:
```bash
# Look for JSX in the file itself
grep -n "className=.*flex" src/pages/ChatLogs.tsx

# Look for imports of that component name
grep "import.*ComponentName" src/pages/ChatLogs.tsx
```

### Find all instances of a specific class pattern:
```bash
grep -r "flex items-start gap-2.5" src/ --include="*.tsx"
```

---

## Real Example: Conversation List Fix

**Request**: "Fix conversation list truncation on /chats page"

**Proper Protocol**:

1. **File Path**: `/src/pages/ChatLogs.tsx` (NOT ConversationListItem.tsx)
2. **Line Range**: Lines 1498-1680 contain the conversation row markup
3. **Grep Verification**:
   ```bash
   grep -n "px-3 py-2.5 pr-14" src/pages/ChatLogs.tsx
   # Output: 1500: className={cn( "w-full px-3 py-2.5 pr-14 text-left..."
   ```
4. **Cross-Reference**:
   ```bash
   grep -r "ConversationListItem" src/
   # Shows it's imported in ConversationList.tsx but NOT used in ChatLogs.tsx
   ```
5. **Component Map** (create this first):
   - ConversationListItem.tsx → used in ConversationList.tsx component (reusable item)
   - ChatLogs.tsx → renders conversation rows DIRECTLY (page-specific markup)

---

## Component Map for Chat Section

| Component | Location | Usage | Render Point |
|-----------|----------|-------|--------------|
| `ConversationListItem` | `/src/components/chat/ConversationListItem.tsx` | Reusable conversation item component | ConversationList.tsx (if used) |
| `ConversationList` | `/src/components/chat/ConversationList.tsx` | Wrapper component for conversation list | ChatLogs.tsx page imports |
| **Chat Rows** | `/src/pages/ChatLogs.tsx` **lines 1498-1680** | **ACTUAL /chats page rendering** | **Direct JSX inline** |

**KEY**: ChatLogs.tsx doesn't USE ConversationListItem - it renders the UI inline!

---

## How to Request Component Changes (New Format)

### ❌ Old Way (Caused the Problem)
> "Fix the conversation list component for layout issues"

### ✅ New Way
> "Fix the conversation list in `/src/pages/ChatLogs.tsx` lines 1498-1680:
> - Issue: Rows overflow, text truncates incorrectly
> - Target: The inline conversation row markup (not ConversationListItem.tsx)
> - Expected: 3-row layout with proper overflow-hidden and min-w-0 pattern
> - Verification: I've confirmed ChatLogs.tsx renders directly, see grep output [paste output]"

---

## Tool Usage Guide

### For Me (The Assistant)

**When you ask me to modify a component:**

1. ❌ **DON'T** assume the semantic component name is the right place
2. ✅ **DO** search for where it's rendered:
   ```
   - grep -r "ComponentName" src/
   - grep -n "className" TARGET_FILE | search for patterns
   - read_file to verify the JSX structure
   ```
3. ✅ **DO** verify before making ANY changes
4. ✅ **DO** ask for clarification if multiple places render similar UI

### For You (The User)

**When asking me to modify a component:**

1. ✅ **DO** include explicit file path: `/src/pages/ChatLogs.tsx`
2. ✅ **DO** mention line numbers if you know them
3. ✅ **DO** describe WHERE it's visible: "the /chats page left sidebar"
4. ✅ **DO** request verification first if unsure: "Before changing it, verify this is the right component"
5. ✅ **DO** share grep output or screenshots showing the current location

---

## Updating Component Maps

Whenever a new reusable component is created, add it to the appropriate section:

### Chat Components
- [ ] Update COMPONENT_MAP in this file
- [ ] Add location and usage notes
- [ ] Document all render points
- [ ] Cross-reference with page files

### Accommodation Components
- [ ] Document BookingsTabContent usage
- [ ] Document all status config changes
- [ ] Document auto-revert logic changes

---

## Prevention Checklist for Future Work

**Before starting any component refactor:**

```
[ ] File path explicitly stated in request
[ ] grep output confirms correct location
[ ] Multiple render paths checked
[ ] Component map updated in this document
[ ] Any reusable component vs page-specific distinction noted
[ ] Browser DevTools verified the structure matches
[ ] Code comment added to prevent future confusion
```

**For auto-revert/status logic changes:**

```
[ ] All status values documented in statusConfig
[ ] All status changes flow through updateBookingStatus()
[ ] External booking handling explicitly specified
[ ] Auto-revert RPC calls identified and verified
[ ] Grace period logic reviewed
[ ] Notification flow confirmed
```

---

## Questions to Ask Going Forward

Before you ask me to modify any component, answer these:

1. **Where is it shown in the UI?** (page URL, specific section)
2. **Which file contains the markup?** (exact file path)
3. **What are the symptoms?** (overflow, truncation, layout issue)
4. **Show me the location** (screenshot, line numbers, or grep output)
5. **Is this a reusable component or page-specific markup?**

---

## Examples of Proper Requests

### Example 1: Layout Fix
> "The conversation rows on the /chats page are overflowing. 
> They're in `/src/pages/ChatLogs.tsx` lines 1498-1680.
> Can you apply the 3-row layout pattern with min-w-0 and overflow-hidden?
> I've verified this is the direct rendering, not using ConversationListItem."

### Example 2: Status Feature
> "Add a 'new' status to bookings. 
> The status config is in `/src/components/accommodation/BookingsTabContent.tsx` line 105.
> The update function is at line 362.
> I want it to auto-revert like Cece/May orgs."

### Example 3: Cross-Component Change
> "Link order status updates. 
> Need to check both: 
> 1. `/src/components/accommodation/OrdersTabContent.tsx` (UI)
> 2. `/supabase/migrations/...auto_revert...sql` (logic)
> Before changing, can you verify both locations?"

---

## Related Documentation

- See [CHAT_IMPROVEMENTS_COMPLETE.md](./CHAT_IMPROVEMENTS_COMPLETE.md) for actual ChatLogs.tsx conversation row refactoring
- See [ACCOMMODATION_HUB_COMPLETE_SUMMARY.md](./ACCOMMODATION_HUB_COMPLETE_SUMMARY.md) for booking status changes
- See [AUTO_REVERT_EXPIRED_PENDING.md](./AUTO_REVERT_EXPIRED_PENDING.md) for auto-revert pattern documentation
