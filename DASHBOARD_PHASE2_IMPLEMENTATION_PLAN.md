# Phase 2: HIGH Priority Fixes - Implementation Plan

**Status:** In Progress  
**Start Date:** January 2026  
**Estimated Duration:** 35 hours

---

## Overview

Phase 2 focuses on fixing 12 HIGH priority issues across the dashboard, with the largest effort dedicated to refactoring ChatLogs.tsx state management (33 useState hooks → useReducer + Context).

---

## Phase 2 Deliverables

### ✅ Completed
1. Add ErrorBoundary to ChatLogs.tsx ✅
2. Verify all useEffect dependencies ✅  
3. Build verification (17.18s, 0 errors) ✅

### 🔄 In Progress
4. Analyze state management for refactoring
5. Create useReducer action types and initial state
6. Implement ChatLogsCon text provider

### ⏳ Not Started
7. Migrate all useState to useReducer
8. Add AbortController for API cancellation
9. Fix event listener cleanup
10. Complete remaining HIGH priority fixes
11. Final build and testing

---

## Issue #1: ChatLogs.tsx - State Management Refactor

**Current State:** 33 useState hooks scattered throughout component  
**Target:** Consolidate into useReducer + Context API  
**Impact:** Improve maintainability, reduce re-renders, prevent bugs

### Current useState Hooks (33 Total)

#### UI State (Dialog/Panel Management - 10 hooks)
```
1. leadDialogOpen / setLeadDialogOpen
2. callPopupOpen / setCallPopupOpen  
3. newMessageDialogOpen / setNewMessageDialogOpen
4. showTakeoverDialog / setShowTakeoverDialog
5. linkDialogOpen / setLinkDialogOpen
6. isInputFocused / setIsInputFocused
7. showScrollToBottom / setShowScrollToBottom
8. selectedChannel / setSelectedChannel
9. agentManagedFilter / setAgentManagedFilter
10. unreadFilter / setUnreadFilter
```

#### Data Selection State (5 hooks)
```
11. selectedChat / setSelectedChat
12. selectedLead / setSelectedLead
13. selectedNumber / setSelectedNumber
14. conversationForTakeover / setConversationForTakeover
15. conversationForLinking / setConversationForLinking
16. callTarget / setCallTarget
```

#### Input/Message State (6 hooks)
```
17. messageInput / setMessageInput
18. searchTerm / setSearchTerm
19. debouncedSearchTerm / setDebouncedSearchTerm
20. pendingAttachments / setPendingAttachments
21. activeFormats / setActiveFormats
22. messageReactions / setMessageReactions
```

#### Sorting/Filtering State (4 hooks)
```
23. sortBy / setSortBy
24. archivedOnly / setArchivedOnly
25. pinnedConversations / setPinnedConversations
26. highlightedMessageId / setHighlightedMessageId
```

#### Loading/Status State (4 hooks)
```
27. isSending / setIsSending
28. isRefreshing / setIsRefreshing
29. soundEnabled / setSoundEnabled
30. selectedConversationIds / setSelectedConversationIds
31. selectedConversationLeadIds / setSelectedConversationLeadIds
32. convVisibleRange / setConvVisibleRange
33. isTablet / setIsTablet
```

### Refactoring Strategy

#### Step 1: Create useReducer State Structure
```tsx
interface ChatLogsState {
  // UI State
  ui: {
    dialogs: {
      leadDialogOpen: boolean;
      callPopupOpen: boolean;
      newMessageDialogOpen: boolean;
      showTakeoverDialog: boolean;
      linkDialogOpen: boolean;
    };
    panels: {
      isInputFocused: boolean;
      showScrollToBottom: boolean;
    };
    filters: {
      selectedChannel: string;
      agentManagedFilter: boolean | null;
      unreadFilter: boolean;
      archivedOnly: boolean;
      sortBy: SortOption;
      pinnedConversations: Set<string>;
    };
  };
  
  // Data Selection
  selection: {
    selectedChat: ChatConversation | null;
    selectedLead: LeadInfo | null;
    selectedNumber: typeof availableNumbers[0];
    conversationForTakeover: ChatConversation | null;
    conversationForLinking: { leadId: string; leadName: string; date: string } | null;
    callTarget: { name: string; phone: string; leadId?: string } | null;
    selectedConversationIds: Set<string>;
    selectedConversationLeadIds: Set<string>;
  };
  
  // Input/Message
  input: {
    messageInput: string;
    searchTerm: string;
    debouncedSearchTerm: string;
    pendingAttachments: Attachment[];
    activeFormats: string[];
    messageReactions: Record<string, Record<string, string[]>>;
    highlightedMessageId: string | null;
  };
  
  // Status
  status: {
    isSending: boolean;
    isRefreshing: boolean;
    soundEnabled: boolean;
    convVisibleRange: { start: number; end: number };
    isTablet: boolean;
  };
}
```

#### Step 2: Create Actions
```tsx
type ChatLogsAction = 
  | { type: 'OPEN_DIALOG'; payload: { dialog: 'lead' | 'call' | 'newMessage' | 'takeover' | 'link' } }
  | { type: 'CLOSE_DIALOG'; payload: { dialog: 'lead' | 'call' | 'newMessage' | 'takeover' | 'link' } }
  | { type: 'SET_SELECTED_CHAT'; payload: ChatConversation | null }
  | { type: 'SET_MESSAGE_INPUT'; payload: string }
  | { type: 'SET_SEARCH_TERM'; payload: string }
  | { type: 'SET_DEBOUNCED_SEARCH'; payload: string }
  | { type: 'SET_SELECTED_CHANNEL'; payload: string }
  | { type: 'SET_SORT_BY'; payload: SortOption }
  | { type: 'TOGGLE_SOUND'; payload?: boolean }
  | { type: 'TOGGLE_CONVERSATION_SELECTION'; payload: { chatId: string; leadId?: string } }
  | { type: 'CLEAR_BULK_SELECTION' }
  | { type: 'SET_SENDING'; payload: boolean }
  | { type: 'SET_REFRESHING'; payload: boolean }
  // ... more actions
```

#### Step 3: Create Custom Hook
```tsx
function useChatLogsState() {
  const [state, dispatch] = useReducer(chatLogsReducer, initialState);
  
  // Return dispatch actions as convenience methods
  return {
    state,
    dispatch,
    // Convenience methods
    openDialog: (dialog: string) => dispatch({ type: 'OPEN_DIALOG', payload: { dialog } }),
    closeDialog: (dialog: string) => dispatch({ type: 'CLOSE_DIALOG', payload: { dialog } }),
    // ... more convenience methods
  };
}
```

#### Step 4: Create Context
```tsx
const ChatLogsContext = createContext<ChatLogsContextType | undefined>(undefined);

export function ChatLogsProvider({ children }: { children: React.ReactNode }) {
  const chatLogsState = useChatLogsState();
  return (
    <ChatLogsContext.Provider value={chatLogsState}>
      {children}
    </ChatLogsContext.Provider>
  );
}

export function useChatLogs() {
  const context = useContext(ChatLogsContext);
  if (!context) throw new Error('useChatLogs must be used within ChatLogsProvider');
  return context;
}
```

#### Step 5: Refactor Component
```tsx
function ChatLogsContent() {
  const { state, dispatch, openDialog, closeDialog } = useChatLogs();
  
  // Replace setLeadDialogOpen(true) with openDialog('lead')
  // Replace setLeadDialogOpen(false) with closeDialog('lead')
  // Replace selectedChat with state.selection.selectedChat
  // etc.
}
```

### Benefits of This Refactor

1. **Reduced Complexity:** 33 separate hooks → 1 reducer
2. **Easier to Trace:** All state changes go through dispatch
3. **Better Performance:** Fewer state update triggers
4. **Scalability:** Easy to add new state/actions
5. **Type Safety:** Single unified action union type
6. **Easier Testing:** Pure reducer function + action dispatch
7. **Context Reusability:** State available to any child component

---

## Issue #2: Add AbortController for API Cancellation

**Problem:** Pending API requests continue after component unmounts  
**Solution:** Add AbortController to fetch/request operations  
**Files Affected:** ChatLogs.tsx, KnowledgeBase.tsx, Operations.tsx

### Implementation Pattern

```tsx
// In effect cleanup
const controller = new AbortController();

const fetchData = async () => {
  try {
    const response = await fetch(url, {
      signal: controller.signal  // ← Pass signal
    });
    // process response
  } catch (error) {
    if (error instanceof TypeError && error.message === 'aborted') {
      // Request was cancelled - safe to ignore
      return;
    }
    // Handle real errors
  }
};

// Cleanup: cancel request on unmount
return () => controller.abort();
```

---

## Issue #3: Fix Event Listener Memory Leaks

**Problem:** Event listeners not properly cleaned up  
**Files Affected:** ChatLogs.tsx, Calendar.tsx

### Current Issues Found

1. **Media Query Listeners** (ChatLogs.tsx lines 194-203):
   ```tsx
   // Already has proper cleanup ✅
   query.addEventListener('change', listener);
   return () => query.removeEventListener('change', listener);
   ```

2. **Window Focus Listeners** (ChatLogs.tsx lines 393-402):
   ```tsx
   // Already has proper cleanup ✅
   window.addEventListener('focus', onFocus);
   return () => window.removeEventListener('focus', onFocus);
   ```

3. **Scroll Listeners** (Need to verify and fix if missing):
   - Check for scroll event handlers
   - Ensure cleanup in useEffect return
   - Consider using `once: true` option where applicable

### Fix Pattern

```tsx
useEffect(() => {
  const handler = (event: Event) => {
    // Handle event
  };
  
  element.addEventListener('event', handler, false);
  
  // Cleanup
  return () => element.removeEventListener('event', handler, false);
}, [dependencies]);
```

---

## Issue #4: Complete Missing Dependencies

**Status:** Audit found dependencies are mostly correct  
**Action:** Verify with ESLint and add any missing deps

```bash
npm run lint -- src/pages/ChatLogs.tsx 2>&1 | grep "missing.*dependencies"
```

---

## Issue #5: Implement Proper Error Handling

**Problem:** Some async operations have empty error handlers  
**Solution:** Use `useAsyncAction` hook or explicit error toasts

### Pattern to Use

```tsx
// Instead of: try { } catch { /* no-op */ }

// Use one of:
// 1. useAsyncAction hook (recommended)
const { execute, isLoading } = useAsyncAction(
  async () => {
    await refetchConversations();
  },
  { onError: (err) => toast({ title: 'Error', description: err.message }) }
);

// 2. Explicit error handling
try {
  await operation();
} catch (error) {
  toast({
    title: 'Error',
    description: error instanceof Error ? error.message : 'Operation failed',
    variant: 'destructive'
  });
}
```

---

## Other HIGH Priority Issues

### Issue #6-12: Missing ErrorBoundaries (Already Fixed in Phase 2a)
- ✅ ChatLogs.tsx - Now wrapped with ErrorBoundary
- ⏳ AITraining.tsx - Already has ErrorBoundary (Phase 1)
- ⏳ Others - Check coverage

### Incomplete API Error Handling
- SecurityDashboard.tsx - Missing error check after await
- Reporting.tsx - Incomplete error handling

### Race Conditions
- ChatLogs.tsx - Message operations need AbortController
- KnowledgeBase.tsx - Search operations need debouncing + cancellation

---

## Testing Strategy

### Unit Tests
```tsx
// Test reducer
describe('chatLogsReducer', () => {
  it('should handle OPEN_DIALOG action', () => {
    const action = { type: 'OPEN_DIALOG', payload: { dialog: 'lead' } };
    const newState = chatLogsReducer(initialState, action);
    expect(newState.ui.dialogs.leadDialogOpen).toBe(true);
  });
});
```

### Integration Tests
```tsx
// Test component with Context
render(
  <ChatLogsProvider>
    <ChatLogsContent />
  </ChatLogsProvider>
);

// Verify dispatch works
userEvent.click(screen.getByRole('button', { name: /open dialog/i }));
expect(screen.getByRole('dialog')).toBeVisible();
```

### Manual Testing
1. Open ChatLogs page
2. Test each dialog (Lead, Call, Takeover, Link)
3. Test message sending with attachments
4. Test search and filtering
5. Test bulk selection
6. Verify no console errors

---

## Completion Checklist

### State Management Refactor
- [ ] Create useReducer reducer function
- [ ] Define all action types
- [ ] Create ChatLogsContext provider
- [ ] Replace all useState with context + dispatch
- [ ] Test all state updates still work
- [ ] Update component to use context
- [ ] Verify no re-render regressions

### AbortController Implementation
- [ ] Add AbortController to fetch operations
- [ ] Add signal to all fetch calls
- [ ] Add cleanup in useEffect returns
- [ ] Test that requests cancel on unmount

### Event Listener Cleanup
- [ ] Audit all addEventListener calls
- [ ] Verify all have removeEventListener cleanup
- [ ] Test for memory leaks
- [ ] Remove any unused listeners

### Error Handling
- [ ] Replace empty catch blocks with error handling
- [ ] Add user-facing error messages
- [ ] Test error scenarios
- [ ] Add error logging for debugging

### Testing & Verification
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Manual testing of all features
- [ ] Build verification (npm run build)
- [ ] Performance check (no regressions)
- [ ] Accessibility check

---

## Success Metrics

- ✅ Build completes in <20 seconds
- ✅ 0 TypeScript errors
- ✅ 0 Console errors in development
- ✅ All dialogs open/close correctly
- ✅ Message sending works
- ✅ No memory leaks detected
- ✅ No race conditions observed
- ✅ Performance improved (fewer re-renders)
- ✅ All HIGH priority issues resolved
- ✅ Code is more maintainable

---

## Timeline

**Week 1:**
- Day 1: State management refactor (useReducer + Context)
- Day 2-3: AbortController implementation
- Day 4: Event listener cleanup

**Week 2:**
- Day 1-2: Error handling improvements
- Day 3: Testing and verification
- Day 4: Final build and deployment

---

## References

- useReducer API: https://react.dev/reference/react/useReducer
- Context API: https://react.dev/reference/react/useContext
- AbortController: https://developer.mozilla.org/en-US/docs/Web/API/AbortController
- useAsyncAction: /src/hooks/useAsyncAction

---

**Document Created:** January 2026  
**Status:** In Progress  
**Last Updated:** [Current Date]
