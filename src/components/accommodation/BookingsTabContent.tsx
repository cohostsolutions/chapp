import { useState, useMemo, useCallback, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useOrganizationPhone } from '@/hooks/useOrganizationPhone';
import { getPhoneValidationMessage, isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { 
  CalendarCheck, 
  Search, 
  Clock, 
  CheckCircle,
  XCircle,
  BedDouble,
  Plus,
  LayoutGrid,
  List,
  RefreshCw,
  Filter,
  Calendar,
  ArrowRight,
  Users,
  Phone,
  Mail,
  Moon,
  Edit,
  Loader2,
  LogIn,
  LogOut,
  Save,
  X,
  Trash2,
  Download,
  Star,
  Bookmark,
  History,
  FileText
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, differenceInDays, formatDistanceToNow, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { CardListSkeleton } from '@/components/shared/skeletons';
import { BookingKanbanBoard, OrphanLead } from '@/components/bookings/BookingKanbanBoard';
import { ClickableLeadName } from '@/components/leads/ClickableLeadName';
import { calculateBookingPrice, calculateDynamicPricing, getPropertyPricingContext } from '@/lib/bookingPricing';
import { getActionableBookings, getRecoveryWindowLabel } from '@/lib/bookingOperations';
import { usePricingMarketProfiles } from '@/hooks/usePricingMarketProfiles';
import { useDeletedBookingArchives } from '@/hooks/useDeletedBookingArchives';
import { CreateBookingDialog, CreateBookingDraft } from './CreateBookingDialog';
import { LinkGuestConversationDialog } from '@/components/bookings/LinkGuestConversationDialog';
import { DynamicPricingSuggestionComponent } from './DynamicPricingSuggestion';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { 
  useAccommodationData, 
  BookingWithRelations, 
  DateFilter, 
  SortOption 
} from '@/hooks/useAccommodationData';
import { useFilterPresets } from '@/hooks/useFilterPresets';
import { useBookingNotes } from '@/hooks/useBookingNotes';
import { ConversationDateFilter, DateRange } from '@/components/conversations/ConversationDateFilter';
import type { SearchScope } from '@/hooks/useAccommodationData';
import { getAccommodationWritePropertyId } from '@/lib/accommodationPropertySelection';

const statusConfig = {
  new: {
    label: 'New',
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    icon: <Clock className="w-3 h-3" />,
  },
  pending: {
    label: 'Pending',
    color: 'bg-warning/10 text-warning border-warning/30',
    icon: <Clock className="w-3 h-3" />,
  },
  upcoming: {
    label: 'Upcoming',
    color: 'bg-success/10 text-success border-success/30',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  confirmed: {
    label: 'Confirmed',
    color: 'bg-success/10 text-success border-success/30',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  checked_in: {
    label: 'Checked In',
    color: 'bg-primary/10 text-primary border-primary/30',
    icon: <LogIn className="w-3 h-3" />,
  },
  checked_out: {
    label: 'Checked Out',
    color: 'bg-muted text-muted-foreground border-border',
    icon: <LogOut className="w-3 h-3" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-destructive/10 text-destructive border-destructive/30',
    icon: <XCircle className="w-3 h-3" />,
  },
  external: {
    label: 'External',
    color: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
    icon: <Calendar className="w-3 h-3" />,
  },
} as const;

const editableStatusOptions = Object.entries(statusConfig).filter(([value]) => value !== 'external');

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  upcoming: { label: 'Upcoming', color: 'bg-muted text-muted-foreground border-muted-foreground/30' },
  fully_paid: { label: 'Fully Paid', color: 'bg-success/20 text-success border-success/30' },
  downpayment: { label: 'Downpayment', color: 'bg-warning/20 text-warning border-warning/30' },
  pending_ota: { label: 'Pending OTA', color: 'bg-info/20 text-info border-info/30' },
};

interface BookingsTabContentProps {
  accommodationData: ReturnType<typeof useAccommodationData>;
  syncBooking: (bookingId: string) => Promise<void>;
  deleteCalendarEvent: (bookingId: string) => Promise<void>;
  isSyncing: boolean;
  formatCurrency: (amount: number) => string;
  openNewBooking?: boolean;
  onNewBookingOpened?: () => void;
}

function matchesBookingSearch(booking: BookingWithRelations, searchTerm: string, searchScope: SearchScope) {
  const query = searchTerm.trim().toLowerCase();

  if (!query) return true;

  const guestName = (booking.lead?.name || booking.guest_name || '').toLowerCase();
  const guestPhone = (booking.lead?.phone || booking.guest_phone || '').toLowerCase();
  const guestEmail = (booking.lead?.email || booking.guest_email || '').toLowerCase();
  const notes = (booking.notes || booking.raw_description || '').toLowerCase();
  const roomName = (booking.room?.name || '').toLowerCase();

  switch (searchScope) {
    case 'guest':
      return guestName.includes(query);
    case 'contact':
      return guestPhone.includes(query) || guestEmail.includes(query);
    case 'notes':
      return notes.includes(query);
    default:
      return guestName.includes(query)
        || guestPhone.includes(query)
        || guestEmail.includes(query)
        || notes.includes(query)
        || roomName.includes(query);
  }
}

export default function BookingsTabContent({
  accommodationData,
  syncBooking,
  deleteCalendarEvent,
  isSyncing,
  formatCurrency,
  openNewBooking = false,
  onNewBookingOpened,
}: BookingsTabContentProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { defaultCountryCode, phonePlaceholder } = useOrganizationPhone();
  const isMobile = useIsMobile();
  const { executeUndoable } = useUndoableAction();

  const {
    properties,
    rooms,
    bookings,
    allBookingsWithExternal,
    orphanLeads,
    filters,
    updateFilters,
    resetFilters,
    selectedPropertyId,
    isLoading,
    isUpdatingBooking,
    refetchAll,
  } = accommodationData;

  const requiresPropertySelection = selectedPropertyId === 'all' && properties.length > 1;
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileFiltersDrawer, setShowMobileFiltersDrawer] = useState(false);
  const [localStatusFilter, setLocalStatusFilter] = useState('all');
  const [localRoomFilter, setLocalRoomFilter] = useState('all');
  const [localDateFilter, setLocalDateFilter] = useState<DateFilter>('upcoming');
  const [localCustomDateRange, setLocalCustomDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [localSortOption, setLocalSortOption] = useState<SortOption>('check_in_asc');
  const [localSearchTerm, setLocalSearchTerm] = useState(filters.searchTerm);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [newBookingOpen, setNewBookingOpen] = useState(openNewBooking);
  const [newBookingPrefill, setNewBookingPrefill] = useState<CreateBookingDraft | null>(null);
  const [orphanLeadToDelete, setOrphanLeadToDelete] = useState<OrphanLead | null>(null);
  const [deletingOrphanLeadId, setDeletingOrphanLeadId] = useState<string | null>(null);
  const [selectedBookingIds, setSelectedBookingIds] = useState<Set<string>>(new Set());
  const [batchStatusChangeOpen, setBatchStatusChangeOpen] = useState(false);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [batchNewStatus, setBatchNewStatus] = useState('');
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [noteHistoryDialogOpen, setNoteHistoryDialogOpen] = useState(false);
  const [viewingHistoryForBooking, setViewingHistoryForBooking] = useState<string | undefined>(undefined);
  const [editData, setEditData] = useState({
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    leadNotes: '',
    checkIn: null as Date | null,
    checkOut: null as Date | null,
    guestCount: 1,
    status: 'pending',
    paymentStatus: 'upcoming',
    notes: '',
    totalPrice: '',
    bookingSource: '',
  });

  const filterPresets = useFilterPresets();
  const noteHistory = useBookingNotes(viewingHistoryForBooking);
  const hasAnyBookingContent = allBookingsWithExternal.length > 0 || orphanLeads.length > 0;
  const defaultWritePropertyId = useMemo(
    () => getAccommodationWritePropertyId(selectedPropertyId, properties),
    [selectedPropertyId, properties]
  );
  const canOpenCreateBooking = !requiresPropertySelection && (
    !!defaultWritePropertyId || rooms.some((room) => !!room.property_id)
  );

  useEffect(() => {
    if (openNewBooking) {
      setNewBookingOpen(true);
      onNewBookingOpened?.();
    }
  }, [openNewBooking, onNewBookingOpened]);

  useEffect(() => {
    setLocalSearchTerm(filters.searchTerm);
  }, [filters.searchTerm]);

  useEffect(() => {
    const debounceId = window.setTimeout(() => {
      if (localSearchTerm !== filters.searchTerm) {
        updateFilters({ searchTerm: localSearchTerm });
      }
    }, 300);

    return () => window.clearTimeout(debounceId);
  }, [localSearchTerm, filters.searchTerm, updateFilters]);

  const displayedBookings = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const thisWeekEnd = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    const thisMonthEnd = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd');

    let result = [...allBookingsWithExternal];

    if (localStatusFilter !== 'all') {
      result = result.filter((booking) => booking.status === localStatusFilter);
    }

    if (localRoomFilter !== 'all') {
      result = result.filter((booking) => booking.room_unit_id === localRoomFilter);
    }

    switch (localDateFilter) {
      case 'today':
        result = result.filter((booking) => booking.check_in <= today && booking.check_out >= today);
        break;
      case 'upcoming':
        result = result.filter((booking) => booking.check_out >= today && booking.status !== 'cancelled');
        break;
      case 'past':
        result = result.filter((booking) => booking.check_out < today || booking.status === 'checked_out');
        break;
      case 'this_week':
        result = result.filter((booking) => booking.check_in >= today && booking.check_in <= thisWeekEnd);
        break;
      case 'this_month':
        result = result.filter((booking) => booking.check_in >= today && booking.check_in <= thisMonthEnd);
        break;
      case 'custom': {
        const fromStr = localCustomDateRange.from ? format(localCustomDateRange.from, 'yyyy-MM-dd') : null;
        const toStr = localCustomDateRange.to ? format(localCustomDateRange.to, 'yyyy-MM-dd') : null;
        if (fromStr || toStr) {
          result = result.filter((booking) => {
            if (fromStr && toStr) {
              return booking.check_in <= toStr && booking.check_out >= fromStr;
            }
            if (fromStr) {
              return booking.check_out >= fromStr;
            }
            return Boolean(toStr && booking.check_in <= toStr);
          });
        }
        break;
      }
      default:
        break;
    }

    result = result.filter((booking) => matchesBookingSearch(booking, filters.searchTerm, filters.searchScope));

    switch (localSortOption) {
      case 'check_in_asc':
        result.sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime());
        break;
      case 'check_in_desc':
        result.sort((a, b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime());
        break;
      case 'created_at_desc':
        result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        break;
      case 'guest_name':
        result.sort((a, b) => (a.lead?.name || a.guest_name || '').localeCompare(b.lead?.name || b.guest_name || ''));
        break;
      default:
        break;
    }

    return result;
  }, [allBookingsWithExternal, localStatusFilter, localRoomFilter, localDateFilter, localSortOption, localCustomDateRange, filters.searchTerm, filters.searchScope]);

  const { activeProfiles } = usePricingMarketProfiles();
  const { archives: deletedBookingArchives, restoreArchive, refetch: refetchDeletedBookingArchives } = useDeletedBookingArchives();
  const [linkGuestConversationOpen, setLinkGuestConversationOpen] = useState(false);

  const updateBookingStatus = useCallback(async (bookingId: string, newStatus: string) => {
    // Skip external bookings - they can't be updated
    if (bookingId.startsWith('external-')) {
      toast({
        title: "Cannot Update",
        description: "External bookings from connected calendars cannot be modified here.",
        variant: "destructive",
      });
      return;
    }
    // Find the booking to get its current status for undo
    const booking = allBookingsWithExternal.find(b => b.id === bookingId);
    const previousStatus = booking?.status || 'pending';
    const guestName = booking?.lead?.name || 'Guest';

    await executeUndoable({
      action: async () => {
        const { error } = await supabase
          .from('bookings')
          .update({ status: newStatus })
          .eq('id', bookingId);
        if (error) throw error;
        return { bookingId, newStatus };
      },
      undoAction: async () => {
        const { error } = await supabase
          .from('bookings')
          .update({ status: previousStatus })
          .eq('id', bookingId);
        if (error) throw error;
      },
      successMessage: 'Status Updated',
      successDescription: `${guestName}'s booking changed to ${newStatus.replace('_', ' ')}`,
      duration: 10000,
      onSuccess: () => refetchAll(),
      onUndo: () => refetchAll(),
    });
  }, [allBookingsWithExternal, executeUndoable, refetchAll, toast]);

  const clearFilters = useCallback(() => {
    setLocalStatusFilter('all');
    setLocalRoomFilter('all');
    setLocalDateFilter('upcoming');
    setLocalCustomDateRange({ from: undefined, to: undefined });
    setLocalSortOption('check_in_asc');
    updateFilters({ searchTerm: '' });
  }, [updateFilters]);

  // Handle booking click (view details)
  const handleBookingClick = useCallback((booking: BookingWithRelations) => {
    setSelectedBooking(booking);
    setLinkGuestConversationOpen(false);
    setIsEditing(false);
    setEditData({
      guestName: booking.lead?.name || '',
      guestPhone: booking.lead?.phone || '',
      guestEmail: booking.lead?.email || '',
      leadNotes: booking.lead?.notes || '',
      checkIn: parseISO(booking.check_in),
      checkOut: parseISO(booking.check_out),
      guestCount: booking.guest_count || 1,
      status: booking.status,
      paymentStatus: (booking as unknown as { payment_status?: string }).payment_status || 'upcoming',
      notes: booking.notes || '',
      totalPrice: booking.total_price != null ? String(booking.total_price) : '',
      bookingSource: booking.booking_source || '',
    });
  }, []);

  // Handle orphan lead click - open new booking dialog pre-filled with lead info
  const handleOrphanLeadClick = useCallback((lead: OrphanLead) => {
    if (!canOpenCreateBooking) {
      toast({
        title: 'Property context required',
        description: requiresPropertySelection
          ? 'Choose a specific property before creating a booking from a lead.'
          : 'Unable to resolve a writable property for this booking. Select a property and try again.',
        variant: 'destructive',
      });
      return;
    }

    setNewBookingPrefill({
      guestName: lead.name,
      guestPhone: lead.phone || '',
      guestEmail: lead.email || '',
      notes: lead.notes || '',
    });
    setNewBookingOpen(true);
  }, [canOpenCreateBooking, requiresPropertySelection, toast]);

  const handleDeleteOrphanLead = useCallback(async () => {
    if (!orphanLeadToDelete || !profile?.organization_id) {
      setOrphanLeadToDelete(null);
      return;
    }

    setDeletingOrphanLeadId(orphanLeadToDelete.id);
    let archiveId: string | null = null;
    let leadRecord: Record<string, unknown> | null = null;

    const isRpcInvocationError = (error: unknown) => {
      const typedError = error as { code?: string; message?: string } | null;
      const code = typedError?.code || '';
      const message = typedError?.message || '';
      return code === '42883' || code === '42501' || /function .* does not exist|schema cache|permission denied/i.test(message);
    };

    try {
      await executeUndoable({
        action: async () => {
          const { data, error } = await (supabase as any).rpc('archive_lead_deletion', {
            _lead_id: orphanLeadToDelete.id,
          });

          if (!error) {
            archiveId = data as string;
            return { id: orphanLeadToDelete.id };
          }

          if (!isRpcInvocationError(error)) {
            throw error;
          }

          const { data: existingLead, error: fetchError } = await supabase
            .from('leads')
            .select('*')
            .eq('id', orphanLeadToDelete.id)
            .single();

          if (fetchError) {
            throw error;
          }

          leadRecord = existingLead as Record<string, unknown>;

          const { error: deleteError } = await supabase
            .from('leads')
            .delete()
            .eq('id', orphanLeadToDelete.id);

          if (deleteError) throw deleteError;

          return { id: orphanLeadToDelete.id };
        },
        undoAction: async () => {
          let error: { message?: string } | null = null;

          if (archiveId) {
            const result = await (supabase as any).rpc('restore_deleted_lead_archive', {
              _archive_id: archiveId,
            });
            error = result.error;
          } else if (leadRecord) {
            const result = await supabase
              .from('leads')
              .insert(leadRecord as never);
            error = result.error;
          }

          if (error) throw error;
        },
        successMessage: 'Lead deleted',
        successDescription: `${orphanLeadToDelete.name} has been removed.`,
        duration: 10000,
        onSuccess: () => {
          setOrphanLeadToDelete(null);
          refetchAll();
        },
        onUndo: () => refetchAll(),
        onError: (error) => {
          toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to delete lead.',
            variant: 'destructive',
          });
        },
      });
    } finally {
      setDeletingOrphanLeadId(null);
    }
  }, [executeUndoable, orphanLeadToDelete, profile?.organization_id, refetchAll, toast]);

  // Handle edit booking
  const handleEditBooking = useCallback((booking: BookingWithRelations) => {
    setSelectedBooking(booking);
    setLinkGuestConversationOpen(false);
    setIsEditing(true);
    setEditData({
      guestName: booking.lead?.name || '',
      guestPhone: booking.lead?.phone || '',
      guestEmail: booking.lead?.email || '',
      leadNotes: booking.lead?.notes || '',
      checkIn: parseISO(booking.check_in),
      checkOut: parseISO(booking.check_out),
      guestCount: booking.guest_count || 1,
      status: booking.status,
      paymentStatus: (booking as unknown as { payment_status?: string }).payment_status || 'upcoming',
      notes: booking.notes || '',
      totalPrice: booking.total_price != null ? String(booking.total_price) : '',
      bookingSource: booking.booking_source || '',
    });
  }, []);

  // Save booking changes
  const handleSaveBooking = useCallback(async () => {
    if (!selectedBooking || !editData.checkIn || !editData.checkOut) return;

    // Validate form first
    if (!validateEditBooking()) return;

    // Check for overlapping bookings (exclude current booking)
    const newCheckInStr = format(editData.checkIn, 'yyyy-MM-dd');
    const newCheckOutStr = format(editData.checkOut, 'yyyy-MM-dd');
    if (accommodationData.checkBookingOverlap(selectedBooking.room_unit_id, newCheckInStr, newCheckOutStr, selectedBooking.id)) {
      toast({
        title: 'Room Not Available',
        description: 'This room has a booking that conflicts with the selected dates.',
        variant: 'destructive',
      });
      return;
    }

    // Store previous values for undo
    const previousBookingData = {
      check_in: selectedBooking.check_in,
      check_out: selectedBooking.check_out,
      guest_count: selectedBooking.guest_count,
      status: selectedBooking.status,
      payment_status: (selectedBooking as unknown as { payment_status?: string }).payment_status || 'upcoming',
      notes: selectedBooking.notes,
      total_price: selectedBooking.total_price,
      booking_source: selectedBooking.booking_source,
    };
    const previousLeadData = {
      name: selectedBooking.lead?.name || '',
      phone: selectedBooking.lead?.phone || '',
      email: selectedBooking.lead?.email || '',
      notes: selectedBooking.lead?.notes || '',
    };
    const guestName = editData.guestName.trim();
    const guestPhone = editData.guestPhone.trim();
    const normalizedGuestPhone = guestPhone ? normalizePhoneNumber(guestPhone, defaultCountryCode) : '';
    const guestEmail = editData.guestEmail.trim();
    const leadNotes = editData.leadNotes.trim();

    if (!normalizedGuestPhone && !guestEmail) {
      toast({
        title: 'Contact required',
        description: 'Enter at least a phone number or email before saving this booking.',
        variant: 'destructive',
      });
      return;
    }

    if (guestEmail && !/^\S+@\S+\.\S+$/.test(guestEmail)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    if (normalizedGuestPhone && !isValidPhoneNumber(normalizedGuestPhone, defaultCountryCode)) {
      toast({
        title: 'Invalid Phone Number',
        description: getPhoneValidationMessage(defaultCountryCode),
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    
    // Parse total price
    const parsedPrice = editData.totalPrice.trim() 
      ? parseFloat(editData.totalPrice.replace(/[^0-9.-]/g, '')) 
      : null;

    const newBookingData = {
      check_in: newCheckInStr,
      check_out: newCheckOutStr,
      guest_count: editData.guestCount,
      status: editData.status,
      payment_status: editData.paymentStatus,
      notes: editData.notes || null,
      total_price: parsedPrice,
      booking_source: editData.bookingSource || null,
    };

    // Check if lead data has changed
    const leadDataChanged = selectedBooking.lead_id && (
      guestName !== previousLeadData.name ||
      normalizedGuestPhone !== previousLeadData.phone ||
      guestEmail !== previousLeadData.email ||
      leadNotes !== previousLeadData.notes
    );

    await executeUndoable({
      action: async () => {
        // Update lead info if changed
        if (leadDataChanged) {
          const { error: leadError } = await supabase
            .from('leads')
            .update({ 
              name: guestName,
              phone: normalizedGuestPhone || null,
              email: guestEmail || null,
              notes: leadNotes || null,
            })
            .eq('id', selectedBooking.lead_id);
          if (leadError) throw leadError;
        }

        const { error } = await supabase
          .from('bookings')
          .update(newBookingData)
          .eq('id', selectedBooking.id);
        if (error) throw error;
        return { id: selectedBooking.id };
      },
      undoAction: async () => {
        // Restore lead data
        if (leadDataChanged) {
          await supabase
            .from('leads')
            .update({ 
              name: previousLeadData.name,
              phone: previousLeadData.phone || null,
              email: previousLeadData.email || null,
              notes: previousLeadData.notes || null,
            })
            .eq('id', selectedBooking.lead_id);
        }
        // Restore booking data
        await supabase
          .from('bookings')
          .update(previousBookingData)
          .eq('id', selectedBooking.id);
      },
      successMessage: 'Booking Updated',
      successDescription: `${guestName}'s booking has been updated`,
      duration: 10000,
      onSuccess: async () => {
        // Save note history if notes changed
        if (editData.notes !== previousBookingData.notes) {
          try {
            await noteHistory.addNoteHistory(
              selectedBooking.id, 
              editData.notes || null,
              profile?.full_name || profile?.email
            );
          } catch (error) {
            devError('Failed to save note history:', error);
          }
        }
        setSelectedBooking(null);
        setIsEditing(false);
        refetchAll();
      },
      onUndo: () => refetchAll(),
      onError: () => {
        toast({
          title: 'Error',
          description: 'Failed to update booking.',
          variant: 'destructive',
        });
      },
    });
    
    setIsSaving(false);
  }, [selectedBooking, editData, toast, refetchAll, executeUndoable, noteHistory, profile]);

  // Validate edit booking form
  const validateEditBooking = useCallback(() => {
    if (!editData.guestName.trim()) {
      toast({
        title: 'Missing Guest Name',
        description: 'Please enter the guest name.',
        variant: 'destructive',
      });
      return false;
    }

    if (!editData.checkIn || !editData.checkOut) {
      toast({
        title: 'Missing Dates',
        description: 'Please select check-in and check-out dates.',
        variant: 'destructive',
      });
      return false;
    }

    if (editData.checkIn >= editData.checkOut) {
      toast({
        title: 'Invalid Dates',
        description: 'Check-out date must be after check-in date.',
        variant: 'destructive',
      });
      return false;
    }

    if (editData.guestCount < 1) {
      toast({
        title: 'Invalid Guest Count',
        description: 'Guest count must be at least 1.',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  }, [editData, toast]);

  // Delete booking
  const handleDeleteBooking = useCallback(async () => {
    if (!selectedBooking) return;

    const guestName = selectedBooking.lead?.name || 'Guest';
    let archiveId: string | null = null;
    let fallbackBookingRecord: Record<string, unknown> | null = null;
    let recoverableDeleteUsed = true;

    setIsDeleting(true);

    try {
      await executeUndoable({
        action: async () => {
          // Best effort: don't block booking deletion on calendar API latency/outage.
          if (selectedBooking.calendar_event_id) {
            try {
              await Promise.race([
                deleteCalendarEvent(selectedBooking.id),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Calendar delete timed out')), 8000)),
              ]);
            } catch (calendarError) {
              devError('Calendar event deletion skipped:', calendarError);
            }
          }

          const { data, error } = await (supabase as any).rpc('archive_booking_deletion', {
            _booking_id: selectedBooking.id,
          });

          if (!error) {
            archiveId = data as string;
            recoverableDeleteUsed = true;
            return { deleted: true, archiveId };
          }

          devError('archive_booking_deletion failed, attempting direct delete fallback:', error);

          const { data: existingBooking, error: fetchError } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', selectedBooking.id)
            .single();

          if (fetchError) throw fetchError;

          fallbackBookingRecord = existingBooking as Record<string, unknown>;

          const { error: directDeleteError } = await supabase
            .from('bookings')
            .delete()
            .eq('id', selectedBooking.id);

          if (directDeleteError) throw directDeleteError;

          recoverableDeleteUsed = false;
          return { deleted: true, archiveId: null };
        },
        undoAction: async () => {
          if (archiveId) {
            const { data, error } = await (supabase as any).rpc('restore_deleted_booking_archive', {
              _archive_id: archiveId,
            });

            if (error) throw error;

            if (selectedBooking.calendar_event_id) {
              try {
                await syncBooking(data as string);
              } catch (syncError) {
                devError('Failed to re-sync restored booking:', syncError);
              }
            }
            return;
          }

          if (fallbackBookingRecord) {
            const { error } = await supabase
              .from('bookings')
              .insert(fallbackBookingRecord as never);
            if (error) throw error;
          }
        },
        successMessage: 'Booking Deleted',
        successDescription: recoverableDeleteUsed
          ? `${guestName}'s booking has been removed. It can be restored for 5 hours.`
          : `${guestName}'s booking has been removed.`,
        duration: 10000,
        onSuccess: () => {
          setDeleteConfirmOpen(false);
          setSelectedBooking(null);
          refetchAll();
          refetchDeletedBookingArchives();
        },
        onUndo: () => {
          refetchAll();
          refetchDeletedBookingArchives();
        },
        onError: (error) => {
          toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to delete booking.',
            variant: 'destructive',
          });
        },
      });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedBooking, deleteCalendarEvent, toast, refetchAll, executeUndoable, refetchDeletedBookingArchives, syncBooking]);

  // Batch Operations Handlers
  const toggleBookingSelection = useCallback((bookingId: string) => {
    if (bookingId.startsWith('external-')) {
      return;
    }

    setSelectedBookingIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        newSet.add(bookingId);
      }
      return newSet;
    });
  }, []);

  const selectAllVisibleBookings = useCallback(() => {
    const allIds = new Set(getActionableBookings(displayedBookings).map((booking) => booking.id));
    setSelectedBookingIds(allIds);
  }, [displayedBookings]);

  const clearSelection = useCallback(() => {
    setSelectedBookingIds(new Set());
  }, []);

  const handleBatchStatusChange = useCallback(async () => {
    if (selectedBookingIds.size === 0 || !batchNewStatus) return;

    setIsBatchProcessing(true);
    const bookingIds = Array.from(selectedBookingIds).filter((id) => !id.startsWith('external-'));
    if (bookingIds.length === 0) {
      setIsBatchProcessing(false);
      return;
    }
    const bookingsToUpdate = bookings.filter(b => bookingIds.includes(b.id));

    await executeUndoable({
      action: async () => {
        // Update all selected bookings
        const { error } = await supabase
          .from('bookings')
          .update({ status: batchNewStatus })
          .in('id', bookingIds);

        if (error) throw error;
        return { updatedCount: bookingIds.length };
      },
      undoAction: async () => {
        // Restore previous statuses
        for (const booking of bookingsToUpdate) {
          await supabase
            .from('bookings')
            .update({ status: booking.status })
            .eq('id', booking.id);
        }
      },
      successMessage: 'Batch Update Complete',
      successDescription: `Updated status for ${bookingIds.length} booking${bookingIds.length !== 1 ? 's' : ''}`,
      onSuccess: () => {
        setBatchStatusChangeOpen(false);
        clearSelection();
        setBatchNewStatus('');
        refetchAll();
      },
      onError: () => {
        toast({
          title: 'Error',
          description: 'Failed to update bookings.',
          variant: 'destructive',
        });
      },
    });

    setIsBatchProcessing(false);
  }, [selectedBookingIds, batchNewStatus, bookings, executeUndoable, refetchAll, toast, clearSelection]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedBookingIds.size === 0) return;

    setIsBatchProcessing(true);
    const bookingIds = Array.from(selectedBookingIds).filter((id) => !id.startsWith('external-'));
    if (bookingIds.length === 0) {
      setIsBatchProcessing(false);
      return;
    }
    const bookingsToDelete = bookings.filter(b => bookingIds.includes(b.id));
    const archivedBookings: Array<{ archiveId: string; bookingId: string; hadCalendarEvent: boolean }> = [];
    const directDeletedBookings: Array<{ bookingRecord: Record<string, unknown>; hadCalendarEvent: boolean }> = [];

    await executeUndoable({
      action: async () => {
        for (const booking of bookingsToDelete) {
          if (booking.calendar_event_id) {
            try {
              await Promise.race([
                deleteCalendarEvent(booking.id),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Calendar delete timed out')), 8000)),
              ]);
            } catch (calendarError) {
              devError('Batch calendar event deletion skipped:', calendarError);
            }
          }

          const { data, error } = await (supabase as any).rpc('archive_booking_deletion', {
            _booking_id: booking.id,
          });

          if (error) {
            devError('archive_booking_deletion failed in batch, attempting direct delete fallback:', error);
            const { data: existingBooking, error: fetchError } = await supabase
              .from('bookings')
              .select('*')
              .eq('id', booking.id)
              .single();

            if (fetchError) throw fetchError;

            const { error: directDeleteError } = await supabase
              .from('bookings')
              .delete()
              .eq('id', booking.id);

            if (directDeleteError) throw directDeleteError;

            directDeletedBookings.push({
              bookingRecord: existingBooking as Record<string, unknown>,
              hadCalendarEvent: Boolean(booking.calendar_event_id),
            });
            continue;
          }

          archivedBookings.push({
            archiveId: data as string,
            bookingId: booking.id,
            hadCalendarEvent: Boolean(booking.calendar_event_id),
          });
        }

        return { deletedCount: bookingIds.length };
      },
      undoAction: async () => {
        for (const archivedBooking of archivedBookings) {
          const { data, error } = await (supabase as any).rpc('restore_deleted_booking_archive', {
            _archive_id: archivedBooking.archiveId,
          });

          if (error) throw error;

          if (archivedBooking.hadCalendarEvent) {
            try {
              await syncBooking(data as string);
            } catch (syncError) {
              devError('Failed to re-sync restored booking:', syncError);
            }
          }
        }

        for (const directDeletedBooking of directDeletedBookings) {
          const { error } = await supabase
            .from('bookings')
            .insert(directDeletedBooking.bookingRecord as never);

          if (error) throw error;
        }
      },
      successMessage: 'Batch Delete Complete',
      successDescription: `Deleted ${bookingIds.length} booking${bookingIds.length !== 1 ? 's' : ''}. They can be restored for 5 hours.`,
      onSuccess: () => {
        setBatchDeleteConfirmOpen(false);
        clearSelection();
        refetchAll();
        refetchDeletedBookingArchives();
      },
      onUndo: () => {
        refetchAll();
        refetchDeletedBookingArchives();
      },
      onError: (error) => {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to delete bookings.',
          variant: 'destructive',
        });
      },
    });

    setIsBatchProcessing(false);
  }, [selectedBookingIds, bookings, executeUndoable, refetchAll, toast, clearSelection, deleteCalendarEvent, refetchDeletedBookingArchives, syncBooking]);

  // Export to CSV
  const exportToCSV = useCallback(() => {
    if (displayedBookings.length === 0) {
      toast({
        title: 'No Data',
        description: 'There are no bookings to export.',
        variant: 'default',
      });
      return;
    }

    // Prepare CSV headers
    const headers = ['Guest Name', 'Phone', 'Email', 'Room', 'Check-in', 'Check-out', 'Nights', 'Guests', 'Status', 'Payment Status', 'Total Price', 'Notes'];

    // Prepare CSV rows
    const rows = displayedBookings.map(booking => {
      const nights = differenceInDays(parseISO(booking.check_out), parseISO(booking.check_in));
      return [
        booking.lead?.name || booking.guest_name || booking.title || 'N/A',
        booking.lead?.phone || booking.guest_phone || 'N/A',
        booking.lead?.email || booking.guest_email || 'N/A',
        booking.room?.name || 'N/A',
        booking.check_in,
        booking.check_out,
        nights,
        booking.guest_count || 'N/A',
        booking.status,
        booking.payment_status || 'upcoming',
        booking.total_price || '',
        (booking.notes || '').replace(/"/g, '""'), // Escape quotes
      ];
    });

    // Format CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `bookings-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Export Complete',
      description: `Exported ${displayedBookings.length} booking${displayedBookings.length !== 1 ? 's' : ''}`,
    });
  }, [displayedBookings, toast]);

  // Save current filters as preset
  const handleSavePreset = useCallback(async () => {
    if (!presetName.trim()) {
      toast({
        title: 'Missing Name',
        description: 'Please enter a name for the preset',
        variant: 'destructive',
      });
      return;
    }

    const currentFilters = {
      searchTerm: filters.searchTerm,
      searchScope: filters.searchScope,
      statusFilter: localStatusFilter,
      roomFilter: localRoomFilter,
      dateFilter: localDateFilter,
      customDateRange: localCustomDateRange,
      sortOption: localSortOption,
    };

    await filterPresets.savePreset(presetName, currentFilters as any, setAsDefault);
    setSavePresetDialogOpen(false);
    setPresetName('');
    setSetAsDefault(false);
  }, [presetName, setAsDefault, filters, localStatusFilter, localRoomFilter, localDateFilter, localCustomDateRange, localSortOption, filterPresets, toast]);

  // Load a preset
  const handleLoadPreset = useCallback((preset: any) => {
    if (!preset) return;
    const presetFilters = preset.filters;
    updateFilters({ 
      searchTerm: presetFilters.searchTerm || '',
      searchScope: presetFilters.searchScope || 'all',
    });
    setLocalStatusFilter(presetFilters.statusFilter || 'all');
    setLocalRoomFilter(presetFilters.roomFilter || 'all');
    setLocalDateFilter(presetFilters.dateFilter || 'upcoming');
    setLocalCustomDateRange(presetFilters.customDateRange || { from: undefined, to: undefined });
    setLocalSortOption(presetFilters.sortOption || 'check_in_asc');
    
    toast({
      title: 'Preset Loaded',
      description: `Applied "${preset.name}" filter preset`,
    });
  }, [updateFilters, toast]);

  // View note history
  const handleViewNoteHistory = useCallback((bookingId: string) => {
    setViewingHistoryForBooking(bookingId);
    setNoteHistoryDialogOpen(true);
  }, []);

  const handleRestoreDeletedBooking = useCallback(async (archiveId: string, shouldSyncCalendar: boolean) => {
    const restoredBookingId = await restoreArchive.mutateAsync(archiveId);
    if (shouldSyncCalendar) {
      try {
        await syncBooking(restoredBookingId);
      } catch (syncError) {
        devError('Failed to re-sync restored booking:', syncError);
      }
    }
    await refetchAll();
    await refetchDeletedBookingArchives();
  }, [refetchAll, refetchDeletedBookingArchives, restoreArchive, syncBooking]);

  const hasActiveFilters = localStatusFilter !== 'all' || 
    localRoomFilter !== 'all' || 
    localDateFilter !== 'upcoming' || 
    localSortOption !== 'check_in_asc' ||
    filters.searchTerm.trim() !== '' ||
    localCustomDateRange.from || 
    localCustomDateRange.to;

  const actionableDisplayedBookings = useMemo(() => getActionableBookings(displayedBookings), [displayedBookings]);
  const selectedActionableCount = useMemo(
    () => Array.from(selectedBookingIds).filter((bookingId) => !bookingId.startsWith('external-')).length,
    [selectedBookingIds]
  );

  if (isLoading) {
    return <CardListSkeleton count={5} />;
  }

  return (
    <div className="space-y-4">
      {/* Batch Operations Toolbar */}
      {selectedActionableCount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
              {selectedActionableCount} booking{selectedActionableCount !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBatchStatusChangeOpen(true)}
                className="h-8"
              >
                Change Status
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBatchDeleteConfirmOpen(true)}
                className="h-8"
              >
                Delete All
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearSelection}
                className="h-8"
              >
                Clear Selection
              </Button>
            </div>
          </div>
        </div>
      )}

      {deletedBookingArchives.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <History className="w-4 h-4 text-warning" />
                  Recently Deleted Bookings
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Deleted bookings remain recoverable for 5 hours. After that, the archived copy is permanently removed.
                </p>
              </div>
              <Badge variant="outline">{deletedBookingArchives.length} recoverable</Badge>
            </div>
            <div className="space-y-2">
              {deletedBookingArchives.slice(0, 3).map((archive) => {
                const bookingData = archive.booking_data as {
                  check_in?: string;
                  check_out?: string;
                  calendar_event_id?: string | null;
                };
                const leadData = archive.lead_data as { name?: string | null } | null;

                return (
                  <div key={archive.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background/80 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{leadData?.name || 'Deleted booking'}</p>
                      <p className="text-xs text-muted-foreground">
                        {bookingData.check_in || 'Unknown check-in'} to {bookingData.check_out || 'Unknown check-out'}
                      </p>
                      <p className="text-xs text-muted-foreground">{getRecoveryWindowLabel(archive.expires_at)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={restoreArchive.isPending}
                      onClick={() => handleRestoreDeletedBooking(archive.id, Boolean(bookingData.calendar_event_id))}
                    >
                      {restoreArchive.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Restore
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toolbar */}
      <div className="space-y-2">
        <div className="flex gap-2 md:gap-3 items-center">
          <div className="relative flex-1 min-w-0 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
              <Input
                placeholder={
                  filters.searchScope === 'guest' ? "Search by guest name..." :
                  filters.searchScope === 'contact' ? "Search by email or phone..." :
                  filters.searchScope === 'notes' ? "Search in notes..." :
                  "Search all fields..."
                }
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
                className="pl-8 md:pl-10 h-8 md:h-9 text-sm"
              />
            </div>
            <Select
              value={filters.searchScope}
              onValueChange={(value) => updateFilters({ searchScope: value as any })}
            >
              <SelectTrigger className="h-8 md:h-9 w-[100px] md:w-[120px] text-xs md:text-sm shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Fields</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
                <SelectItem value="contact">Contact</SelectItem>
                <SelectItem value="notes">Notes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 md:h-9 gap-1.5 shrink-0"
            onClick={() => setNewBookingOpen(true)}
            disabled={!canOpenCreateBooking}
            title={!canOpenCreateBooking
              ? requiresPropertySelection
                ? 'Select a property before creating a booking'
                : 'Property context is not ready for creating bookings'
              : undefined}
          >
            <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden sm:inline">New Booking</span>
          </Button>
          <Button
            variant={(showFilters || showMobileFiltersDrawer) ? "secondary" : "outline"}
            size="icon"
            className="h-8 w-8 md:h-9 md:w-9 shrink-0"
            onClick={() => {
              if (isMobile) {
                setShowMobileFiltersDrawer(!showMobileFiltersDrawer);
              } else {
                setShowFilters(!showFilters);
              }
            }}
            title="Toggle filters"
          >
            <Filter className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </Button>
          <div className="flex items-center gap-0.5 p-0.5 md:p-1 bg-secondary/50 rounded-lg shrink-0">
            <Toggle
              pressed={viewMode === 'kanban'}
              onPressedChange={() => setViewMode('kanban')}
              size="sm"
              className="h-7 w-7 md:h-8 md:w-8 p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              <LayoutGrid className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </Toggle>
            <Toggle
              pressed={viewMode === 'list'}
              onPressedChange={() => setViewMode('list')}
              size="sm"
              className="h-7 w-7 md:h-8 md:w-8 p-0 data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              <List className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </Toggle>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 md:h-9 gap-1.5 shrink-0"
            onClick={exportToCSV}
            title="Export to CSV"
          >
            <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="hidden sm:inline text-xs">Export</span>
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-secondary/30 border border-border animate-fade-in">
            <Select value={localDateFilter} onValueChange={(v) => {
              setLocalDateFilter(v as DateFilter);
              if (v !== 'custom') setLocalCustomDateRange({ from: undefined, to: undefined });
            }}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="this_week">This Week</SelectItem>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="past">Past</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {localDateFilter === 'custom' && (
              <ConversationDateFilter
                dateRange={localCustomDateRange}
                onChange={setLocalCustomDateRange}
              />
            )}

            <Select value={localStatusFilter} onValueChange={setLocalStatusFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(statusConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center gap-1.5">
                      {config.icon}
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={localRoomFilter} onValueChange={setLocalRoomFilter}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue placeholder="Room" />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="all">All Rooms</SelectItem>
                {rooms.map((room) => (
                  <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={localSortOption} onValueChange={(v) => setLocalSortOption(v as SortOption)}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="check_in_asc">Check-in ↑</SelectItem>
                <SelectItem value="check_in_desc">Check-in ↓</SelectItem>
                <SelectItem value="created_at_desc">Newest First</SelectItem>
                <SelectItem value="guest_name">Guest Name</SelectItem>
              </SelectContent>
            </Select>

            {/* Filter Preset Controls */}
            <div className="flex items-center gap-2 ml-auto">
              <Select 
                value={filterPresets.defaultPreset?.id || ''} 
                onValueChange={(value) => {
                  const preset = filterPresets.presets.find(p => p.id === value);
                  if (preset) handleLoadPreset(preset);
                }}
              >
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <Bookmark className="w-3 h-3 mr-1" />
                  <SelectValue placeholder="Load preset" />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  {filterPresets.presets.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      No saved presets
                    </div>
                  )}
                  {filterPresets.presets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      <div className="flex items-center gap-1.5">
                        {preset.is_default && <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />}
                        {preset.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-xs gap-1.5"
                onClick={() => setSavePresetDialogOpen(true)}
                disabled={!hasActiveFilters}
                title={hasActiveFilters ? "Save current filters as preset" : "No active filters to save"}
              >
                <Save className="w-3 h-3" />
                Save
              </Button>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
                <XCircle className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}

            <div className="flex items-center ml-auto text-xs text-muted-foreground">
              {displayedBookings.length} of {allBookingsWithExternal.length} bookings
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {!hasAnyBookingContent ? (
        <Card className="glass border-dashed">
          <CardContent className="p-8 md:p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <CalendarCheck className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No bookings yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              Bookings from conversations or synced from your calendar will appear here.
            </p>
            <Button
              onClick={() => setNewBookingOpen(true)}
              disabled={!canOpenCreateBooking}
              title={!canOpenCreateBooking
                ? requiresPropertySelection
                  ? 'Select a property before creating a booking'
                  : 'Property context is not ready for creating bookings'
                : undefined}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Booking
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'kanban' ? (
        <BookingKanbanBoard
          bookings={displayedBookings as any}
          orphanLeads={orphanLeads as OrphanLead[]}
          rooms={rooms as any}
          onStatusChange={updateBookingStatus}
          onBookingClick={handleBookingClick as any}
          onOrphanLeadClick={handleOrphanLeadClick}
          onDeleteOrphanLead={setOrphanLeadToDelete}
          onEditBooking={handleEditBooking as any}
          onSyncBooking={syncBooking}
          isSyncing={isSyncing}
          isUpdating={isUpdatingBooking}
          deletingOrphanLeadId={deletingOrphanLeadId}
          formatCurrency={formatCurrency}
        />
      ) : displayedBookings.length === 0 ? (
        <Card className="glass border-dashed">
          <CardContent className="p-8 md:p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No matching bookings</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              No bookings match your current filters.
            </p>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <XCircle className="w-4 h-4 mr-2" />
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:gap-3">
          {displayedBookings.map((booking, index) => {
            const nights = differenceInDays(parseISO(booking.check_out), parseISO(booking.check_in));
            return (
              <Card
                key={booking.id}
                className="glass hover:border-primary/50 transition-all cursor-pointer animate-slide-up"
                style={{ animationDelay: `${index * 30}ms` }}
                onClick={() => handleBookingClick(booking)}
              >
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedBookingIds.has(booking.id)}
                        disabled={booking.isExternal}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleBookingSelection(booking.id);
                        }}
                        className="w-4 h-4 rounded cursor-pointer shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                        <BedDouble className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-foreground truncate">
                          {booking.room?.name || 'Unknown Room'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {booking.lead?.name || 'Unknown Guest'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Quick Status Change Dropdown */}
                      <Select
                        value={booking.status}
                        onValueChange={(newStatus) => {
                          if (newStatus !== booking.status) {
                            updateBookingStatus(booking.id, newStatus);
                          }
                        }}
                      >
                        <SelectTrigger 
                          className={cn(
                            "h-6 text-[10px] px-2 gap-1 w-auto min-w-[90px]",
                            statusConfig[booking.status]?.color
                          )}
                          disabled={booking.isExternal}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1">
                            {statusConfig[booking.status]?.icon}
                            <span>{statusConfig[booking.status]?.label}</span>
                          </div>
                        </SelectTrigger>
                        <SelectContent className="z-[60]" onClick={(e) => e.stopPropagation()}>
                          {editableStatusOptions.map(([value, config]) => (
                            <SelectItem key={value} value={value}>
                              <div className="flex items-center gap-1.5">
                                {config.icon}
                                {config.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Badge variant="outline" className={cn("text-[10px] h-5 shrink-0", paymentStatusConfig[((booking as unknown as { payment_status?: string }).payment_status || 'upcoming')]?.color)}>
                        {paymentStatusConfig[((booking as unknown as { payment_status?: string }).payment_status || 'upcoming')]?.label}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={booking.isExternal}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditBooking(booking);
                        }}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs gap-2 mt-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span className="font-medium text-foreground">
                        {format(parseISO(booking.check_in), 'MMM d')}
                      </span>
                      <ArrowRight className="w-2.5 h-2.5" />
                      <span className="font-medium text-foreground">
                        {format(parseISO(booking.check_out), 'MMM d')}
                      </span>
                      <span>• {nights}n</span>
                    </div>
                    {booking.total_price != null && (
                      <span className="font-semibold text-primary">
                        {formatCurrency(booking.total_price)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* View/Edit Booking Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => {
        if (!open) {
          setLinkGuestConversationOpen(false);
          setSelectedBooking(null);
          setIsEditing(false);
        }
      }}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BedDouble className="w-5 h-5 text-primary" />
              {isEditing ? 'Edit Booking' : 'Booking Details'}
              {selectedBooking?.isExternal && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="ml-auto bg-orange-500/20 text-orange-500 border-orange-500/30">
                        <Calendar className="w-3 h-3 mr-1" />
                        External
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>From connected calendar - read only</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedBooking && (
                <>
                  {selectedBooking.room?.name} • {selectedBooking.lead?.name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
              {/* Guest Info - Editable in edit mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Guest Name</Label>
                  {isEditing ? (
                    <Input
                      value={editData.guestName}
                      onChange={(e) => setEditData(prev => ({ ...prev, guestName: e.target.value }))}
                      placeholder="Enter guest name"
                    />
                  ) : (
                    <div className="h-10 flex items-center">
                      {selectedBooking.lead_id && selectedBooking.lead ? (
                        <ClickableLeadName
                          lead={{
                            id: selectedBooking.lead_id,
                            name: selectedBooking.lead.name || 'Unknown',
                            email: selectedBooking.lead.email,
                            phone: selectedBooking.lead.phone,
                            status: 'new',
                            created_at: '',
                          }}
                          className="font-medium text-primary hover:underline cursor-pointer"
                        />
                      ) : (
                        <p className="font-medium">{selectedBooking.lead?.name || 'Unknown'}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Room</Label>
                  <p className="h-10 flex items-center font-medium">{selectedBooking.room?.name || 'Unknown'}</p>
                </div>
              </div>

              {/* Contact Info - Editable in edit mode */}
              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={editData.guestPhone}
                      onChange={(e) => setEditData(prev => ({ ...prev, guestPhone: e.target.value }))}
                      placeholder={phonePlaceholder}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={editData.guestEmail}
                      onChange={(e) => setEditData(prev => ({ ...prev, guestEmail: e.target.value }))}
                      placeholder="Enter email address"
                    />
                  </div>
                </div>
              ) : (selectedBooking.lead?.phone || selectedBooking.lead?.email) && (
                <div className="p-3 rounded-lg bg-secondary/50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedBooking.lead?.phone && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Phone</p>
                        <p className="font-medium text-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {selectedBooking.lead.phone}
                        </p>
                      </div>
                    )}
                    {selectedBooking.lead?.email && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Email</p>
                        <p className="font-medium text-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {selectedBooking.lead.email}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lead Notes - Editable in edit mode */}
              {(isEditing || selectedBooking.lead?.notes) && (
                <div className="space-y-2">
                  <Label>Lead Notes</Label>
                  {isEditing ? (
                    <Input
                      value={editData.leadNotes}
                      onChange={(e) => setEditData(prev => ({ ...prev, leadNotes: e.target.value }))}
                      placeholder="Add notes about this lead..."
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground p-2 rounded-lg bg-secondary/30">{selectedBooking.lead?.notes}</p>
                  )}
                </div>
              )}

              {/* Editable Fields */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Check-in</Label>
                    {isEditing ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
                            <Calendar className="mr-2 h-4 w-4" />
                            {editData.checkIn ? format(editData.checkIn, 'MMM d, yyyy') : 'Select'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[60]">
                          <CalendarPicker
                            mode="single"
                            selected={editData.checkIn || undefined}
                            onSelect={(date) => date && setEditData(prev => ({
                              ...prev,
                              checkIn: date,
                              checkOut: prev.checkOut && prev.checkOut <= date ? addDays(date, 1) : prev.checkOut
                            }))}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <p className="h-10 flex items-center font-medium">{format(parseISO(selectedBooking.check_in), 'MMM d, yyyy')}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Check-out</Label>
                    {isEditing ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
                            <Calendar className="mr-2 h-4 w-4" />
                            {editData.checkOut ? format(editData.checkOut, 'MMM d, yyyy') : 'Select'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[60]">
                          <CalendarPicker
                            mode="single"
                            selected={editData.checkOut || undefined}
                            onSelect={(date) => date && setEditData(prev => ({ ...prev, checkOut: date }))}
                            disabled={(date) => editData.checkIn ? date <= editData.checkIn : false}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <p className="h-10 flex items-center font-medium">{format(parseISO(selectedBooking.check_out), 'MMM d, yyyy')}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Guests</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        min={1}
                        value={editData.guestCount}
                        onChange={(e) => setEditData(prev => ({ ...prev, guestCount: parseInt(e.target.value) || 1 }))}
                      />
                    ) : (
                      <p className="h-10 flex items-center font-medium gap-1">
                        <Users className="w-4 h-4" />
                        {selectedBooking.guest_count || 1}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    {isEditing ? (
                      <Select value={editData.status} onValueChange={(v) => setEditData(prev => ({ ...prev, status: v }))}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[60]">
                          {editableStatusOptions.map(([value, config]) => (
                            <SelectItem key={value} value={value}>
                              <div className="flex items-center gap-1.5">
                                {config.icon}
                                {config.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="h-10 flex items-center">
                        <Badge variant="outline" className={cn("text-xs", statusConfig[selectedBooking.status]?.color)}>
                          {statusConfig[selectedBooking.status]?.icon}
                          <span className="ml-1">{statusConfig[selectedBooking.status]?.label}</span>
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Status & Booking Source */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Payment Status</Label>
                    {isEditing ? (
                      <Select value={editData.paymentStatus} onValueChange={(v) => setEditData(prev => ({ ...prev, paymentStatus: v }))}>
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[60]">
                          {Object.entries(paymentStatusConfig).map(([value, config]) => (
                            <SelectItem key={value} value={value}>
                              {config.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="h-10 flex items-center">
                        <Badge variant="outline" className={cn("text-xs", paymentStatusConfig[((selectedBooking as unknown as { payment_status?: string }).payment_status || 'upcoming')]?.color)}>
                          {paymentStatusConfig[((selectedBooking as unknown as { payment_status?: string }).payment_status || 'upcoming')]?.label}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Booking Source */}
                  {(() => {
                    const room = rooms.find(r => r.id === selectedBooking.room_unit_id);
                    const calendarSources = room?.calendar_sources as Record<string, string> | null;
                    const sourceOptions = calendarSources 
                      ? [...new Set(Object.values(calendarSources))].filter(s => s && s.trim() !== '')
                      : [];
                    
                    return (
                      <div className="space-y-2">
                        <Label>Booking Source</Label>
                        {isEditing ? (
                          <Select 
                            value={editData.bookingSource || "_none"} 
                            onValueChange={(v) => setEditData(prev => ({ ...prev, bookingSource: v === "_none" ? "" : v }))}
                          >
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select source" />
                            </SelectTrigger>
                            <SelectContent className="z-[60]">
                              <SelectItem value="_none">Not specified</SelectItem>
                              {sourceOptions.map((source) => (
                                <SelectItem key={source} value={source}>
                                  {source}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="h-10 flex items-center">
                            <Badge variant="outline">{selectedBooking.booking_source || 'Not specified'}</Badge>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {(isEditing || selectedBooking.notes) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Notes</Label>
                      {selectedBooking && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleViewNoteHistory(selectedBooking.id)}
                        >
                          <History className="w-3 h-3 mr-1" />
                          View History
                        </Button>
                      )}
                    </div>
                    {isEditing ? (
                      <Input
                        value={editData.notes}
                        onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Add notes..."
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{selectedBooking.notes}</p>
                    )}
                  </div>
                )}

                {/* Total Price - Editable inline */}
                {(() => {
                  const room = rooms.find(r => r.id === selectedBooking.room_unit_id);
                  const calculatedPrice = room 
                    ? calculateBookingPrice(selectedBooking.check_in, selectedBooking.check_out, selectedBooking.guest_count || 1, room)
                    : null;
                  const displayPrice = selectedBooking.total_price ?? calculatedPrice;
                  const isCalculated = selectedBooking.total_price == null && calculatedPrice != null;

                  // Calculate dynamic pricing for editing mode
                  let dynamicPricing = null;
                  if (isEditing && room && editData.checkIn && editData.checkOut && editData.guestCount) {
                    const checkInStr = format(editData.checkIn, 'yyyy-MM-dd');
                    const checkOutStr = format(editData.checkOut, 'yyyy-MM-dd');
                    const property = room?.property_id
                      ? properties.find((item) => item.id === room.property_id)
                      : selectedPropertyId !== 'all'
                        ? properties.find((item) => item.id === selectedPropertyId)
                        : null;

                    dynamicPricing = calculateDynamicPricing(
                      checkInStr,
                      checkOutStr,
                      editData.guestCount,
                      room,
                      bookings.filter(b => b.id !== selectedBooking.id), // Exclude current booking
                      rooms.filter(r => r.is_active).length,
                      getPropertyPricingContext(property ? {
                        propertyName: property.name,
                        propertyDescription: property.description,
                        addressLine1: property.address_line_1,
                        city: property.city,
                        state: property.state,
                        region: property.region,
                        country: property.country,
                        postalCode: property.postal_code,
                      } : null, {
                        country: room.pricing_country,
                        region: room.pricing_region,
                        city: room.pricing_city,
                        district: room.pricing_district,
                      }),
                      activeProfiles.map((profile) => ({
                        scope: profile.scope,
                        country: profile.country,
                        region: profile.region,
                        city: profile.city,
                        district: profile.district,
                        multiplier: profile.multiplier,
                        marketPositioning: profile.market_positioning,
                        adjustmentLabel: profile.adjustment_label,
                        isActive: profile.is_active,
                        displayOrder: profile.display_order,
                      }))
                    );
                  }

                  return (
                    <div className="space-y-2">
                      <Label>Total Price</Label>
                      {isEditing ? (
                        <div className="space-y-3">
                          {/* Dynamic Pricing Suggestion in Edit Mode */}
                          {dynamicPricing && (
                            <DynamicPricingSuggestionComponent 
                              suggestion={dynamicPricing}
                              formatCurrency={formatCurrency}
                            />
                          )}
                          <Input
                            type="text"
                            value={editData.totalPrice}
                            onChange={(e) => setEditData(prev => ({ ...prev, totalPrice: e.target.value }))}
                            placeholder={calculatedPrice != null ? `Suggested: ${formatCurrency(calculatedPrice)}` : "Enter price (e.g., 5000)"}
                          />
                          {calculatedPrice != null && !editData.totalPrice && (
                            <p className="text-xs text-muted-foreground">
                              Leave empty to keep calculated price
                            </p>
                          )}
                        </div>
                      ) : displayPrice != null ? (
                        <div className="p-3 rounded-lg bg-primary/10 flex items-center justify-between">
                          {isCalculated && (
                            <Badge variant="outline" className="text-[10px] h-4">Calculated</Badge>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-primary">{formatCurrency(displayPrice)}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setIsEditing(true)}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Not set</span>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8"
                            onClick={() => setIsEditing(true)}
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Set Price
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 flex-col sm:flex-row flex-shrink-0 pt-4 border-t mt-2">
            {isEditing ? (
              <>
                <Button 
                  variant="destructive" 
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="sm:mr-auto"
                  disabled={selectedBooking?.isExternal}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSaveBooking} disabled={isSaving || selectedBooking?.isExternal}>
                  {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="ghost" 
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:mr-auto"
                  disabled={selectedBooking?.isExternal}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLinkGuestConversationOpen(true)}
                  disabled={selectedBooking?.isExternal || !selectedBooking?.lead_id}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Link Conversation
                </Button>
                <Button variant="outline" onClick={() => setSelectedBooking(null)}>
                  Close
                </Button>
                <Button onClick={() => setIsEditing(true)} disabled={selectedBooking?.isExternal}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LinkGuestConversationDialog
        open={linkGuestConversationOpen}
        onOpenChange={setLinkGuestConversationOpen}
        booking={selectedBooking ? {
          id: selectedBooking.id,
          check_in: selectedBooking.check_in,
          check_out: selectedBooking.check_out,
          room_unit_id: selectedBooking.room_unit_id,
          room_name: selectedBooking.room?.name || 'Unknown Room',
          lead_id: selectedBooking.lead_id,
          lead_name: selectedBooking.lead?.name || 'Unknown Guest',
          status: selectedBooking.status,
        } : null}
        onLinked={() => {
          setLinkGuestConversationOpen(false);
          setSelectedBooking(null);
          refetchAll();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the booking for {selectedBooking?.lead?.name || 'this guest'} and move it into a recoverable archive for 5 hours.
              <span className="block mt-2">
                After 5 hours, the deleted record is permanently removed and can no longer be restored.
              </span>
              {selectedBooking?.calendar_event_id && (
                <span className="block mt-2 font-medium">
                  The associated Google Calendar event will also be removed.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBooking}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!orphanLeadToDelete} onOpenChange={(open) => {
        if (!open) {
          setOrphanLeadToDelete(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {orphanLeadToDelete?.name || 'this lead'} from the new inquiries list.
              You can restore it for {getRecoveryWindowLabel()}; after that it is permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingOrphanLeadId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrphanLead}
              disabled={!!deletingOrphanLeadId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingOrphanLeadId && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete Lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateBookingDialog
        open={newBookingOpen}
        onOpenChange={(open) => {
          setNewBookingOpen(open);
          if (!open) {
            setNewBookingPrefill(null);
          }
        }}
        rooms={rooms}
        bookings={bookings}
        properties={properties}
        selectedPropertyId={selectedPropertyId}
        requiresPropertySelection={requiresPropertySelection}
        formatCurrency={formatCurrency}
        checkBookingOverlap={accommodationData.checkBookingOverlap}
        syncBooking={syncBooking}
        deleteCalendarEvent={deleteCalendarEvent}
        prefilledBooking={newBookingPrefill}
        onSuccess={refetchAll}
      />

      {/* Batch Status Change Dialog */}
      <Dialog open={batchStatusChangeOpen} onOpenChange={setBatchStatusChangeOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Change Status</DialogTitle>
            <DialogDescription>
              Update status for {selectedActionableCount} booking{selectedActionableCount !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="batch-status">New Status</Label>
              <Select value={batchNewStatus} onValueChange={setBatchNewStatus}>
                <SelectTrigger id="batch-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {editableStatusOptions.map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchStatusChangeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBatchStatusChange}
              disabled={isBatchProcessing || !batchNewStatus}
            >
              {isBatchProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Delete Confirmation Dialog */}
      <AlertDialog open={batchDeleteConfirmOpen} onOpenChange={setBatchDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bookings?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedActionableCount} booking{selectedActionableCount !== 1 ? 's' : ''}?
              <span className="block mt-2">
                Deleted bookings can be restored for 5 hours from the Recently Deleted section. After that window, they are permanently removed.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              disabled={isBatchProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBatchProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mobile Filters Drawer */}
      <Sheet open={showMobileFiltersDrawer} onOpenChange={setShowMobileFiltersDrawer}>
        <SheetContent side="bottom" className="h-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Date Range</Label>
              <Select value={localDateFilter} onValueChange={(v) => {
                setLocalDateFilter(v as DateFilter);
                if (v !== 'custom') setLocalCustomDateRange({ from: undefined, to: undefined });
              }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="past">Past</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Status</Label>
              <Select value={localStatusFilter} onValueChange={setLocalStatusFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="checked_out">Checked Out</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Room</Label>
              <Select value={localRoomFilter} onValueChange={setLocalRoomFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All rooms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rooms</SelectItem>
                  {rooms.filter(r => r.is_active).map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Sort By</Label>
              <Select value={localSortOption} onValueChange={(v) => setLocalSortOption(v as SortOption)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Sort option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="check_in_asc">Check-in (Earliest)</SelectItem>
                  <SelectItem value="check_in_desc">Check-in (Latest)</SelectItem>
                  <SelectItem value="created_at_desc">Recently Created</SelectItem>
                  <SelectItem value="guest_name">Guest Name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => {
                  resetFilters();
                  setLocalDateFilter('upcoming');
                  setLocalStatusFilter('all');
                  setLocalRoomFilter('all');
                  setLocalSortOption('check_in_asc');
                  setLocalCustomDateRange({ from: undefined, to: undefined });
                }}
              >
                Reset
              </Button>
              <Button
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => setShowMobileFiltersDrawer(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Save Preset Dialog */}
      <Dialog open={savePresetDialogOpen} onOpenChange={setSavePresetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Filter Preset</DialogTitle>
            <DialogDescription>
              Save your current filter settings for quick access later
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="preset-name">Preset Name</Label>
              <Input
                id="preset-name"
                placeholder="e.g. Upcoming Confirmed"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && presetName.trim()) {
                    handleSavePreset();
                  }
                }}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="set-default"
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
                className="rounded border-input"
              />
              <Label htmlFor="set-default" className="text-sm font-normal cursor-pointer">
                Set as default preset
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSavePresetDialogOpen(false);
                setPresetName('');
                setSetAsDefault(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePreset}
              disabled={!presetName.trim() || filterPresets.isSaving}
            >
              {filterPresets.isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Note History Dialog */}
      <Dialog open={noteHistoryDialogOpen} onOpenChange={setNoteHistoryDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Note History</DialogTitle>
            <DialogDescription>
              View all changes made to booking notes
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {noteHistory.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : noteHistory.history.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No note history available</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {noteHistory.history.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="p-3 rounded-lg border bg-muted/30 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium">{entry.user_name || 'Unknown User'}</span>
                      <span>{formatDistanceToNow(parseISO(entry.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm">
                      {entry.note_text || <span className="italic text-muted-foreground">(note removed)</span>}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNoteHistoryDialogOpen(false);
                setViewingHistoryForBooking(undefined);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
