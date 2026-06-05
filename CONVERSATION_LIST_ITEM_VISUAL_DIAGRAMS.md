# ConversationListItem - Visual Layout Diagrams

## Component Structure Visualization

### Full Component Layout (Desktop View)

```
┌─────────────────────────────────────────────────────────────┐
│ ContextMenu Wrapper                                         │
│  └─ ContextMenuTrigger                                      │
│     └─ Root Div (flex w-full overflow-hidden)              │
│                                                             │
│  ┌──────────────────┬───────────────────────────────────┐  │
│  │   LEFT COLUMN    │    RIGHT COLUMN (flex-1 min-w-0)  │  │
│  │   (shrink-0)     │    (Main Content Area)            │  │
│  │                  │                                   │  │
│  │  ☐ [AVATAR]      │  ROW 1: Header                   │  │
│  │                  │  ┌──────────────────────────────┐ │  │
│  │  h-10 w-10       │  │ Name [Icon] ... Time [Badge] │ │  │
│  │  (Fixed Size)    │  └──────────────────────────────┘ │  │
│  │                  │                                   │  │
│  │  Checkbox:       │  ROW 2: Message Preview          │  │
│  │  opacity-0       │  ┌──────────────────────────────┐ │  │
│  │  on hover        │  │ This is the message preview..│ │  │
│  │  or selected     │  └──────────────────────────────┘ │  │
│  │                  │                                   │  │
│  │                  │  ROW 3: Footer & Actions         │  │
│  │                  │  ┌──────────────────────────────┐ │  │
│  │                  │  │ [Property Tag] ... [C][T][H] │ │  │
│  │                  │  └──────────────────────────────┘ │  │
│  │                  │  (ml-auto pushes buttons right)   │  │
│  └──────────────────┴───────────────────────────────────┘  │
│                          [Pin Icon] ▲                       │
│                      (absolute top-right)                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
      ContextMenuContent (Pin, View Lead, Call, etc.)
```

---

## Row 1: Header Breakdown

### Layout Analysis
```
┌─────────────────────────────────────────────────────────────┐
│ Row 1: flex items-center justify-between gap-2 min-w-0     │
│                                                             │
│  LEFT SECTION             SPACER           RIGHT SECTION   │
│  (flex min-w-0)         (expand)         (flex shrink-0)   │
│  ┌─────────────────┐  ┌──────┐  ┌──────────────────────┐  │
│  │ Name [AI Icon]  │  │      │  │ Time  [Unread] [X]   │  │
│  │ "John Smith" ✓  │  │      │  │ "10:45" [2] [Pin]   │  │
│  │ John... (trunc) │  │      │  │ Never wraps or trunc │  │
│  └─────────────────┘  └──────┘  └──────────────────────┘  │
│                                                             │
│ Key: Name shrinks first (min-w-0) → Timestamp always safe  │
└─────────────────────────────────────────────────────────────┘
```

### Responsive Name Behavior

**350px Width:**
```
[Jo...] [AI] [10:45] [2]
Name has ~250px to work with
If name > 250px → "Jo..."
```

**768px Width:**
```
[John Smi...] [AI] [Yesterday] [3]
Name has ~600px to work with
If name > 600px → "John Smi..."
```

**1200px Width:**
```
[John Smith] [AI] [April 15, 2:30 PM] [5]
Name has ~1000px to work with
Usually fits fully, rarely truncates
```

---

## Row 2: Message Preview

```
┌─────────────────────────────────────────────────────────────┐
│ Row 2: text-sm text-muted-foreground truncate              │
│                                                             │
│ [FULL WIDTH MESSAGE AREA (inherits min-w-0 from parent)]   │
│                                                             │
│ At 350px: [This is the message preview with el...]         │
│ At 768px: [This is the message preview. It might be a...] │
│ At 1200px: [This is the full message preview text without] │
│                                                             │
│ Always: Single line, ellipsis if overflow, muted color    │
└─────────────────────────────────────────────────────────────┘
```

---

## Row 3: Footer & Actions

### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│ Row 3: flex items-center justify-between gap-1.5           │
│                                                             │
│ LEFT SIDE              SPACER (pushes right)   RIGHT SIDE   │
│ (flex)               (justify-between)        (ml-auto)    │
│ ┌──────────────────┐ ┌──────────────────┐  ┌────────────┐ │
│ │ [Property Tag]   │ │                  │  │ [C][T][H] │ │
│ │ max-w-[60%]      │ │                  │  │ z-10      │ │
│ │ truncate         │ │                  │  │ opacity.. │ │
│ └──────────────────┘ └──────────────────┘  └────────────┘ │
│                                                             │
│ Property Tag: ┌────────────────────────┐                   │
│               │ [Bed] Living Room      │                   │
│               │ h-5 px-2 max-w-[60%]   │                   │
│               │ Font: text-[10px]      │                   │
│               │ Truncate: "Living R..."│                   │
│               └────────────────────────┘                   │
│                                                             │
│ Action Buttons:                                            │
│ ┌──────┐ ┌──────┐ ┌──────┐                                │
│ │  ☎   │ │  👤  │ │  🤖  │  (Visible on hover)            │
│ │ Call │ │Takeo.│ │Hand. │  (Fade transition)             │
│ │ h-7  │ │ h-7  │ │ h-7  │  (Better touch targets)        │
│ └──────┘ └──────┘ └──────┘  (Right-aligned via ml-auto)   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Width Distribution Example (768px)

```
Total Row Width: 700px

┌─ Property Tag ─┐           ┌─ Action Buttons ─┐
├─ max-w-[60%]  │           │  ml-auto pushes  │
│ = max 420px   │  SPACE    │  to right edge   │
├─ "Master B..."│     ↓     │  [☎][👤][🤖]    │
│ ~200px used   │ ~280px    │  ~75px used      │
└────────────────┴───────────┴──────────────────┘

Key: ml-auto creates invisible spacer to push buttons right
```

---

## Responsive Breakpoint Visualization

### Mobile (350px - Full Width View)

```
┌────────────────────────┐
│ ☐ [AVA] [J...] [1:45] │
│       [Mess prev...]    │
│       [Living] [C][T]  │
└────────────────────────┘

Characteristics:
✓ Checkbox hidden (show on hover/select)
✓ Avatar h-10 w-10
✓ Name "John S..." (truncated)
✓ Timestamp "1:45 PM" (always visible)
✓ Message truncates to fit
✓ Tag shows (might truncate)
✓ Buttons visible on hover
✓ NO SCROLL OVERFLOW
```

### Tablet (768px - More Breathing Room)

```
┌──────────────────────────────────────┐
│ ☐ [AVA] [John Smith] ... [Yesterday] │
│       [Message preview text with...] │
│       [Living Room] [☎][👤][🤖]     │
└──────────────────────────────────────┘

Characteristics:
✓ More space available
✓ Name likely shows fully "John Smith"
✓ Timestamp shows fully "Yesterday"
✓ Message preview longer before truncate
✓ Tag shows "Living Room" (might truncate)
✓ All buttons accessible
✓ Better spacing
✓ Touch-friendly layout
```

### Desktop (1200px+ - Full Glory)

```
┌────────────────────────────────────────────────────────────┐
│ ☐ [AVA] [John Smith] [AI] [April 15, 2:30 PM] [3]        │
│       [This is the complete message preview without...]   │
│       [Master Bedroom - Balcony View] [☎][👤][🤖]       │
└────────────────────────────────────────────────────────────┘

Characteristics:
✓ Full name visible
✓ Full timestamp visible
✓ Full message preview visible
✓ Full property name visible
✓ All buttons available
✓ Proper spacing
✓ Professional appearance
✓ Hover reveals nothing new (already visible)
```

---

## CSS Truncation Flow Chart

```
┌─────────────────────────────────────────────────────────────┐
│ Right Column                                                │
│ (flex-1 min-w-0)  ← THE CRITICAL CONTAINER                │
│ └─ Allows shrinking below content size ✓                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Row 1: flex items-center justify-between min-w-0   │  │
│  │                                                     │  │
│  │  ┌─ Name Container (flex min-w-0) ──────────────┐  │  │
│  │  │ └─ Name Button (truncate)                     │  │  │
│  │  │   └─ TEXT TRUNCATES HERE ✓                    │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  │                                                     │  │
│  │  ┌─ Timestamp Container (shrink-0) ────────────┐  │  │
│  │  │ └─ Timestamp Span (whitespace-nowrap)       │  │  │
│  │  │   └─ NEVER WRAPS OR TRUNCATES ✓            │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Row 2: Message (truncate) ✓                     │  │
│  │ └─ TEXT TRUNCATES HERE ✓                       │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Row 3: flex justify-between                     │  │
│  │ ┌─ Tag Container (max-w-[60%])  ───────────────┤  │
│  │ │ └─ Tag Span (truncate)                       │  │
│  │ │   └─ TEXT TRUNCATES HERE ✓                  │  │
│  │ └────────────────────────────────────────────┘  │  │
│  │ ┌─ Buttons Container (ml-auto)  ───────────────┤  │
│  │ │ └─ NO TRUNCATION, SHRINK-0 ✓               │  │
│  │ └────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Hover State Transition

### Before Hover
```
┌─────────────────────────────────────┐
│ [Avatar] [Name] [Time] [Unread]     │ opacity: 1
│ [Message preview]                  │ opacity: 1
│ [Tag]                              │ opacity: 1
│                                    │ [Buttons]
│                                    │ opacity: 0 ← HIDDEN
└─────────────────────────────────────┘
```

### During Hover
```
┌─────────────────────────────────────┐
│ [Avatar] [Name] [Time] [Unread]     │ opacity: 1
│ [Message preview]                  │ opacity: 1
│ [Tag]                              │ opacity: 1
│                           transition│ [Buttons]
│                           time:     │ opacity: 1 ← FADING IN
│                           200ms     │
└─────────────────────────────────────┘
```

### After Hover (Completed)
```
┌─────────────────────────────────────┐
│ [Avatar] [Name] [Time] [Unread]     │ opacity: 1
│ [Message preview]                  │ opacity: 1
│ [Tag]           [☎] [👤] [🤖]     │ opacity: 1
│                                    │ [Buttons]
│                                    │ opacity: 1 ← VISIBLE
└─────────────────────────────────────┘
```

**Key**: `opacity-0 group-hover:opacity-100 transition-opacity`
- No layout shift (z-index handles stacking)
- Smooth fade (200ms transition)
- Buttons still clickable (z-10)

---

## Z-Index Layering

```
Layer 4: Tooltips (auto)
         └─ Above everything

Layer 3: Buttons Container (relative z-10)
         ├─ Call Button
         ├─ Takeover Button
         └─ Handback Button
         └─ Always clickable ✓

Layer 2: Content Layers
         ├─ Name, Message, Tag
         ├─ Regular stacking
         └─ No z-index specified

Layer 1: Root Container (base)
         ├─ Background colors
         └─ Selection state

Layer 0: Body/Background
         └─ Below everything
```

---

## Avatar Fallback System

```
┌──────────────────────────┐
│ Avatar Component         │
│ h-10 w-10               │
│ ┌────────────────────┐  │
│ │ Try: avatarUrl     │  │
│ │ └─ Show Image ✓    │  │
│ │                    │  │
│ │ Fallback:          │  │
│ │ └─ Initials Badge  │  │
│ │    getInitials()   │  │
│ │    (max 2 chars)   │  │
│ │                    │  │
│ │ Examples:          │  │
│ │ • John Smith → JS  │  │
│ │ • Jane → JA        │  │
│ │ • M → M            │  │
│ └────────────────────┘  │
│                         │
│ Style:                  │
│ bg-muted               │
│ text-muted-foreground  │
│ text-xs font-medium    │
└──────────────────────────┘
```

---

## Agent Badge Types

### AI-Managed (Primary)
```
┌──────────┐
│  🤖 BOT  │
│ h-3.5    │
│ w-3.5    │
│ Color:   │
│ primary  │
│          │
│ Tooltip: │
│ "AI-     │
│  managed │
│  by [X]" │
└──────────┘
```

### Agent-Managed (Warning)
```
┌──────────┐
│  👤      │
│ UserCheck│
│ h-3.5    │
│ w-3.5    │
│ Color:   │
│ amber-600│
│          │
│ Tooltip: │
│ "Agent-  │
│  managed"│
└──────────┘
```

---

## Property Tag Anatomy

```
┌────────────────────────────────────────┐
│ Property Tag (max-w-[60%])             │
│ ┌──────────────────────────────────┐   │
│ │ [Bed] Living Room - Balcony      │   │
│ │ h-5 px-2 text-[10px]            │   │
│ │ bg-emerald-500/10               │   │
│ │ text-emerald-600                │   │
│ │ border-emerald-500/20           │   │
│ │                                 │   │
│ │ Width: max 60% of row           │   │
│ │ If truncates:                   │   │
│ │ "Living Room - B..." ← ellipsis │   │
│ │                                 │   │
│ │ Icon: BedDouble h-3 w-3         │   │
│ │ Icon stays: shrink-0            │   │
│ │ Text: truncate                  │   │
│ └──────────────────────────────────┘   │
└────────────────────────────────────────┘
```

---

## Button States

### Hidden (Default)
```
[Tag] ..................... [opacity-0]
      ← Gap (ml-auto)
                      Buttons exist but invisible
                      z-10 ready for interaction
```

### Visible (Hover)
```
[Tag] ..................... [☎] [👤] [🤖]
      ← Gap (ml-auto shrinks)
                      Buttons fade in (200ms)
                      Now visible and clickable
```

### Button Details
```
Each Button:
┌─────────────────────┐
│ h-7 w-7            │
│ variant="ghost"    │
│                    │
│ hover state:       │
│ ├─ Call: green-600 │
│ │  bg-green-500/10 │
│ ├─ Takeover: amb.. │
│ │  bg-amber-500/10 │
│ └─ Handback: ..    │
│    (custom button) │
│                    │
│ Content:           │
│ └─ Icon h-3.5 w3.5 │
│    (Phone, User..)│
│                    │
│ Tooltip: side left │
│ Text: "Call" etc   │
└─────────────────────┘
```

---

## Breakpoint Behavior Summary

### No Media Queries Approach

```
Instead of:
@media (max-width: 768px) { /* mobile rules */ }
@media (min-width: 768px) { /* desktop rules */ }

Use:
flex-1 min-w-0 pattern

Benefits:
✓ Single set of rules
✓ Responsive at ANY width
✓ No maintenance overhead
✓ Progressive enhancement
✓ Fewer CSS lines
```

---

## Accessibility Structure

```
Component Hierarchy:
┌─ ContextMenu (Semantic)
│  └─ ContextMenuTrigger
│     └─ div role="option" aria-selected
│        ├─ input[checkbox] aria-label
│        ├─ Avatar (semantic)
│        ├─ button (lead name) aria-label
│        ├─ button (call) aria-label
│        ├─ button (takeover) aria-label
│        └─ svg (pin) aria-label
│  └─ ContextMenuContent
│     ├─ ContextMenuItem
│     ├─ ContextMenuSeparator
│     └─ ...

Keyboard Nav:
Tab     → Focus next item
Shift+Tab → Focus previous
Enter   → Select item
Space   → Trigger (button/checkbox)
ArrowUp/Down → Navigate menu
Escape  → Close menu

Screen Reader:
✓ Role "option" for list item
✓ aria-selected for selection state
✓ aria-label on all interactive elements
✓ Label text for buttons
✓ Icon descriptions
```

---

## Color Palette Reference

```
Primary Elements:
├─ Lead Name: text-foreground (black/dark)
├─ Bot Badge: text-primary (blue)
├─ Agent Badge: text-amber-600 (amber)
└─ Unread: bg-primary + text-primary-foreground

Secondary Elements:
├─ Message: text-muted-foreground (gray)
├─ Timestamp: text-muted-foreground (gray)
└─ Tag Background: bg-emerald-500/10 (light green)

Hover States:
├─ Name hover: text-primary (blue)
├─ Item hover: bg-accent/50 (light background)
├─ Call button: hover:text-green-600 + bg-green-500/10
├─ Takeover: hover:text-amber-600 + bg-amber-500/10
└─ Selected: bg-accent/60 + border-l-primary

Pinned State:
└─ Background: bg-primary/5 (light blue tint)
```

---

**Generated**: January 18, 2026  
**Status**: ✅ Complete Visualization Guide
