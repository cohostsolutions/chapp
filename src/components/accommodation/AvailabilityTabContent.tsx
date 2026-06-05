import { useState, useMemo, useCallback, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { useBookingConflicts } from '@/hooks/useBookingConflicts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useOrganizationPhone } from '@/hooks/useOrganizationPhone';
import { getPhoneValidationMessage, isValidPhoneNumber, normalizePhoneNumber } from '@/lib/phone';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Calendar,
  ChevronLeft,
  ChevronRight,
  BedDouble,
  Loader2,
  Users,
  Plus,
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  Phone,
  Mail,
  Moon,
  TrendingUp,
  Search,
  LogIn,
  LogOut,
  Edit2,
  Save,
  X,
  AlertTriangle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ClickableLeadName } from '@/components/leads/ClickableLeadName';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths,
  parseISO,
  startOfWeek,
  endOfWeek,
  isToday,
  isBefore,
  startOfDay,
  addDays,
  differenceInDays,
  addWeeks,
  subWeeks
} from 'date-fns';
import { cn } from '@/lib/utils';
import { CardListSkeleton } from '@/components/shared/skeletons';
import { useAccommodationData, ViewMode, BookingWithRelations, RoomUnit } from '@/hooks/useAccommodationData';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { useAuth } from '@/contexts/AuthContext';
import { calculateBookingPrice } from '@/lib/bookingPricing';
import { getAccommodationWritePropertyId } from '@/lib/accommodationPropertySelection';

const statusColors: Record<string, string> = {
  pending: 'bg-warning/80 border-warning',
  confirmed: 'bg-success/80 border-success',
  checked_in: 'bg-primary/80 border-primary',
  checked_out: 'bg-muted border-muted-foreground/30',
  cancelled: 'bg-destructive/30 border-destructive/30',
  external: 'bg-orange-500/80 border-orange-500',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  external: 'External',
};

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  upcoming: { label: 'Upcoming', color: 'bg-muted text-muted-foreground border-muted-foreground/30' },
  fully_paid: { label: 'Fully Paid', color: 'bg-success/20 text-success border-success/30' },
  downpayment: { label: 'Downpayment', color: 'bg-warning/20 text-warning border-warning/30' },
  pending_ota: { label: 'Pending OTA', color: 'bg-info/20 text-info border-info/30' },
};

// Helper to parse booking dates for the dialog
function getBookingDates(booking: BookingWithRelations) {
  return {
    checkIn: parseISO(booking.check_in),
    checkOut: parseISO(booking.check_out),
  };
}

// Helper to get night count for a booking
function getBookingNightCount(booking: BookingWithRelations) {
  const dates = getBookingDates(booking);
  return differenceInDays(dates.checkOut, dates.checkIn);
}

// Booking Details Dialog Component
function BookingDetailsDialog({
  booking,
  rooms,
  onClose,
  formatCurrency,
  onUpdate,
}: {
  booking: BookingWithRelations | null;
  rooms: RoomUnit[];
  onClose: () => void;
  formatCurrency: (amount: number) => string;
  onUpdate: () => void;
}) {
  const { toast } = useToast();
  const { execute: executeUndoable } = useUndoableAction();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editData, setEditData] = useState({
    guestName: '',
    checkIn: null as Date | null,
    checkOut: null as Date | null,
    guestCount: 1,
    status: 'pending',
    paymentStatus: 'upcoming',
    notes: '',
    totalPrice: '',
  });

  const isExternalBooking = !!(booking?.isExternal || booking?.status === 'external' || booking?.id?.startsWith('external-'));

  // Reset edit state when booking changes
  useEffect(() => {
    if (booking) {
      setEditData({
        guestName: booking.guest_name || booking.lead?.name || '',
        checkIn: parseISO(booking.check_in),
        checkOut: parseISO(booking.check_out),
        guestCount: booking.guest_count || 1,
        status: booking.status,
        paymentStatus: booking.payment_status || 'upcoming',
        notes: booking.notes || '',
        totalPrice: booking.total_price != null ? String(booking.total_price) : '',
      });
      setIsEditing(false);
    }
  }, [booking]);

  const handleSave = async () => {
    if (!booking || !editData.checkIn || !editData.checkOut) return;

    if (isExternalBooking) {
      toast({
        title: 'Read-only booking',
        description: 'External calendar bookings are view-only.',
        variant: 'default',
      });
      return;
    }

    // Validate check-out is after check-in
    if (!isBefore(editData.checkIn, editData.checkOut)) {
      toast({
        title: "Invalid Dates",
        description: "Check-out date must be after check-in date",
        variant: "destructive",
      });
      return;
    }

    // Store previous values for undo
    const previousBookingData = {
      check_in: booking.check_in,
      check_out: booking.check_out,
      guest_count: booking.guest_count,
      status: booking.status,
      payment_status: booking.payment_status || 'upcoming',
      notes: booking.notes,
      total_price: booking.total_price,
    };
    const previousLeadName = booking.lead?.name || '';
    const guestName = editData.guestName.trim();

    setIsSaving(true);

    // Parse total price
    const parsedPrice = editData.totalPrice.trim() 
      ? parseFloat(editData.totalPrice.replace(/[^0-9.-]/g, '')) 
      : null;

    const newBookingData = {
      check_in: format(editData.checkIn, 'yyyy-MM-dd'),
      check_out: format(editData.checkOut, 'yyyy-MM-dd'),
      guest_count: editData.guestCount,
      status: editData.status,
      payment_status: editData.paymentStatus,
      notes: editData.notes || null,
      total_price: parsedPrice,
    };

    await executeUndoable({
      action: async () => {
        // Update lead name if changed and lead exists
        if (booking.lead_id && guestName !== previousLeadName) {
          const { error: leadError } = await supabase
            .from('leads')
            .update({ name: guestName })
            .eq('id', booking.lead_id);
          if (leadError) throw leadError;
        }

        const { error } = await supabase
          .from('bookings')
          .update(newBookingData)
          .eq('id', booking.id);
        if (error) throw error;
        return { id: booking.id };
      },
      undoAction: async () => {
        // Restore lead name
        if (booking.lead_id && guestName !== previousLeadName) {
          await supabase
            .from('leads')
            .update({ name: previousLeadName })
            .eq('id', booking.lead_id);
        }
        // Restore booking data
        await supabase
          .from('bookings')
          .update(previousBookingData)
          .eq('id', booking.id);
      },
      successMessage: 'Booking Updated',
      successDescription: `${guestName}'s booking has been updated`,
      duration: 10000,
      onSuccess: () => {
        setIsEditing(false);
        onUpdate();
        onClose();
      },
      onUndo: () => onUpdate(),
    });

    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!booking || isExternalBooking) return;

    const guestName = booking.guest_name || booking.lead?.name || 'this guest';
    const shouldDelete = window.confirm(`Delete booking for ${guestName}?`);
    if (!shouldDelete) return;

    const bookingSnapshot = {
      id: booking.id,
      organization_id: (booking as any).organization_id,
      property_id: booking.property_id || null,
      room_unit_id: booking.room_unit_id,
      lead_id: booking.lead_id,
      check_in: booking.check_in,
      check_out: booking.check_out,
      guest_count: booking.guest_count,
      status: booking.status,
      payment_status: booking.payment_status || 'upcoming',
      notes: booking.notes,
      total_price: booking.total_price,
      booking_source: booking.booking_source,
      calendar_event_id: booking.calendar_event_id,
    };

    setIsDeleting(true);

    await executeUndoable({
      action: async () => {
        const { error } = await supabase
          .from('bookings')
          .delete()
          .eq('id', booking.id);
        if (error) throw error;
        return { id: booking.id };
      },
      undoAction: async () => {
        const { error } = await supabase
          .from('bookings')
          .insert(bookingSnapshot);
        if (error) throw error;
      },
      successMessage: 'Booking Deleted',
      successDescription: `Reservation for ${guestName} has been removed`,
      duration: 10000,
      onSuccess: () => {
        onUpdate();
        onClose();
      },
      onUndo: () => onUpdate(),
    });

    setIsDeleting(false);
  };

  if (!booking) return null;

  const nights = getBookingNightCount(booking);
  const bookingDates = getBookingDates(booking);

  return (
    <Dialog open={!!booking} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="w-5 h-5 text-primary" />
            {isEditing ? 'Edit Booking' : 'Booking Details'}
          </DialogTitle>
          <DialogDescription>
            {`${format(bookingDates.checkIn, 'MMM d')} - ${format(bookingDates.checkOut, 'MMM d, yyyy')}`}
            <Badge variant="secondary" className="ml-2 gap-1 text-xs">
              <Moon className="w-3 h-3" />
              {nights} nights
            </Badge>
            {isExternalBooking && (
              <Badge variant="outline" className="ml-2 text-xs">
                External (view-only)
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          {/* Guest Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Guest Name</Label>
              {isEditing ? (
                <Input
                  value={editData.guestName}
                  onChange={(e) => setEditData(prev => ({ ...prev, guestName: e.target.value }))}
                  placeholder="Enter guest name"
                  className="h-9"
                />
              ) : (
                <div className="h-9 flex items-center">
                  {booking.lead_id && booking.lead ? (
                    <ClickableLeadName
                      lead={{
                        id: booking.lead_id,
                        name: booking.lead.name || 'Unknown',
                        email: booking.lead.email,
                        phone: booking.lead.phone,
                        status: 'new',
                        created_at: '',
                      }}
                      className="font-semibold text-primary hover:underline cursor-pointer"
                    />
                  ) : (
                    <p className="font-semibold text-foreground">{booking.guest_name || booking.lead?.name || 'Unknown'}</p>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Status</Label>
              {isEditing ? (
                <Select value={editData.status} onValueChange={(v) => setEditData(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-9 flex items-center">
                  <Badge variant="outline" className={cn(statusColors[booking.status], "text-xs text-white")}>
                    {statusLabels[booking.status] || booking.status}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Payment Status & Booking Source */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Payment Status</Label>
              {isEditing ? (
                <Select value={editData.paymentStatus} onValueChange={(v) => setEditData(prev => ({ ...prev, paymentStatus: v }))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    {Object.entries(paymentStatusConfig).map(([value, config]) => (
                      <SelectItem key={value} value={value}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-9 flex items-center">
                  <Badge variant="outline" className={cn("text-xs", paymentStatusConfig[booking.payment_status || 'upcoming']?.color)}>
                    {paymentStatusConfig[booking.payment_status || 'upcoming']?.label}
                  </Badge>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Booking Source</Label>
              <div className="h-9 flex items-center">
                <Badge variant="outline" className="text-xs">{booking.booking_source || 'Not specified'}</Badge>
              </div>
            </div>
          </div>

          {/* Contact & Guests Row */}
          <div className="grid grid-cols-2 gap-3">
            {(booking.lead?.phone || booking.guest_phone) && !isEditing && (
              <div>
                <Label className="text-xs">Phone</Label>
                <p className="font-medium text-foreground flex items-center gap-1 h-9">
                  <Phone className="w-3.5 h-3.5" />
                  {booking.lead?.phone || booking.guest_phone}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Guests</Label>
              {isEditing ? (
                <Input
                  type="number"
                  min={1}
                  className="h-9 text-sm"
                  value={editData.guestCount}
                  onChange={(e) => setEditData(prev => ({ ...prev, guestCount: parseInt(e.target.value) || 1 }))}
                />
              ) : (
                <p className="font-medium text-foreground flex items-center gap-1 h-9">
                  <Users className="w-3.5 h-3.5" />
                  {booking.guest_count || 1}
                </p>
              )}
            </div>
          </div>

          {/* Dates */}
          {isEditing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Check-in</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal h-9 text-sm">
                      <Calendar className="mr-2 h-4 w-4" />
                      {editData.checkIn ? format(editData.checkIn, 'MMM d') : 'Select'}
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
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Check-out</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal h-9 text-sm">
                      <Calendar className="mr-2 h-4 w-4" />
                      {editData.checkOut ? format(editData.checkOut, 'MMM d') : 'Select'}
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
              </div>
            </div>
          )}

          {/* Notes */}
          {(isEditing || booking.notes) && (
            <div className="space-y-2">
              <Label className="text-xs">Notes</Label>
              {isEditing ? (
                <Input
                  value={editData.notes}
                  onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Add notes..."
                  className="h-9"
                />
              ) : (
                <p className="text-sm text-muted-foreground">{booking.notes}</p>
              )}
            </div>
          )}

          {/* Price - Editable inline */}
          {(() => {
            const room = rooms.find(r => r.id === booking.room_unit_id);
            const calculatedPrice = room 
              ? calculateBookingPrice(booking.check_in, booking.check_out, booking.guest_count || 1, room)
              : null;
            const displayPrice = booking.total_price ?? calculatedPrice;
            const isCalculated = booking.total_price == null && calculatedPrice != null;

            return (
              <div className="space-y-2">
                <Label className="text-xs">Total Price</Label>
                {isEditing ? (
                  <div className="space-y-1">
                    <Input
                      type="text"
                      value={editData.totalPrice}
                      onChange={(e) => setEditData(prev => ({ ...prev, totalPrice: e.target.value }))}
                      placeholder={calculatedPrice != null ? `Suggested: ${formatCurrency(calculatedPrice)}` : "Enter price (e.g., 5000)"}
                      className="h-9"
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
                      {!isExternalBooking && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setIsEditing(true)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Not set</span>
                    {!isExternalBooking && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8"
                        onClick={() => setIsEditing(true)}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Set Price
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <DialogFooter className="gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                <Save className="w-4 h-4 mr-1" />
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
              {!isExternalBooking && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Delete
                </Button>
              )}
              {!isExternalBooking && (
                <Button size="sm" onClick={() => setIsEditing(true)}>
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AvailabilityTabContentProps {
  accommodationData: ReturnType<typeof useAccommodationData>;
  formatCurrency: (amount: number) => string;
  syncBooking?: (bookingId: string) => Promise<{ success: boolean; message: string }>;
}

export default function AvailabilityTabContent({
  accommodationData,
  formatCurrency,
  syncBooking,
}: AvailabilityTabContentProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const { defaultCountryCode, phonePlaceholder } = useOrganizationPhone();
  const isMobile = useIsMobile();
  const [selectedBooking, setSelectedBooking] = useState<BookingWithRelations | null>(null);
  const [searchRoom, setSearchRoom] = useState('');
  const [showLegend, setShowLegend] = useState(false);

  // New booking state
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [newBooking, setNewBooking] = useState<{
    room: RoomUnit | null;
    checkIn: Date | null;
    checkOut: Date | null;
    guestName: string;
    guestPhone: string;
    guestEmail: string;
    guestCount: number;
  }>({
    room: null,
    checkIn: null,
    checkOut: null,
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    guestCount: 1,
  });

  const {
    rooms,
    availabilityBookings,
    calendarDays,
    stats,
    isLoading,
    currentDate,
    setCurrentDate,
    viewMode,
    setViewMode,
    refetchAll,
    selectedPropertyId,
    properties,
  } = accommodationData;

  // Check for booking conflicts when creating new booking
  const { hasConflicts, conflicts } = useBookingConflicts(
    newBooking.room?.id || null,
    newBooking.checkIn ? format(newBooking.checkIn, 'yyyy-MM-dd') : null,
    newBooking.checkOut ? format(newBooking.checkOut, 'yyyy-MM-dd') : null,
    availabilityBookings
  );

  // Memoize parsed dates to avoid repeated parseISO calls
  const parsedBookingDates = useMemo(() => {
    return availabilityBookings.reduce((acc, booking) => {
      acc[booking.id] = {
        checkIn: parseISO(booking.check_in),
        checkOut: parseISO(booking.check_out),
      };
      return acc;
    }, {} as Record<string, { checkIn: Date; checkOut: Date }>);
  }, [availabilityBookings]);

  // Navigation functions
  const navigatePrev = useCallback(() => {
    if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, -1));
    } else if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  }, [viewMode, currentDate, setCurrentDate]);

  const navigateNext = useCallback(() => {
    if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  }, [viewMode, currentDate, setCurrentDate]);

  // Helper to get parsed dates for a booking
  const getParsedBookingDates = useCallback((booking: BookingWithRelations) => {
    if (parsedBookingDates[booking.id]) {
      return parsedBookingDates[booking.id];
    }
    // Fallback if not in memoized map
    return {
      checkIn: parseISO(booking.check_in),
      checkOut: parseISO(booking.check_out),
    };
  }, [parsedBookingDates]);

  // Helper to get night count for a booking
  const getNightCount = useCallback((booking: BookingWithRelations) => {
    const dates = getParsedBookingDates(booking);
    return differenceInDays(dates.checkOut, dates.checkIn);
  }, [getParsedBookingDates]);

  const getDateRangeLabel = useCallback(() => {
    if (viewMode === 'day') {
      return format(currentDate, 'EEEE, MMMM d, yyyy');
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate);
      const weekEnd = endOfWeek(currentDate);
      return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
    } else {
      return format(currentDate, 'MMMM yyyy');
    }
  }, [viewMode, currentDate]);

  // Filter rooms
  const filteredRooms = useMemo(() => {
    if (!searchRoom.trim()) return rooms.filter(r => r.is_active);
    return rooms.filter(room => 
      room.is_active && room.name.toLowerCase().includes(searchRoom.toLowerCase())
    );
  }, [rooms, searchRoom]);

  // Calculate availability stats
  const availabilityStats = useMemo(() => {
    const today = new Date();
    let arrivingToday = 0;
    let departingToday = 0;
    const occupiedRoomIds = new Set<string>();

    availabilityBookings.forEach(b => {
      const dates = parsedBookingDates[b.id];
      if (!dates) return; // Skip if not in memoized map
      
      const checkIn = dates.checkIn;
      const checkOut = dates.checkOut;
      
      if (isSameDay(checkIn, today)) arrivingToday++;
      if (isSameDay(checkOut, today)) departingToday++;
      
      if (!isBefore(today, checkIn) && isBefore(today, checkOut)) {
        occupiedRoomIds.add(b.room_unit_id);
      }
    });

    const totalRooms = filteredRooms.length;
    const occupancyRate = totalRooms > 0 
      ? Math.round((occupiedRoomIds.size / totalRooms) * 100) 
      : 0;

    return {
      arrivingToday,
      departingToday,
      currentlyOccupied: occupiedRoomIds.size,
      occupancyRate,
      totalRooms,
    };
  }, [availabilityBookings, filteredRooms, parsedBookingDates]);

  // Get booking for a specific room and date
  const getBookingForDate = useCallback((roomId: string, date: Date): BookingWithRelations | null => {
    return availabilityBookings.find(b => {
      if (b.room_unit_id !== roomId) return false;
      const dates = parsedBookingDates[b.id];
      if (!dates) return false;
      return !isBefore(date, dates.checkIn) && isBefore(date, dates.checkOut);
    }) || null;
  }, [availabilityBookings, parsedBookingDates]);

  // Check if date is booking start OR if this is the first visible day for a booking that started earlier
  const isBookingStart = useCallback((booking: BookingWithRelations, date: Date): boolean => {
    const dates = parsedBookingDates[booking.id];
    return dates ? isSameDay(dates.checkIn, date) : false;
  }, [parsedBookingDates]);

  // Check if we should render the booking bar on this day
  // (either it's the actual start, or it's the first day of the visible week for an ongoing booking)
  const shouldRenderBookingBar = useCallback((booking: BookingWithRelations, date: Date, dayIndex: number): boolean => {
    const dates = parsedBookingDates[booking.id];
    if (!dates) return false;
    // Render if this is the actual booking start date
    if (isSameDay(dates.checkIn, date)) return true;
    // Or if this is the first day of the visible week and the booking started before this day
    if (dayIndex === 0 && isBefore(dates.checkIn, date)) return true;
    return false;
  }, [parsedBookingDates]);

  // Calculate booking span from the given start date
  const getBookingSpan = useCallback((booking: BookingWithRelations, startDate: Date): number => {
    const checkOut = parseISO(booking.check_out);
    let span = 0;
    let current = startDate;
    const weekEnd = endOfWeek(startDate);
    
    while (isBefore(current, checkOut) && !isBefore(weekEnd, current)) {
      span++;
      current = addDays(current, 1);
    }
    return Math.max(span, 1);
  }, []);

  // Open new booking dialog
  const openNewBookingDialog = useCallback((room: RoomUnit, date: Date) => {
    if (isBefore(date, startOfDay(new Date()))) {
      toast({
        title: 'Invalid date',
        description: 'Cannot create bookings in the past.',
        variant: 'destructive',
      });
      return;
    }

    setNewBooking({
      room,
      checkIn: date,
      checkOut: addDays(date, 1),
      guestName: '',
      guestPhone: '',
      guestEmail: '',
      guestCount: 1,
    });
    setNewBookingOpen(true);
  }, [toast]);

  // Create booking
  const createBooking = useCallback(async () => {
    if (!newBooking.room || !newBooking.checkIn || !newBooking.checkOut || !newBooking.guestName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate check-out is after check-in
    if (!isBefore(newBooking.checkIn, newBooking.checkOut)) {
      toast({
        title: "Invalid Dates",
        description: "Check-out date must be after check-in date",
        variant: "destructive",
      });
      return;
    }

    // Restrict manual booking creation to today/future dates
    if (isBefore(newBooking.checkIn, startOfDay(new Date()))) {
      toast({
        title: 'Invalid date',
        description: 'Cannot create bookings in the past.',
        variant: 'destructive',
      });
      return;
    }

    // Check for booking conflicts
    if (hasConflicts) {
      toast({
        title: "Booking Conflict",
        description: `This room is already booked for these dates. ${conflicts[0]?.message || ''}`,
        variant: "destructive",
      });
      return;
    }

    if (!profile?.organization_id) {
      toast({
        title: "Error",
        description: "Organization not found",
        variant: "destructive",
      });
      return;
    }

    const writePropertyId = newBooking.room.property_id || getAccommodationWritePropertyId(selectedPropertyId, properties);
    if (!writePropertyId) {
      toast({
        title: "Select a property",
        description: "Choose a specific property before creating a booking.",
        variant: "destructive",
      });
      return;
    }

    const guestEmail = newBooking.guestEmail.trim();
    const hasPhone = newBooking.guestPhone.trim().length > 0;
    const hasEmail = guestEmail.length > 0;

    if (!hasPhone && !hasEmail) {
      toast({
        title: 'Contact required',
        description: 'Enter at least a phone number or email before creating a booking.',
        variant: 'destructive',
      });
      return;
    }

    if (hasEmail && !/^\S+@\S+\.\S+$/.test(guestEmail)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    const normalizedGuestPhone = newBooking.guestPhone.trim()
      ? normalizePhoneNumber(newBooking.guestPhone, defaultCountryCode)
      : null;

    if (normalizedGuestPhone && !isValidPhoneNumber(normalizedGuestPhone, defaultCountryCode)) {
      toast({
        title: 'Invalid Phone Number',
        description: getPhoneValidationMessage(defaultCountryCode),
        variant: 'destructive',
      });
      return;
    }

    setCreatingBooking(true);
    let createdLeadId: string | null = null;
    try {

      // Reuse lead by phone first when possible; otherwise create a new lead
      let leadId: string | null = null;

      if (normalizedGuestPhone) {
        const { data: matchingLeads, error: leadLookupError } = await supabase
          .from('leads')
          .select('id')
          .eq('organization_id', profile.organization_id)
          .eq('phone', normalizedGuestPhone)
          .limit(1);

        if (leadLookupError) throw leadLookupError;
        leadId = matchingLeads?.[0]?.id || null;
      }

      if (!leadId && guestEmail) {
        const { data: matchingLeadsByEmail, error: leadLookupByEmailError } = await supabase
          .from('leads')
          .select('id')
          .eq('organization_id', profile.organization_id)
          .eq('email', guestEmail)
          .limit(1);

        if (leadLookupByEmailError) throw leadLookupByEmailError;
        leadId = matchingLeadsByEmail?.[0]?.id || null;
      }

      if (!leadId) {
        const { data: lead, error: leadError } = await supabase
          .from('leads')
          .insert({
            organization_id: profile.organization_id,
            name: newBooking.guestName.trim(),
            phone: normalizedGuestPhone,
            email: guestEmail || null,
            source: 'manual',
            status: 'new',
          })
          .select()
          .single();

        if (leadError) throw leadError;
        createdLeadId = lead.id;
        leadId = lead.id;
      }

      // Create booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          organization_id: profile.organization_id,
          room_unit_id: newBooking.room.id,
          lead_id: leadId,
          check_in: format(newBooking.checkIn, 'yyyy-MM-dd'),
          check_out: format(newBooking.checkOut, 'yyyy-MM-dd'),
          guest_count: newBooking.guestCount,
          status: 'pending',
          property_id: newBooking.room.property_id || writePropertyId
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Sync to Google Calendar in background
      if (syncBooking && booking) {
        syncBooking(booking.id).then((result) => {
          if (!result.success) {
            toast({
              title: "Calendar Sync Failed",
              description: "Booking was created, but calendar sync failed. You can retry from booking details.",
              variant: "default",
            });
          }
        }).catch((err) => {
          devError('Calendar sync failed after booking:', err);
          toast({
            title: "Calendar Sync Failed",
            description: "Booking was created, but calendar sync encountered an error.",
            variant: "default",
          });
        });
      }

      toast({
        title: "Booking Created",
        description: `Reservation for ${newBooking.guestName} has been created`,
      });

      setNewBookingOpen(false);
      refetchAll();
    } catch (error) {
      if (createdLeadId) {
        await supabase.from('leads').delete().eq('id', createdLeadId);
      }

      devError('Error creating booking:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
            ? (error as { message: string }).message
            : 'Failed to create booking';

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setCreatingBooking(false);
    }
  }, [
    newBooking,
    hasConflicts,
    conflicts,
    profile?.organization_id,
    selectedPropertyId,
    properties,
    defaultCountryCode,
    toast,
    refetchAll,
    syncBooking,
  ]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (isLoading) {
    return <CardListSkeleton count={4} />;
  }

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex items-center justify-between gap-2">
          {/* Navigation */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigatePrev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={navigateNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <span className="font-medium text-sm text-foreground truncate px-2">{getDateRangeLabel()}</span>

          {/* View Mode Toggle */}
          <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as ViewMode)} className="hidden sm:flex">
            <ToggleGroupItem value="day" className="h-8 px-2 text-xs">
              <CalendarCheck className="w-3.5 h-3.5 mr-1" />
              Day
            </ToggleGroupItem>
            <ToggleGroupItem value="week" className="h-8 px-2 text-xs">
              <CalendarDays className="w-3.5 h-3.5 mr-1" />
              Week
            </ToggleGroupItem>
            <ToggleGroupItem value="month" className="h-8 px-2 text-xs">
              <CalendarRange className="w-3.5 h-3.5 mr-1" />
              Month
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Room Filter + Quick Stats Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          {/* Room Filter */}
          <div className="relative w-full sm:w-auto sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Filter rooms..."
              value={searchRoom}
              onChange={(e) => setSearchRoom(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
          
          {/* Compact Quick Stats */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap sm:ml-auto">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary/10 border border-primary/20">
              <span className="text-[10px] sm:text-xs text-muted-foreground">Occupancy</span>
              <span className="text-sm sm:text-base font-semibold text-foreground">{availabilityStats.occupancyRate}%</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-success/10 border border-success/20">
              <span className="text-[10px] sm:text-xs text-muted-foreground">Occupied</span>
              <span className="text-sm sm:text-base font-semibold text-foreground">{availabilityStats.currentlyOccupied}/{availabilityStats.totalRooms}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-warning/10 border border-warning/20">
              <span className="text-[10px] sm:text-xs text-muted-foreground">Arriving</span>
              <span className="text-sm sm:text-base font-semibold text-foreground">{availabilityStats.arrivingToday}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted/50 border border-muted-foreground/20">
              <span className="text-[10px] sm:text-xs text-muted-foreground">Departing</span>
              <span className="text-sm sm:text-base font-semibold text-foreground">{availabilityStats.departingToday}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Availability Grid */}
      <Card className="glass overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className={cn(
              "w-full border-collapse table-fixed",
              viewMode === 'day' ? "min-w-[300px]" : viewMode === 'week' ? "min-w-[600px]" : "min-w-[800px]"
            )}>
              <thead>
                <tr className="bg-secondary/50">
                  <th className="sticky left-0 z-10 bg-secondary/50 backdrop-blur-sm p-2 sm:p-3 text-left text-xs sm:text-sm font-medium text-foreground border-b border-r border-border w-[120px] sm:w-[160px]">
                    Room
                  </th>
                  {calendarDays.map((day, i) => (
                    <th 
                      key={i} 
                      className={cn(
                        "p-1 sm:p-2 text-center text-[10px] sm:text-xs font-medium border-b border-border",
                        isToday(day) ? "bg-primary/20 text-primary" : "text-muted-foreground",
                        viewMode === 'month' && day.getMonth() !== currentDate.getMonth() && "opacity-40"
                      )}
                    >
                      {viewMode === 'day' ? (
                        <div className="text-sm font-semibold text-foreground">{format(day, 'EEE, MMM d')}</div>
                      ) : (
                        <>
                          <div className="hidden md:block">{weekDays[day.getDay()]}</div>
                          <div className="md:hidden">{weekDays[day.getDay()].charAt(0)}</div>
                          <div className={cn("text-xs font-semibold", isToday(day) ? "text-primary" : "text-foreground")}>
                            {format(day, 'd')}
                          </div>
                        </>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRooms.map((room) => (
                  <tr key={room.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="sticky left-0 z-10 bg-background/95 backdrop-blur-sm p-2 sm:p-3 border-b border-r border-border">
                      <div className="flex items-center gap-2">
                        <BedDouble className="w-3.5 h-3.5 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground text-xs sm:text-sm truncate">{room.name}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" />
                            {room.capacity || '?'}
                          </p>
                        </div>
                      </div>
                    </td>
                    {calendarDays.map((day, dayIndex) => {
                      const booking = getBookingForDate(room.id, day);
                      const shouldRender = booking && shouldRenderBookingBar(booking, day, dayIndex);
                      const isInCurrentMonth = viewMode !== 'month' || day.getMonth() === currentDate.getMonth();
                      
                      return (
                        <td 
                          key={dayIndex} 
                          className={cn(
                            "p-0 border-b border-border relative h-10 sm:h-12",
                            !isInCurrentMonth && "bg-muted/30",
                            isToday(day) && "bg-primary/5"
                          )}
                        >
                          {booking && shouldRender ? (
                            <TooltipProvider delayDuration={300}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div 
                                    className={cn(
                                      "absolute inset-y-1 left-0 right-0 rounded border cursor-pointer flex items-center px-1 overflow-hidden",
                                      statusColors[booking.status] || 'bg-secondary'
                                    )}
                                    style={{
                                      width: `calc(${getBookingSpan(booking, day)} * 100% - 2px)`,
                                      zIndex: 5
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Open booking ${booking.guest_name || booking.lead?.name || booking.title || 'Guest'}`}
                                    onClick={() => setSelectedBooking(booking)}
                                  >
                                    <span className="text-[9px] sm:text-[10px] font-medium truncate text-white drop-shadow-sm">
                                      {booking.guest_name || booking.lead?.name || booking.title || 'Guest'}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs p-3">
                                  <div className="space-y-1">
                                    <p className="font-semibold text-foreground">
                                      {booking.guest_name || booking.lead?.name || booking.title || 'Guest'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {(() => {
                                        const dates = getParsedBookingDates(booking);
                                        const nights = differenceInDays(dates.checkOut, dates.checkIn);
                                        return `${format(dates.checkIn, 'MMM d')} - ${format(dates.checkOut, 'MMM d')} (${nights} nights)`;
                                      })()}
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : !booking ? (
                            isBefore(day, startOfDay(new Date())) ? (
                              <div className="absolute inset-0.5 rounded bg-muted/20 cursor-not-allowed" />
                            ) : (
                            <div 
                              className="absolute inset-0.5 rounded bg-secondary/20 hover:bg-success/20 cursor-pointer transition-colors flex items-center justify-center group"
                              data-testid={`availability-add-${room.id}-${format(day, 'yyyy-MM-dd')}`}
                              role="button"
                              tabIndex={0}
                              aria-label={`Create booking for ${room.name} on ${format(day, 'yyyy-MM-dd')}`}
                              onClick={() => openNewBookingDialog(room, day)}
                            >
                              <Plus className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            )
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-warning/80" />
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-success/80" />
          <span>Confirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-primary/80" />
          <span>Checked In</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-500/80" />
          <span>External</span>
        </div>
      </div>

      {/* Booking Details Dialog */}
      <BookingDetailsDialog
        booking={selectedBooking}
        rooms={filteredRooms}
        onClose={() => setSelectedBooking(null)}
        formatCurrency={formatCurrency}
        onUpdate={refetchAll}
      />

      {/* New Booking Dialog */}
      <Dialog open={newBookingOpen} onOpenChange={setNewBookingOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              New Booking
            </DialogTitle>
            <DialogDescription>
              Book {newBooking.room?.name} for your guest
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Guest Name *</Label>
              <Input
                value={newBooking.guestName}
                onChange={(e) => setNewBooking(prev => ({ ...prev, guestName: e.target.value }))}
                placeholder="Enter guest name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  value={newBooking.guestPhone}
                  onChange={(e) => setNewBooking(prev => ({ ...prev, guestPhone: e.target.value }))}
                  placeholder={phonePlaceholder}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={newBooking.guestEmail}
                  onChange={(e) => setNewBooking(prev => ({ ...prev, guestEmail: e.target.value }))}
                  placeholder="guest@example.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Check-in</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
                      <Calendar className="mr-2 h-4 w-4" />
                      {newBooking.checkIn ? format(newBooking.checkIn, 'MMM d') : 'Select'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[60]">
                    <CalendarPicker
                      mode="single"
                      selected={newBooking.checkIn || undefined}
                      onSelect={(date) => date && setNewBooking(prev => ({
                        ...prev,
                        checkIn: date,
                        checkOut: prev.checkOut && prev.checkOut <= date ? addDays(date, 1) : prev.checkOut
                      }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Check-out</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal h-10">
                      <Calendar className="mr-2 h-4 w-4" />
                      {newBooking.checkOut ? format(newBooking.checkOut, 'MMM d') : 'Select'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[60]">
                    <CalendarPicker
                      mode="single"
                      selected={newBooking.checkOut || undefined}
                      onSelect={(date) => date && setNewBooking(prev => ({ ...prev, checkOut: date }))}
                      disabled={(date) => newBooking.checkIn ? date <= newBooking.checkIn : false}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Number of Guests</Label>
              <Input
                type="number"
                min={1}
                value={newBooking.guestCount}
                onChange={(e) => setNewBooking(prev => ({ ...prev, guestCount: parseInt(e.target.value) || 1 }))}
              />
            </div>
            {/* Conflict Warning */}
            {hasConflicts && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">Booking Conflict:</span> {conflicts[0]?.message}
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewBookingOpen(false)}>Cancel</Button>
            <Button onClick={createBooking} disabled={creatingBooking || hasConflicts}>
              {creatingBooking && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
