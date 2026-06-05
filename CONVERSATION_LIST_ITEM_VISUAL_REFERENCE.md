# ConversationListItem - Visual Layout Reference

## DOM Hierarchy with CSS Classes

```
root-container (flex w-full overflow-hidden px-2.5 py-2.5)
│
├─ left-column (flex items-center gap-2 shrink-0)
│  │
│  ├─ checkbox (h-4 w-4 rounded border-border)
│  │  └─ opacity: 0 → 100 on hover or when selected
│  │
│  └─ avatar (h-10 w-10 shrink-0)
│     ├─ Avatar image (src from conversation.avatarUrl)
│     └─ Fallback: Initials badge (2 chars max)
│
└─ right-column (flex-1 min-w-0 flex flex-col gap-1)
   │  ⚠️  CRITICAL: min-w-0 enables proper truncation
   │
   ├─ row-1-header (flex items-center justify-between gap-2 min-w-0)
   │  │
   │  ├─ name-container (flex items-center gap-1 min-w-0)
   │  │  ├─ lead-name-button (font-bold text-sm truncate)
   │  │  │  └─ {conversation.leadName}
   │  │  │
   │  │  └─ agent-badge-tooltip
   │  │     └─ Bot icon (primary) OR UserCheck icon (agent-managed)
   │  │
   │  └─ timestamp-container (flex items-center gap-1.5 shrink-0)
   │     ├─ timestamp (text-xs text-muted-foreground whitespace-nowrap)
   │     │  └─ {formatConversationTime(lastMessageAt)}
   │     │
   │     └─ unread-badge (bg-primary text-primary-foreground h-4 min-w-4)
   │        └─ {conversation.unread > 0}
   │
   ├─ row-2-preview (text-sm text-muted-foreground truncate)
   │  └─ {conversation.lastMessage}
   │
   └─ row-3-footer-actions (flex items-center justify-between gap-1.5)
      │
      ├─ property-tag-container (conditional)
      │  └─ Badge (max-w-[60%] truncate)
      │     ├─ BedDouble icon (h-3 w-3 mr-1 shrink-0)
      │     └─ room-name (truncate)
      │
      └─ actions-container (flex items-center gap-1 shrink-0 ml-auto z-10)
         │  opacity: 0 → 100 on hover
         │
         ├─ call-button (conditional, if phone)
         │  └─ Phone icon
         │
         ├─ takeover-handback-button (conditional, if leadId)
         │  ├─ Takeover: UserCheck icon (if isAiManaged)
         │  └─ Handback: AgentHandbackButton (if agent-managed)
         │
         └─ [More buttons as needed]
```

---

## Truncation Behavior by Viewport

### Mobile (350px Sidebar)
```
┌──────────────────────────────────────┐
│ ☐ [AVA] [Na...] [Ag] [10:45] [2]    │
│      [This is the message preview...] │
│      [Property] [C][T]               │
└──────────────────────────────────────┘

Key:
☐ = Checkbox (opacity 0 unless hover/selected)
[AVA] = Avatar h-10 w-10
[Na...] = Name (truncates with ellipsis)
[Ag] = Agent Badge icon
[10:45] = Timestamp (never wraps)
[2] = Unread count
[Property] = Tag (max 60% width, truncates if long)
[C] = Call button (visible on hover)
[T] = Takeover button (visible on hover)
```

### Tablet (768px Sidebar)
```
┌────────────────────────────────────────────────┐
│ ☐ [AVA] [John Smith] [Ag] [Yesterday] [3]    │
│      [This is a longer message preview with...]│
│      [Living Room] [C] [T]                     │
└────────────────────────────────────────────────┘

Key:
- More space allows fuller name display
- Buttons visible on hover
- Tag has room to show full text (if < 60%)
```

### Desktop (1200px+ Sidebar)
```
┌────────────────────────────────────────────────────────────────┐
│ ☐ [AVA] [John Smith] [Bot Icon] [April 15, 2:30 PM] [5]      │
│      [This is the full message preview without truncation...] │
│      [Master Bedroom - Balcony View] [Call] [Handback]        │
└────────────────────────────────────────────────────────────────┘

Key:
- Full names and messages visible
- All content clearly displayed
- Buttons visible on hover (grouped to right)
```

---

## Row Breakdown

### Row 1: Header (Name + Timestamp)

**Structure:**
```
[Name + Agent Badge] ... [Timestamp + Unread Count]
```

**CSS Logic:**
```
flex items-center justify-between gap-2 min-w-0

├─ justify-between: Creates space between left and right
├─ items-center: Vertical alignment to center
├─ gap-2: Minimum gap ensures they don't collide
├─ min-w-0: Allows left side to shrink below natural size
```

**Name Shrinking Priority:**
1. Available space = right-column width - timestamp container width - gap
2. Name tries to take all available space
3. If text too long, name truncates (not timestamp)
4. Timestamp ALWAYS visible (shrink-0 + whitespace-nowrap)

---

### Row 2: Message Preview

**Structure:**
```
[Full message preview, single line only]
```

**CSS Logic:**
```
text-sm text-muted-foreground truncate

├─ truncate: 
│  └─ overflow: hidden
│  └─ text-overflow: ellipsis
│  └─ white-space: nowrap
├─ text-sm: 0.875rem (14px equivalent)
├─ text-muted-foreground: Secondary text color
```

**Behavior:**
- Always single line
- If text too long → "Text preview with ellipsis..."
- Always respects parent width (via min-w-0 inheritance)

---

### Row 3: Footer (Tag + Actions)

**Structure:**
```
[Property Tag: max-w-[60%]] ... [Action Buttons: ml-auto]
```

**CSS Logic:**
```
flex items-center justify-between gap-1.5

Property Tag:
  max-w-[60%]: Never exceeds 60% of row width
  truncate: If room name too long → "Master Bedro..."
  shrink-0: Preserves minimum width

Actions Container:
  ml-auto: Uses flex spacing to push to right edge
  gap-1: 4px spacing between buttons
  shrink-0: Doesn't compress buttons
  relative z-10: High z-index for clickability
  opacity-0 group-hover:opacity-100: Hidden → visible on hover
```

**Width Distribution:**
```
Total Row Width = 100%

Before ml-auto:
├─ Property Tag: 60% max
└─ Flex spacer: expands to fill gap

After ml-auto:
├─ Property Tag: takes its width
├─ Flex spacer (ml-auto): expands to right edge
└─ Action Buttons: anchored right, natural width
```

---

## Responsiveness Map

### Breakpoint Strategy

**Mobile-First (no breakpoint)**
```
All devices get full functionality:
├─ Checkbox: visible on hover/select
├─ Avatar: h-10 w-10
├─ Name: truncates dynamically
├─ Timestamp: always visible
├─ Message: single line, truncates
├─ Tag: max 60%, truncates
└─ Buttons: visible on hover, ml-auto positioning
```

**No Media Queries Needed!**
```
The flex + min-w-0 pattern handles all screen sizes
automatically without explicit breakpoints.
```

---

## Key CSS Patterns Used

### 1. The min-w-0 Pattern (Critical)
```css
/* Parent */
.flex-container {
  display: flex;
  flex: 1; /* or flex-grow: 1 */
  min-width: 0; /* ← THIS IS THE KEY */
}

/* Child */
.child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

**Why It Works:**
- By default, flex items have `min-width: auto`
- This means they won't shrink below their content size
- Setting `min-width: 0` allows them to shrink
- The text truncation then takes over

### 2. justify-between with Gap
```css
.row {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem; /* 8px */
}
```

**Result:**
- Left item(s): aligned to start
- Right item(s): aligned to end
- Gap creates minimum spacing
- Name shrinks before gap vanishes
- Timestamp never loses space (shrink-0)

### 3. ml-auto for Right Alignment
```css
.actions {
  margin-left: auto;
}
```

**Effect:**
- Creates invisible spacer on the left
- Pushes element to the right edge
- Works with flex, no need for position: absolute
- Responsive: respects available width

### 4. Opacity Transition for Hover
```css
.buttons {
  opacity: 0;
  transition: opacity 200ms;
  z-index: 10; /* Ensures clickability when visible */
}

.group:hover .buttons {
  opacity: 1;
}
```

**UX:**
- Buttons hidden until hover
- Smooth fade transition
- No layout shift
- Z-index prevents overlap issues

---

## Color & Typography Reference

| Element | Color | Size | Font |
|---------|-------|------|------|
| Lead Name | text-foreground | text-sm | font-bold |
| Agent Badge | text-primary (AI) / text-amber-600 (Agent) | h-3.5 w-3.5 | — |
| Timestamp | text-muted-foreground | text-xs | — |
| Unread Badge | text-primary-foreground | text-[10px] | — |
| Message Preview | text-muted-foreground | text-sm | — |
| Property Tag | text-emerald-600 | text-[10px] | — |
| Property Tag BG | bg-emerald-500/10 | — | — |
| Property Tag Border | border-emerald-500/20 | — | — |

---

## State Classes Reference

### Conversation States
```css
/* Default */
.hover\:bg-accent\/50:hover { background: accent/50%; }

/* Selected */
.bg-accent\/60 { background: accent/60%; }
.border-l-2.border-l-primary { border-left: 2px primary; }

/* Pinned (not selected) */
.bg-primary\/5 { background: primary/5%; }

/* Focus */
.focus-visible\:ring-2.focus-visible\:ring-primary { /* focus ring */ }
```

### Button States
```css
/* Call Button */
.hover\:text-green-600 { color: green-600 on hover; }
.hover\:bg-green-500\/10 { background: green-500/10% on hover; }

/* Takeover/Handback Button */
.hover\:text-amber-600 { color: amber-600 on hover; }
.hover\:bg-amber-500\/10 { background: amber-500/10% on hover; }

/* Checkbox */
.opacity-0.group-hover\:opacity-100 { visible on group hover; }
```

---

## Tailwind Classes Used

### Layout
- `flex` - Flex display
- `flex-1` - Flex grow 1
- `flex-col` - Flex direction column
- `items-center` - Align items center
- `justify-between` - Justify content space-between
- `gap-1`, `gap-2`, `gap-1.5` - Gap between items
- `shrink-0` - Prevent flex shrinking
- `min-w-0` - Allow flex child to shrink
- `w-full` - Width 100%
- `overflow-hidden` - Hide overflow

### Spacing
- `px-2.5` - Padding x 10px
- `py-2.5` - Padding y 10px
- `h-4`, `h-5`, `h-7` - Heights
- `w-4`, `w-5`, `w-7` - Widths
- `h-10`, `w-10` - Avatar size

### Typography
- `text-sm` - Font size 14px
- `text-xs` - Font size 12px
- `text-[10px]` - Font size 10px
- `font-bold` - Font weight bold
- `truncate` - Truncate text
- `whitespace-nowrap` - No wrap

### Colors
- `text-foreground` - Primary text
- `text-muted-foreground` - Secondary text
- `bg-accent/50` - Background accent
- `text-primary` - Primary color
- `bg-primary` - Primary background

### States
- `hover:` - Hover state
- `group-hover:` - Parent group hover
- `focus-visible:` - Focus visible
- `transition-opacity` - Opacity transition
- `opacity-0`, `opacity-100` - Opacity values

### Positioning
- `relative` - Relative positioning
- `absolute` - Absolute positioning (for pin indicator)
- `z-10` - Z-index 10
- `ml-auto` - Margin-left auto

---

## Example: Responsive Behavior at Different Widths

### Scenario: Name + Timestamp collision

**Width = 350px (Mobile)**
```
Available for right-column: ~315px (after avatar + gaps)

Row 1 layout:
├─ Name container: max available - (timestamp width + gap)
│  └─ If name > available width → truncate with "..."
├─ Gap: 8px (gap-2)
└─ Timestamp container: fixed width (whitespace-nowrap)
   └─ Timestamp never truncates
   └─ Unread badge always visible (if present)

Result: "John S..." [10:45] [2]
```

**Width = 768px (Tablet)**
```
Available for right-column: ~710px

Row 1 layout:
├─ Name container: max available - (timestamp width + gap)
│  └─ Name has more room, less likely to truncate
│  └─ If > available width → "John Smith J..." [Yesterday] [2]
├─ Gap: 8px
└─ Timestamp: fixed width

Result: "John Smith Jo..." [Yesterday] [2]
```

**Width = 1200px+ (Desktop)**
```
Available for right-column: ~1150px

Row 1 layout:
├─ Name container: sufficient space for most names
│  └─ "John Smith" fits comfortably
├─ Gap: 8px
└─ Timestamp: fixed width

Result: "John Smith" [Agent Icon] [April 15, 2:30 PM] [5]
```

---

## Data Binding Summary

### What's Displayed vs Removed

| Data | Status | Location |
|------|--------|----------|
| `leadName` | ✅ Shown | Row 1, Left |
| `isAiManaged` | ✅ Shown | Row 1, Left (Badge icon) |
| `lastMessageAt` | ✅ Shown | Row 1, Right |
| `unread` | ✅ Shown | Row 1, Right (Badge count) |
| `lastMessage` | ✅ Shown | Row 2 |
| `linkedBooking.room_name` | ✅ Shown | Row 3, Left (Tag) |
| `phone` | ✅ Used | Row 3, Right (Call button condition) |
| `leadTemperature` | ❌ Removed | Was: Row 1 icon |
| `channel` | ❌ Removed | Was: Row 1 icon |
| `leadId` | ✅ Used | Conditions for buttons/view |
| `messages.length` | ❌ Removed | Was: Row 3 count |
| `email` | ✅ Used | Contact info condition (removed) |
| `phone` \| `email` | ❌ Text removed | Was: Row 2 contact info |

---

## Browser DevTools Debugging

### Inspect the layout:
```
1. Right-click item → Inspect
2. Look for: <div role="option" class="flex w-full overflow-hidden...">
3. Check min-w-0 on right-column (flex-1 min-w-0)
4. Verify truncate on text elements
5. Check z-10 on actions container
```

### Test Responsiveness:
```
1. DevTools → Toggle Device Toolbar (Ctrl+Shift+M)
2. Try: 350px, 768px, 1200px widths
3. Hover over item → buttons should appear
4. Select item → checkbox should appear
5. Name should truncate, timestamp should not
```

### Check Overflow:
```
1. Open DevTools
2. Highlight root container
3. Verify: no overflow-x scroll
4. Check: children don't exceed parent bounds
```

---

## Performance Considerations

### CSS
- ✅ Pure CSS layout (no JS calculations)
- ✅ Transition uses GPU-accelerated opacity
- ✅ No layout shifts on hover

### React
- ✅ Component is memoized (memo wrapper)
- ✅ No additional DOM elements
- ✅ Event handlers use stopPropagation()

### Browser Rendering
- ✅ Flexbox layout efficient
- ✅ No recalculates on every frame
- ✅ Opacity transitions cheap

---

## Common Issues & Solutions

### Issue: Name doesn't truncate
```
Solution: Check min-w-0 on right-column
Location: <div className="flex-1 min-w-0 flex flex-col gap-1">
```

### Issue: Timestamp wraps to next line
```
Solution: Add whitespace-nowrap to timestamp
Location: <span className="text-xs text-muted-foreground whitespace-nowrap">
```

### Issue: Buttons overlap other content
```
Solution: Check z-10 on actions container
Location: <div className="... relative z-10">
```

### Issue: Tag overflows row width
```
Solution: Verify max-w-[60%] on Badge
Location: <Badge className="... max-w-[60%] truncate">
```

### Issue: Checkbox causes layout shift on hover
```
Solution: It's intentional with opacity
Location: opacity-0 group-hover:opacity-100
Use: User shouldn't see layout shift (absolute positioning removed)
```

---

## Future Enhancement Ideas

1. **Restore Channel Icon**: Add as tooltip on avatar
2. **Restore Temperature**: Add as tooltip on avatar
3. **Show Buttons Always**: Change opacity-0 to opacity-100 on mobile
4. **Message Count**: Add small badge near tag if needed
5. **More Actions**: Add archive/star buttons inline
6. **Multi-select**: Always show checkboxes on mobile
7. **Drag-to-reorder**: Add drag handle on left
8. **Pin in Sidebar**: Show pinned items first

---

Generated: January 18, 2026
Component: ConversationListItem
Refactor Status: ✅ Complete
