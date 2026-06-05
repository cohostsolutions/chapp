import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Clock,
  CheckCircle,
  XCircle,
  Phone,
  Package,
  ChefHat,
  ShoppingBag,
  Calendar,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  User,
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
import { OrderWithLead } from '@/hooks/useOrders';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface StatusColumn {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}

const statusColumns: StatusColumn[] = [
  {
    id: 'pending',
    label: 'Pending',
    color: 'text-warning',
    bgColor: 'bg-warning/10 border-warning/30',
    icon: <Clock className="w-4 h-4" />,
  },
  {
    id: 'confirmed',
    label: 'Confirmed',
    color: 'text-info',
    bgColor: 'bg-info/10 border-info/30',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  {
    id: 'preparing',
    label: 'Preparing',
    color: 'text-primary',
    bgColor: 'bg-primary/10 border-primary/30',
    icon: <ChefHat className="w-4 h-4" />,
  },
  {
    id: 'ready',
    label: 'Ready',
    color: 'text-success',
    bgColor: 'bg-success/10 border-success/30',
    icon: <Package className="w-4 h-4" />,
  },
  {
    id: 'picked_up',
    label: 'Picked Up',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/50 border-muted',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  {
    id: 'cancelled',
    label: 'Cancelled',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10 border-destructive/30',
    icon: <XCircle className="w-4 h-4" />,
  },
];

interface OrderKanbanBoardProps {
  orders: OrderWithLead[];
  onStatusChange: (orderId: string, newStatus: string) => void;
  onOrderClick: (order: OrderWithLead) => void;
  isUpdating: boolean;
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
        'flex-shrink-0 w-[85vw] sm:w-[300px] lg:w-[280px] xl:w-[300px] flex flex-col rounded-xl border-2 transition-all duration-200 snap-start',
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

function DraggableOrderCard({
  order,
  isArmed,
  setArmedOrderId,
  onOrderClick,
  isUpdating,
  clickTimerRef,
}: {
  order: OrderWithLead;
  isArmed: boolean;
  setArmedOrderId: React.Dispatch<React.SetStateAction<string | null>>;
  onOrderClick: (order: OrderWithLead) => void;
  isUpdating: boolean;
  clickTimerRef: React.MutableRefObject<Record<string, ReturnType<typeof setTimeout> | null>>;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    disabled: !isArmed || isUpdating,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        touchAction: 'none' as const,
      }
    : ({ touchAction: isArmed ? 'none' : 'manipulation' } as const);

  const toggleArmed = () => {
    setArmedOrderId((prev) => (prev === order.id ? null : order.id));
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
    if (clickTimerRef.current[order.id]) {
      // Double-click detected - clear timer and arm for drag
      clearTimeout(clickTimerRef.current[order.id]!);
      clickTimerRef.current[order.id] = null;
      toggleArmed();
    } else {
      // First click - set timer for single-click action
      clickTimerRef.current[order.id] = setTimeout(() => {
        clickTimerRef.current[order.id] = null;
        // Single click - open order details
        if (!isArmed && !isDragging) {
          onOrderClick(order);
        }
      }, 280); // Wait 280ms to see if another click comes
    }
  };

  // Parse order items
  const orderItems = Array.isArray(order.order_items) ? (order.order_items as unknown[]) : [];
  const itemCount = orderItems.reduce((sum: number, item) => {
    const qty =
      typeof item === 'object' && item !== null && 'quantity' in item && typeof (item as any).quantity === 'number'
        ? (item as any).quantity
        : 0;
    return sum + qty;
  }, 0);

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
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-xs md:text-sm text-foreground truncate">
                  {order.pickup_name || order.lead?.name || 'Unknown Customer'}
                </p>
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                  {String(itemCount)} item{itemCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div
              className={cn(
                'p-1 rounded transition-colors',
                isArmed ? 'bg-primary/20 text-primary' : 'text-muted-foreground'
              )}
            >
              <GripVertical className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground">
            {order.lead?.phone && (
              <span className="flex items-center gap-1 truncate">
                <Phone className="w-2.5 h-2.5 md:w-3 md:h-3 shrink-0" />
                <span className="truncate">{order.lead.phone}</span>
              </span>
            )}
            {order.lead?.name && (
              <span className="flex items-center gap-1 truncate">
                <User className="w-2.5 h-2.5 md:w-3 md:h-3 shrink-0" />
                <span className="truncate">{order.lead.name}</span>
              </span>
            )}
          </div>

          {order.total_amount && (
            <div className="flex items-center gap-1 text-[10px] md:text-xs">
              <Badge variant="outline" className="text-[9px] md:text-[10px] px-1 py-0 h-4 font-semibold">
                ${Number(order.total_amount).toFixed(2)}
              </Badge>
            </div>
          )}

          {order.pickup_time && (
            <div className="flex items-center gap-1 text-[10px] md:text-xs">
              <Calendar className="w-2.5 h-2.5 md:w-3 md:h-3 text-muted-foreground shrink-0" />
              <span className="font-medium text-foreground">
                {format(parseISO(order.pickup_time), 'MMM d, h:mm a')}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-1 flex-wrap">
            {order.created_at && (
              <p className="text-[9px] text-muted-foreground">
                Ordered {format(parseISO(order.created_at), 'MMM d')}
              </p>
            )}
          </div>

          {isArmed && (
            <p className="text-[9px] text-center text-primary animate-pulse">Drag to move • Double-tap/click again to cancel</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function OrderKanbanBoard({
  orders,
  onStatusChange,
  onOrderClick,
  isUpdating,
}: OrderKanbanBoardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [armedOrderId, setArmedOrderId] = useState<string | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const clickTimerRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const ordersByStatus = useMemo(() => {
    const grouped: Record<string, OrderWithLead[]> = {};
    statusColumns.forEach((col) => {
      grouped[col.id] = orders.filter((o) => o.status === col.id);
    });
    return grouped;
  }, [orders]);

  const scrollBoard = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 320;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveOrderId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    // If dragging over anything that isn't a status column, do nothing.
    if (!event.over) return;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const orderId = String(event.active.id);
    const targetStatus = event.over ? String(event.over.id) : null;

    if (targetStatus) {
      const order = orders.find((o) => o.id === orderId);
      if (order && order.status !== targetStatus && !isUpdating) {
        onStatusChange(orderId, targetStatus);
      }
    }

    setActiveOrderId(null);
    setArmedOrderId(null);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="relative">
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

        <div
          ref={scrollRef}
          className="flex gap-3 md:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
          style={{ scrollbarWidth: 'thin' }}
        >
          {statusColumns.map((column) => {
            const columnOrders = ordersByStatus[column.id] || [];
            const isEmpty = columnOrders.length === 0;
            
            return (
              <KanbanColumn
                key={column.id}
                column={column}
                count={columnOrders.length}
                className={cn(isEmpty && 'hidden lg:flex')}
              >
                <ScrollArea className="flex-1 max-h-[50vh] md:max-h-[60vh]">
                  <div className="p-2 space-y-2 min-h-[150px] md:min-h-[200px]">
                    <AnimatePresence mode="popLayout">
                      {columnOrders.map((order) => (
                        <DraggableOrderCard
                          key={order.id}
                          order={order}
                          isArmed={armedOrderId === order.id}
                          setArmedOrderId={setArmedOrderId}
                          onOrderClick={onOrderClick}
                          isUpdating={isUpdating}
                          clickTimerRef={clickTimerRef}
                        />
                      ))}
                    </AnimatePresence>

                    {isEmpty && (
                      <div className="flex items-center justify-center h-24 md:h-32 text-xs md:text-sm text-muted-foreground">
                        No orders
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </KanbanColumn>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-2 md:hidden">
          Double-tap a card to enable drag • Swipe to see more columns
        </p>

        {activeOrderId && (
          <p className="sr-only" aria-live="polite">
            Dragging order {activeOrderId}
          </p>
        )}
      </div>
    </DndContext>
  );
}
