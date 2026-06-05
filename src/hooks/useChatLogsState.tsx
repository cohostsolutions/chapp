import { createContext, useContext, useReducer, ReactNode, useMemo } from 'react';
import { ChatConversation } from './useChatConversations';
import { LeadInfo } from '@/components/LeadInfoDialog';
import { Attachment } from '@/components/communications/AttachmentPreview';
import { availableChatNumbers, type AvailableNumber } from '@/lib/chatConfig';

// ============================================================================
// STATE TYPES
// ============================================================================

export type SortOption = 'newest' | 'oldest' | 'unread' | 'name';

export type { AvailableNumber } from '@/lib/chatConfig';

export interface ChatLogsState {
  // UI State - Dialogs
  dialogs: {
    leadDialogOpen: boolean;
    callPopupOpen: boolean;
    newMessageDialogOpen: boolean;
    showTakeoverDialog: boolean;
    linkDialogOpen: boolean;
    bulkMessageDialogOpen: boolean;
  };

  // UI State - Panels and Focus
  ui: {
    isInputFocused: boolean;
    showScrollToBottom: boolean;
    isTablet: boolean;
  };

  // Selection State - Current selections
  selection: {
    selectedChat: ChatConversation | null;
    selectedLead: LeadInfo | null;
    selectedNumber: AvailableNumber;
    selectedChannel: string;
    conversationForTakeover: ChatConversation | null;
    conversationForLinking: { leadId: string; leadName: string; date: string } | null;
    callTarget: { name: string; phone: string; leadId?: string } | null;
  };

  // Bulk Selection State
  bulkSelection: {
    selectedConversationIds: Set<string>;
    selectedConversationLeadIds: Set<string>;
  };

  // Filtering State
  filters: {
    searchTerm: string;
    debouncedSearchTerm: string;
    agentManagedFilter: boolean | null;
    unreadFilter: boolean;
    archivedOnly: boolean;
    sortBy: SortOption;
    pinnedConversations: Set<string>;
  };

  // Input/Message State
  input: {
    messageInput: string;
    pendingAttachments: Attachment[];
    activeFormats: string[];
    highlightedMessageId: string | null;
  };

  // Message Data State
  messages: {
    messageReactions: Record<string, Record<string, string[]>>;
  };

  // Status/Loading State
  status: {
    isSending: boolean;
    isRefreshing: boolean;
    soundEnabled: boolean;
    convVisibleRange: { start: number; end: number };
  };
}

// ============================================================================
// ACTION TYPES
// ============================================================================

export type ChatLogsAction =
  // Dialog actions
  | { type: 'OPEN_DIALOG'; payload: 'lead' | 'call' | 'newMessage' | 'takeover' | 'link' | 'bulkMessage' }
  | { type: 'CLOSE_DIALOG'; payload: 'lead' | 'call' | 'newMessage' | 'takeover' | 'link' | 'bulkMessage' }
  | { type: 'CLOSE_ALL_DIALOGS' }

  // UI Panel actions
  | { type: 'SET_INPUT_FOCUSED'; payload: boolean }
  | { type: 'SET_SHOW_SCROLL_TO_BOTTOM'; payload: boolean }
  | { type: 'SET_IS_TABLET'; payload: boolean }

  // Selection actions
  | { type: 'SET_SELECTED_CHAT'; payload: ChatConversation | null }
  | { type: 'SET_SELECTED_LEAD'; payload: LeadInfo | null }
  | { type: 'SET_SELECTED_NUMBER'; payload: AvailableNumber }
  | { type: 'SET_SELECTED_CHANNEL'; payload: string }
  | { type: 'SET_CONVERSATION_FOR_TAKEOVER'; payload: ChatConversation | null }
  | { type: 'SET_CONVERSATION_FOR_LINKING'; payload: { leadId: string; leadName: string; date: string } | null }
  | { type: 'SET_CALL_TARGET'; payload: { name: string; phone: string; leadId?: string } | null }

  // Bulk selection actions
  | { type: 'TOGGLE_CONVERSATION_SELECTION'; payload: { chatId: string; leadId?: string } }
  | { type: 'CLEAR_BULK_SELECTION' }

  // Filter actions
  | { type: 'SET_SEARCH_TERM'; payload: string }
  | { type: 'SET_DEBOUNCED_SEARCH'; payload: string }
  | { type: 'SET_AGENT_MANAGED_FILTER'; payload: boolean | null }
  | { type: 'SET_UNREAD_FILTER'; payload: boolean }
  | { type: 'SET_ARCHIVED_ONLY'; payload: boolean }
  | { type: 'SET_SORT_BY'; payload: SortOption }
  | { type: 'SET_PINNED_CONVERSATIONS'; payload: Set<string> }
  | { type: 'TOGGLE_PINNED_CONVERSATION'; payload: string }
  | { type: 'CLEAR_PINNED_CONVERSATIONS' }

  // Input actions
  | { type: 'SET_MESSAGE_INPUT'; payload: string }
  | { type: 'SET_PENDING_ATTACHMENTS'; payload: Attachment[] }
  | { type: 'ADD_PENDING_ATTACHMENT'; payload: Attachment }
  | { type: 'REMOVE_PENDING_ATTACHMENT'; payload: string }
  | { type: 'CLEAR_PENDING_ATTACHMENTS' }
  | { type: 'SET_ACTIVE_FORMATS'; payload: string[] }
  | { type: 'SET_HIGHLIGHTED_MESSAGE_ID'; payload: string | null }

  // Message reaction actions
  | { type: 'SET_MESSAGE_REACTIONS'; payload: Record<string, Record<string, string[]>> }
  | { type: 'UPDATE_MESSAGE_REACTION'; payload: { messageId: string; emoji: string; userIds: string[] } }

  // Status actions
  | { type: 'SET_IS_SENDING'; payload: boolean }
  | { type: 'SET_IS_REFRESHING'; payload: boolean }
  | { type: 'TOGGLE_SOUND'; payload?: boolean }
  | { type: 'SET_CONV_VISIBLE_RANGE'; payload: { start: number; end: number } };

// ============================================================================
// INITIAL STATE
// ============================================================================

export const initialChatLogsState: ChatLogsState = {
  dialogs: {
    leadDialogOpen: false,
    callPopupOpen: false,
    newMessageDialogOpen: false,
    showTakeoverDialog: false,
    linkDialogOpen: false,
    bulkMessageDialogOpen: false,
  },
  ui: {
    isInputFocused: false,
    showScrollToBottom: false,
    isTablet: false,
  },
  selection: {
    selectedChat: null,
    selectedLead: null,
    selectedNumber: availableChatNumbers[0],
    selectedChannel: 'all',
    conversationForTakeover: null,
    conversationForLinking: null,
    callTarget: null,
  },
  bulkSelection: {
    selectedConversationIds: new Set(),
    selectedConversationLeadIds: new Set(),
  },
  filters: {
    searchTerm: '',
    debouncedSearchTerm: '',
    agentManagedFilter: null,
    unreadFilter: false,
    archivedOnly: false,
    sortBy: 'newest',
    pinnedConversations: new Set(),
  },
  input: {
    messageInput: '',
    pendingAttachments: [],
    activeFormats: [],
    highlightedMessageId: null,
  },
  messages: {
    messageReactions: {},
  },
  status: {
    isSending: false,
    isRefreshing: false,
    soundEnabled: true,
    convVisibleRange: { start: 0, end: 30 },
  },
};

// ============================================================================
// REDUCER
// ============================================================================

export function chatLogsReducer(state: ChatLogsState, action: ChatLogsAction): ChatLogsState {
  switch (action.type) {
    // Dialog actions
    case 'OPEN_DIALOG': {
      const key =
        action.payload === 'lead'
          ? 'leadDialogOpen'
          : action.payload === 'call'
            ? 'callPopupOpen'
            : action.payload === 'newMessage'
              ? 'newMessageDialogOpen'
              : action.payload === 'takeover'
                ? 'showTakeoverDialog'
                : action.payload === 'link'
                  ? 'linkDialogOpen'
                  : 'bulkMessageDialogOpen';

      return {
        ...state,
        dialogs: { ...state.dialogs, [key]: true },
      };
    }

    case 'CLOSE_DIALOG': {
      const key =
        action.payload === 'lead'
          ? 'leadDialogOpen'
          : action.payload === 'call'
            ? 'callPopupOpen'
            : action.payload === 'newMessage'
              ? 'newMessageDialogOpen'
              : action.payload === 'takeover'
                ? 'showTakeoverDialog'
                : action.payload === 'link'
                  ? 'linkDialogOpen'
                  : 'bulkMessageDialogOpen';

      return {
        ...state,
        dialogs: { ...state.dialogs, [key]: false },
      };
    }

    case 'CLOSE_ALL_DIALOGS':
      return {
        ...state,
        dialogs: {
          leadDialogOpen: false,
          callPopupOpen: false,
          newMessageDialogOpen: false,
          showTakeoverDialog: false,
          linkDialogOpen: false,
          bulkMessageDialogOpen: false,
        },
      };

    // UI Panel actions
    case 'SET_INPUT_FOCUSED':
      return {
        ...state,
        ui: { ...state.ui, isInputFocused: action.payload },
      };

    case 'SET_SHOW_SCROLL_TO_BOTTOM':
      return {
        ...state,
        ui: { ...state.ui, showScrollToBottom: action.payload },
      };

    case 'SET_IS_TABLET':
      return {
        ...state,
        ui: { ...state.ui, isTablet: action.payload },
      };

    // Selection actions
    case 'SET_SELECTED_CHAT':
      return {
        ...state,
        selection: { ...state.selection, selectedChat: action.payload },
      };

    case 'SET_SELECTED_LEAD':
      return {
        ...state,
        selection: { ...state.selection, selectedLead: action.payload },
      };

    case 'SET_SELECTED_NUMBER':
      return {
        ...state,
        selection: { ...state.selection, selectedNumber: action.payload },
      };

    case 'SET_SELECTED_CHANNEL':
      return {
        ...state,
        selection: { ...state.selection, selectedChannel: action.payload },
      };

    case 'SET_CONVERSATION_FOR_TAKEOVER':
      return {
        ...state,
        selection: { ...state.selection, conversationForTakeover: action.payload },
      };

    case 'SET_CONVERSATION_FOR_LINKING':
      return {
        ...state,
        selection: { ...state.selection, conversationForLinking: action.payload },
      };

    case 'SET_CALL_TARGET':
      return {
        ...state,
        selection: { ...state.selection, callTarget: action.payload },
      };

    // Bulk selection actions
    case 'TOGGLE_CONVERSATION_SELECTION': {
      const { chatId, leadId } = action.payload;
      const newConvIds = new Set(state.bulkSelection.selectedConversationIds);
      if (newConvIds.has(chatId)) {
        newConvIds.delete(chatId);
      } else {
        newConvIds.add(chatId);
      }

      let newLeadIds = new Set(state.bulkSelection.selectedConversationLeadIds);
      if (leadId) {
        if (newLeadIds.has(leadId)) {
          newLeadIds.delete(leadId);
        } else {
          newLeadIds.add(leadId);
        }
      }

      return {
        ...state,
        bulkSelection: {
          selectedConversationIds: newConvIds,
          selectedConversationLeadIds: newLeadIds,
        },
      };
    }

    case 'CLEAR_BULK_SELECTION':
      return {
        ...state,
        bulkSelection: {
          selectedConversationIds: new Set(),
          selectedConversationLeadIds: new Set(),
        },
      };

    // Filter actions
    case 'SET_SEARCH_TERM':
      return {
        ...state,
        filters: { ...state.filters, searchTerm: action.payload },
      };

    case 'SET_DEBOUNCED_SEARCH':
      return {
        ...state,
        filters: { ...state.filters, debouncedSearchTerm: action.payload },
      };

    case 'SET_AGENT_MANAGED_FILTER':
      return {
        ...state,
        filters: { ...state.filters, agentManagedFilter: action.payload },
      };

    case 'SET_UNREAD_FILTER':
      return {
        ...state,
        filters: { ...state.filters, unreadFilter: action.payload },
      };

    case 'SET_ARCHIVED_ONLY':
      return {
        ...state,
        filters: { ...state.filters, archivedOnly: action.payload },
      };

    case 'SET_SORT_BY':
      return {
        ...state,
        filters: { ...state.filters, sortBy: action.payload },
      };

    case 'SET_PINNED_CONVERSATIONS':
      return {
        ...state,
        filters: { ...state.filters, pinnedConversations: new Set(action.payload) },
      };

    case 'TOGGLE_PINNED_CONVERSATION': {
      const newPinned = new Set(state.filters.pinnedConversations);
      if (newPinned.has(action.payload)) {
        newPinned.delete(action.payload);
      } else {
        newPinned.add(action.payload);
      }
      return {
        ...state,
        filters: { ...state.filters, pinnedConversations: newPinned },
      };
    }

    case 'CLEAR_PINNED_CONVERSATIONS':
      return {
        ...state,
        filters: { ...state.filters, pinnedConversations: new Set() },
      };

    // Input actions
    case 'SET_MESSAGE_INPUT':
      return {
        ...state,
        input: { ...state.input, messageInput: action.payload },
      };

    case 'SET_PENDING_ATTACHMENTS':
      return {
        ...state,
        input: { ...state.input, pendingAttachments: action.payload },
      };

    case 'ADD_PENDING_ATTACHMENT':
      return {
        ...state,
        input: {
          ...state.input,
          pendingAttachments: [...state.input.pendingAttachments, action.payload],
        },
      };

    case 'REMOVE_PENDING_ATTACHMENT':
      return {
        ...state,
        input: {
          ...state.input,
          pendingAttachments: state.input.pendingAttachments.filter(a => a.url !== action.payload),
        },
      };

    case 'CLEAR_PENDING_ATTACHMENTS':
      return {
        ...state,
        input: { ...state.input, pendingAttachments: [] },
      };

    case 'SET_ACTIVE_FORMATS':
      return {
        ...state,
        input: { ...state.input, activeFormats: action.payload },
      };

    case 'SET_HIGHLIGHTED_MESSAGE_ID':
      return {
        ...state,
        input: { ...state.input, highlightedMessageId: action.payload },
      };

    // Message reaction actions
    case 'SET_MESSAGE_REACTIONS':
      return {
        ...state,
        messages: { ...state.messages, messageReactions: action.payload },
      };

    case 'UPDATE_MESSAGE_REACTION':
      return {
        ...state,
        messages: {
          ...state.messages,
          messageReactions: {
            ...state.messages.messageReactions,
            [action.payload.messageId]: {
              ...(state.messages.messageReactions[action.payload.messageId] || {}),
              [action.payload.emoji]: action.payload.userIds,
            },
          },
        },
      };

    // Status actions
    case 'SET_IS_SENDING':
      return {
        ...state,
        status: { ...state.status, isSending: action.payload },
      };

    case 'SET_IS_REFRESHING':
      return {
        ...state,
        status: { ...state.status, isRefreshing: action.payload },
      };

    case 'TOGGLE_SOUND':
      return {
        ...state,
        status: {
          ...state.status,
          soundEnabled: action.payload !== undefined ? action.payload : !state.status.soundEnabled,
        },
      };

    case 'SET_CONV_VISIBLE_RANGE':
      return {
        ...state,
        status: { ...state.status, convVisibleRange: action.payload },
      };

    default:
      return state;
  }
}

// ============================================================================
// CONTEXT
// ============================================================================

interface ChatLogsContextType {
  state: ChatLogsState;
  dispatch: (action: ChatLogsAction) => void;
}

const ChatLogsContext = createContext<ChatLogsContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function ChatLogsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatLogsReducer, initialChatLogsState);

  const value: ChatLogsContextType = useMemo(
    () => ({
      state,
      dispatch,
    }),
    [state]
  );

  return <ChatLogsContext.Provider value={value}>{children}</ChatLogsContext.Provider>;
}

// ============================================================================
// CUSTOM HOOK
// ============================================================================

export function useChatLogsState() {
  const context = useContext(ChatLogsContext);
  if (!context) {
    throw new Error('useChatLogsState must be used within ChatLogsProvider');
  }
  return context;
}

// ============================================================================
// CONVENIENCE ACTIONS HOOK (optional, for easier dispatch)
// ============================================================================

export function useChatLogsActions() {
  const { dispatch } = useChatLogsState();

  return useMemo(
    () => ({
      // Dialog actions
      openDialog: (dialog: 'lead' | 'call' | 'newMessage' | 'takeover' | 'link') =>
        dispatch({ type: 'OPEN_DIALOG', payload: dialog }),
      closeDialog: (dialog: 'lead' | 'call' | 'newMessage' | 'takeover' | 'link') =>
        dispatch({ type: 'CLOSE_DIALOG', payload: dialog }),
      closeAllDialogs: () => dispatch({ type: 'CLOSE_ALL_DIALOGS' }),

      // Selection actions
      setSelectedChat: (chat: ChatConversation | null) =>
        dispatch({ type: 'SET_SELECTED_CHAT', payload: chat }),
      setSelectedLead: (lead: LeadInfo | null) =>
        dispatch({ type: 'SET_SELECTED_LEAD', payload: lead }),
      setSelectedNumber: (number: AvailableNumber) =>
        dispatch({ type: 'SET_SELECTED_NUMBER', payload: number }),
      setSelectedChannel: (channel: string) =>
        dispatch({ type: 'SET_SELECTED_CHANNEL', payload: channel }),

      // Bulk selection actions
      toggleConversationSelection: (chatId: string, leadId?: string) =>
        dispatch({ type: 'TOGGLE_CONVERSATION_SELECTION', payload: { chatId, leadId } }),
      clearBulkSelection: () => dispatch({ type: 'CLEAR_BULK_SELECTION' }),

      // Filter actions
      setSearchTerm: (term: string) => dispatch({ type: 'SET_SEARCH_TERM', payload: term }),
      setDebouncedSearch: (term: string) =>
        dispatch({ type: 'SET_DEBOUNCED_SEARCH', payload: term }),
      setSortBy: (sort: SortOption) => dispatch({ type: 'SET_SORT_BY', payload: sort }),
      togglePinnedConversation: (chatId: string) =>
        dispatch({ type: 'TOGGLE_PINNED_CONVERSATION', payload: chatId }),

      // Input actions
      setMessageInput: (input: string) => dispatch({ type: 'SET_MESSAGE_INPUT', payload: input }),
      setPendingAttachments: (attachments: Attachment[]) =>
        dispatch({ type: 'SET_PENDING_ATTACHMENTS', payload: attachments }),
      addPendingAttachment: (attachment: Attachment) =>
        dispatch({ type: 'ADD_PENDING_ATTACHMENT', payload: attachment }),
      removePendingAttachment: (url: string) =>
        dispatch({ type: 'REMOVE_PENDING_ATTACHMENT', payload: url }),
      clearPendingAttachments: () => dispatch({ type: 'CLEAR_PENDING_ATTACHMENTS' }),

      // Status actions
      setIsSending: (sending: boolean) => dispatch({ type: 'SET_IS_SENDING', payload: sending }),
      toggleSound: (enabled?: boolean) => dispatch({ type: 'TOGGLE_SOUND', payload: enabled }),
    }),
    [dispatch]
  );
}
