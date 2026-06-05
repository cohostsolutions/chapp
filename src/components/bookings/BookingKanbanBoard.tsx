import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Clock,
  CheckCircle,
  XCircle,
  Trash2,
  Phone,
  Calendar,
  BedDouble,
  Users,
  GripVertical,
  CalendarCheck,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Edit,
  LogIn,
  LogOut,
  User,
  Mail,
  MessageSquare,
} from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookingWithRelations, RoomUnit } from '@/hooks/useBookings';
import { format, isToday, isTomorrow, isFuture, isPast, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { calculateBookingPrice } from '@/lib/bookingPricing';

interface StatusColumn {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}

// Orphan lead type (lead without a booking)
export interface OrphanLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  source: string | null;
  notes: string | null;
}

// Unified Cece booking statuses:
// 1. New - General inquiries
// 2. Pending - Ready to book, awaiting confirmation (triggers notification)
// 3. Upcoming - Confirmed and paid bookings (tracked who confirmed)
// 4. Checked-In - Currently staying
// 5. Checked-Out - Completed stays
// 6. Cancelled - Cancelled bookings
const statusColumns: StatusColumn[] = [
  {
    id: 'new',
    label: 'New',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
    icon: <Clock className="w-4 h-4" />,
  },
  {
    id: 'pending',
    label: 'Pending',
    color: 'text-warning',
    bgColor: 'bg-warning/10 border-warning/30',
    icon: <Clock className="w-4 h-4" />,
  },
  {
    id: 'upcoming',
    label: 'Upcoming',
    color: 'text-success',
    bgColor: 'bg-success/10 border-success/30',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  {
    id: 'checked_in',
    label: 'Checked In',
    color: 'text-primary',
    bgColor: 'bg-primary/10 border-primary/30',
    icon: <LogIn className="w-4 h-4" />,
  },
  {
    id: 'checked_out',
    label: 'Checked Out',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50 border-muted',
    icon: <LogOut className="w-4 h-4" />,
  },
  {
    id: 'cancelled',
    label: 'Cancelled',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10 border-destructive/30',
    icon: <XCircle className="w-4 h-4" />,
  },
  {
    id: 'external',
    label: 'External',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10 border-orange-500/30',
    icon: <Calendar className="w-4 h-4" />,
  },
];

const paymentStatusConfig: Record<string, { label: string; color: string }> = {
  upcoming: { label: 'Upcoming', color: 'bg-muted text-muted-foreground border-muted-foreground/30' },
  fully_paid: { label: 'Fully Paid', color: 'bg-success/20 text-success border-success/30' },
  downpayment: { label: 'Downpayment', color: 'bg-warning/20 text-warning border-warning/30' },
  pending_ota: { label: 'Pending OTA', color: 'bg-info/20 text-info border-info/30' },
};

interface BookingKanbanBoardProps {
  bookings: BookingWithRelations[];
  orphanLeads?: OrphanLead[];
  rooms?: RoomUnit[];
  onStatusChange: (bookingId: string, newStatus: string) => void;
  onBookingClick: (booking: BookingWithRelations) => void;
  onOrphanLeadClick?: (lead: OrphanLead) => void;
  onDeleteOrphanLead?: (lead: OrphanLead) => void;
  onEditBooking?: (booking: BookingWithRelations) => void;
  onSyncBooking: (bookingId: string) => void;
  isSyncing: boolean;
  isUpdating: boolean;
  deletingOrphanLeadId?: string | null;
  formatCurrency?: (amount: number) => string;
}

function getDateLabel(dateStr: string) {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'MMM d');
}

function getDateStatus(checkIn: string, checkOut: string, status: string) {
  if (status === 'cancelled' || status === 'checked_out') return null;
  const checkInDate = parseISO(checkIn);
  const checkOutDate = parseISO(checkOut);

  if (isToday(checkInDate)) return { label: 'Arriving', color: 'text-success bg-success/10' };
  if (isToday(checkOutDate)) return { label: 'Departing', color: 'text-warning bg-warning/10' };
  if (isPast(checkInDate) && isFuture(checkOutDate)) return { label: 'In House', color: 'text-primary bg-primary/10' };
  return null;
}

function KanbanColumn({
  column,
  count,
  children,
  className,
}: {
  column: StatusColumn;
  count: number;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-shrink-0 w-[280px] sm:w-[300px] lg:w-[280px] xl:w-[300px] flex flex-col rounded-xl border-2 transition-all duration-200 snap-start',
        column.bgColor,
        isOver && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        className
      )}
    >
      <div className="p-2.5 md:p-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className={cn('flex items-center gap-1.5 md:gap-2 font-semibold text-sm md:text-base', column.color)}>
            {column.icon}
            <span className="truncate">{column.label}</span>
          </div>
          <Badge variant="secondary" className="text-xs h-5 px-1.5">
            {count}
          </Badge>
        </div>
      </div>

      {children}
    </div>
  );
}

function DraggableBookingCard({
  booking,
  room,
  isArmed,
  setArmedBookingId,
  onBookingClick,
  onEditBooking,
  onSyncBooking,
  onStatusChange,
  isSyncing,
  isUpdating,
  clickTimerRef,
  formatCurrency,
}: {
  booking: BookingWithRelations;
  room?: RoomUnit;
  isArmed: boolean;
  setArmedBookingId: React.Dispatch<React.SetStateAction<string | null>>;
  onBookingClick: (booking: BookingWithRelations) => void;
  onEditBooking?: (booking: BookingWithRelations) => void;
  onSyncBooking: (bookingId: string) => void;
  onStatusChange: (bookingId: string, newStatus: string) => void;
  isSyncing: boolean;
  isUpdating: boolean;
  clickTimerRef: React.MutableRefObject<Record<string, ReturnType<typeof setTimeout> | null>>;
  formatCurrency?: (amount: number) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: booking.id,
    disabled: !isArmed || isUpdating,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        touchAction: 'none' as const,
      }
    : ({ touchAction: isArmed ? 'none' : 'manipulation' } as const);

  const dateStatus = getDateStatus(booking.check_in, booking.check_out, booking.status);

  // Calculate initial price based on room pricing
  const calculatedPrice = room 
    ? calculateBookingPrice(booking.check_in, booking.check_out, booking.guest_count || 1, room)
    : null;
  const displayPrice = booking.total_price ?? calculatedPrice;
  const hasPriceOverride = booking.total_price != null && calculatedPrice != null && 
    Math.abs(booking.total_price - calculatedPrice) > 0.01;

  const toggleArmed = () => {
    setArmedBookingId((prev) => (prev === booking.id ? null : booking.id));
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isDragging) return;
    
    // If already armed, disarm on click
    if (isArmed) {
      toggleArmed();
      return;
    }
    
    // Check if there's a pending click timer (means this is a double-click)
    if (clickTimerRef.current[booking.id]) {
      // Double-click detected - clear timer and arm for drag
      clearTimeout(clickTimerRef.current[booking.id]!);
      clickTimerRef.current[booking.id] = null;
      toggleArmed();
    } else {
      // First click - set timer for single-click action
      clickTimerRef.current[booking.id] = setTimeout(() => {
        clickTimerRef.current[booking.id] = null;
        // Single click - open booking info
        if (!isArmed && !isDragging) {
          onBookingClick(booking);
        }
      }, 280); // Wait 280ms to see if another click comes
    }
  };

  // Get quick action button based on status
  const getQuickAction = () => {
    // New status - can move to pending
    if (booking.status === 'new') {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-warning/20"
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(booking.id, 'pending');
          }}
          disabled={isUpdating}
          title="Mark as Pending"
        >
          <Clock className="w-3.5 h-3.5 text-warning" />
        </Button>
      );
    }
    // Pending status - confirm to upcoming
    if (booking.status === 'pending') {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-success/20"
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(booking.id, 'upcoming');
          }}
          disabled={isUpdating}
          title="Confirm Booking"
        >
          <CheckCircle className="w-3.5 h-3.5 text-success" />
        </Button>
      );
    }
    // Upcoming status - can check in
    if (booking.status === 'upcoming') {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-primary/20"
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(booking.id, 'checked_in');
          }}
          disabled={isUpdating}
          title="Check In"
        >
          <LogIn className="w-3.5 h-3.5 text-primary" />
        </Button>
      );
    }
    if (booking.status === 'checked_in') {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-warning/20"
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(booking.id, 'checked_out');
          }}
          disabled={isUpdating}
          title="Check Out"
        >
          <LogOut className="w-3.5 h-3.5 text-warning" />
        </Button>
      );
    }
    // Allow restoring cancelled or checked_out bookings
    if (booking.status === 'cancelled' || booking.status === 'checked_out') {
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-success/20"
          onClick={(e) => {
            e.stopPropagation();
            onStatusChange(booking.id, 'upcoming');
          }}
          disabled={isUpdating}
          title="Restore to Upcoming"
        >
          <CheckCircle className="w-3.5 h-3.5 text-success" />
        </Button>
      );
    }
    return null;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={cn('select-none', isDragging && 'opacity-50', isArmed ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer')}
      {...(isArmed ? listeners : {})}
      {...(isArmed ? attributes : {})}
    >
      <Card
        className={cn('bg-card hover:bg-accent/50 transition-all border shadow-sm', isArmed && 'ring-2 ring-primary ring-offset-1')}
      >
        <CardContent className="p-2.5 md:p-3 space-y-1.5 md:space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <BedDouble className="w-4 h-4 md:w-4.5 md:h-4.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-xs md:text-sm text-foreground truncate max-w-[160px] sm:max-w-[180px]" title={booking.room?.name || 'Unknown Room'}>
                  {booking.room?.name || 'Unknown Room'}
                </p>
                <p className="text-[10px] md:text-xs text-muted-foreground truncate max-w-[160px] sm:max-w-[180px]" title={booking.lead?.name || 'Unknown Guest'}>
                  {booking.lead?.name || 'Unknown Guest'}
                </p>
              </div>
            </div>
            <div
              className={cn(
                'p-1.5 rounded transition-colors',
                isArmed ? 'bg-primary/20 text-primary' : 'text-muted-foreground'
              )}
            >
              <GripVertical className="w-4 h-4" />
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground">
            {booking.lead?.phone && (
              <span className="flex items-center gap-1 truncate">
                <Phone className="w-3 h-3 shrink-0" />
                <span className="truncate">{booking.lead.phone}</span>
              </span>
            )}
            <span className="flex items-center gap-1 shrink-0">
              <Users className="w-3 h-3" />
              {booking.guest_count || 1}
            </span>
          </div>

          <div className="flex items-center justify-between gap-1 text-[10px] md:text-xs">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
              <span className="font-medium text-foreground">{getDateLabel(booking.check_in)}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium text-foreground">{getDateLabel(booking.check_out)}</span>
            </div>
            {displayPrice != null && formatCurrency && (
              <div className="flex items-center gap-1">
                {hasPriceOverride && calculatedPrice != null && (
                  <span className="text-[9px] text-muted-foreground line-through">
                    {formatCurrency(calculatedPrice)}
                  </span>
                )}
                <span className="font-semibold text-primary whitespace-nowrap">
                  {formatCurrency(displayPrice)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-1 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              {dateStatus && (
                <Badge variant="outline" className={cn('text-[9px] md:text-[10px] px-1.5 py-0.5 h-5', dateStatus.color)}>
                  {dateStatus.label}
                </Badge>
              )}
              <Badge variant="outline" className={cn('text-[9px] md:text-[10px] px-1.5 py-0.5 h-5', paymentStatusConfig[(booking as unknown as { payment_status?: string }).payment_status || 'upcoming']?.color)}>
                {paymentStatusConfig[(booking as unknown as { payment_status?: string }).payment_status || 'upcoming']?.label}
              </Badge>
            </div>
            <div className="ml-auto flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              {getQuickAction()}
              {onEditBooking && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => onEditBooking(booking)}
                  title="Edit booking"
                >
                  <Edit className="w-3.5 h-3.5" />
                </Button>
              )}
              {booking.calendar_event_id ? (
                <Badge
                  variant="outline"
                  className="bg-success/10 text-success border-success/30 text-[9px] md:text-[10px] px-1 py-0 h-5 gap-0.5"
                >
                  <CalendarCheck className="w-2.5 h-2.5" />
                  <span className="hidden sm:inline">Synced</span>
                </Badge>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[9px] md:text-[10px] gap-0.5"
                  onClick={() => onSyncBooking(booking.id)}
                  disabled={isSyncing}
                >
                  <CalendarPlus className="w-2.5 h-2.5" />
                  Sync
                </Button>
              )}
            </div>
          </div>

          {isArmed && (
            <p className="text-[9px] text-center text-primary animate-pulse">Drag to move • Double-tap/click again to cancel</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Card component for orphan leads (leads without bookings)
function OrphanLeadCard({
  lead,
  onClick,
  onDelete,
  isDeleting,
}: {
  lead: OrphanLead;
  onClick?: (lead: OrphanLead) => void;
  onDelete?: (lead: OrphanLead) => void;
  isDeleting?: boolean;
}) {
  const handleClick = () => {
    onClick?.(lead);
  };

  const handleDeleteClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onDelete?.(lead);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      onClick={handleClick}
      className="cursor-pointer select-none"
    >
      <Card className="bg-card hover:bg-accent/50 transition-all border shadow-sm border-dashed border-blue-500/50">
        <CardContent className="p-2.5 md:p-3 space-y-1.5 md:space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 md:w-4.5 md:h-4.5 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-xs md:text-sm text-foreground truncate max-w-[160px] sm:max-w-[180px]" title={lead.name}>
                  {lead.name}
                </p>
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  New Inquiry
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[9px] md:text-[10px] px-1.5 py-0.5 h-5 bg-blue-500/10 text-blue-500 border-blue-500/30">
                Lead
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={handleDeleteClick}
                disabled={isDeleting}
                title="Delete lead"
                aria-label={`Delete orphan lead ${lead.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground flex-wrap">
            {lead.phone && (
              <span className="flex items-center gap-1 truncate">
                <Phone className="w-3 h-3 shrink-0" />
                <span className="truncate">{lead.phone}</span>
              </span>
            )}
            {lead.email && (
              <span className="flex items-center gap-1 truncate">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[100px]">{lead.email}</span>
              </span>
            )}
          </div>

          {lead.source && (
            <div className="flex items-center gap-1 text-[10px] md:text-xs">
              <MessageSquare className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground capitalize">{lead.source}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[9px] md:text-[10px] text-muted-foreground">
              {format(parseISO(lead.created_at), 'MMM d, h:mm a')}
            </span>
            <Badge variant="outline" className="text-[9px] md:text-[10px] px-1.5 py-0.5 h-5 bg-muted text-muted-foreground">
              No booking yet
            </Badge>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function BookingKanbanBoard({
  bookings,
  orphanLeads = [],
  rooms = [],
  onStatusChange,
  onBookingClick,
  onOrphanLeadClick,
  onDeleteOrphanLead,
  onEditBooking,
  onSyncBooking,
  isSyncing,
  isUpdating,
  deletingOrphanLeadId,
  formatCurrency,
}: BookingKanbanBoardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [armedBookingId, setArmedBookingId] = useState<string | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const clickTimerRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const isMobile = useIsMobile();

  // Create a map for quick room lookup
  const roomMap = useMemo(() => {
    const map: Record<string, RoomUnit> = {};
    rooms.forEach(room => {
      map[room.id] = room;
    });
    return map;
  }, [rooms]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const bookingsByStatus = useMemo(() => {
    const grouped: Record<string, BookingWithRelations[]> = {};
    statusColumns.forEach((col) => {
      grouped[col.id] = bookings.filter((b) => b.status === col.id);
    });
    return grouped;
  }, [bookings]);

  const scrollBoard = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 320;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveBookingId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    // If dragging over anything that isn't a status column, do nothing.
    if (!event.over) return;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const bookingId = String(event.active.id);
    const targetStatus = event.over ? String(event.over.id) : null;

    if (targetStatus) {
      const booking = bookings.find((b) => b.id === bookingId);
      if (booking && booking.status !== targetStatus && !isUpdating) {
        onStatusChange(bookingId, targetStatus);
      }
    }

    setActiveBookingId(null);
    setArmedBookingId(null);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="relative">
        {/* Navigation arrows - hidden on mobile */}
        <div className="hidden md:flex absolute -left-2 top-1/2 -translate-y-1/2 z-10">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full bg-background shadow-md"
            onClick={() => scrollBoard('left')}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
        <div className="hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full bg-background shadow-md"
            onClick={() => scrollBoard('right')}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Scroll indicator for mobile */}
        <div className="flex md:hidden items-center justify-center gap-1 mb-2">
          {statusColumns.filter(col => {
            const bookingCount = (bookingsByStatus[col.id] || []).length;
            const orphanCount = col.id === 'new' ? orphanLeads.length : 0;
            return !isMobile || (bookingCount + orphanCount) > 0;
          }).map((col) => {
            const bookingCount = (bookingsByStatus[col.id] || []).length;
            const orphanCount = col.id === 'new' ? orphanLeads.length : 0;
            return (
              <div
                key={col.id}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  (bookingCount + orphanCount) > 0 ? 'bg-primary/60' : 'bg-muted'
                )}
              />
            );
          })}
          <ChevronRight className="w-3 h-3 text-muted-foreground ml-1 animate-pulse" />
        </div>

        <div
          ref={scrollRef}
          className="flex gap-3 md:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent px-1"
          style={{ scrollbarWidth: 'thin' }}
        >
          {statusColumns
            .filter((column) => {
              const bookingCount = (bookingsByStatus[column.id] || []).length;
              const orphanCount = column.id === 'new' ? orphanLeads.length : 0;
              return !isMobile || (bookingCount + orphanCount) > 0;
            })
            .map((column) => {
              const columnBookings = bookingsByStatus[column.id] || [];
              const isNewColumn = column.id === 'new';
              const totalCount = columnBookings.length + (isNewColumn ? orphanLeads.length : 0);
              
              return (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  count={totalCount}
                >
                  <ScrollArea className="flex-1 max-h-[50vh] md:max-h-[60vh]">
                    <div className="p-2 space-y-2 min-h-[150px] md:min-h-[200px]">
                      <AnimatePresence mode="popLayout">
                        {/* Show orphan leads first in the New column */}
                        {isNewColumn && orphanLeads.map((lead) => (
                          <OrphanLeadCard
                            key={`lead-${lead.id}`}
                            lead={lead}
                            onClick={onOrphanLeadClick}
                            onDelete={onDeleteOrphanLead}
                            isDeleting={deletingOrphanLeadId === lead.id}
                          />
                        ))}
                        {columnBookings.map((booking) => (
                          <DraggableBookingCard
                            key={booking.id}
                            booking={booking}
                            room={roomMap[booking.room_unit_id]}
                            isArmed={armedBookingId === booking.id}
                            setArmedBookingId={setArmedBookingId}
                            onBookingClick={onBookingClick}
                            onEditBooking={onEditBooking}
                            onSyncBooking={onSyncBooking}
                            onStatusChange={onStatusChange}
                            isSyncing={isSyncing}
                            isUpdating={isUpdating}
                            clickTimerRef={clickTimerRef}
                            formatCurrency={formatCurrency}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </ScrollArea>
                </KanbanColumn>
              );
            })}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-2 md:hidden">
          Double-tap a card to enable drag • Swipe to see more columns
        </p>

        {activeBookingId && (
          <p className="sr-only" aria-live="polite">
            Dragging booking {activeBookingId}
          </p>
        )}
      </div>
    </DndContext>
  );
}
