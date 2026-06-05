import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles,
  Phone,
  MessageSquare,
  CheckCircle,
  TrendingUp,
  XCircle,
  Mail,
  GripVertical,
  ChevronLeft,
  ChevronRight,
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
import { LeadWithAgent } from '@/types/database';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { LeadTemperatureBadge } from '@/components/LeadTemperatureBadge';

interface StatusColumn {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}

const statusColumns: StatusColumn[] = [
  {
    id: 'new',
    label: 'New',
    color: 'text-primary',
    bgColor: 'bg-primary/10 border-primary/30',
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    id: 'contacted',
    label: 'Contacted',
    color: 'text-warning',
    bgColor: 'bg-warning/10 border-warning/30',
    icon: <Phone className="w-4 h-4" />,
  },
  {
    id: 'qualified',
    label: 'Qualified',
    color: 'text-info',
    bgColor: 'bg-info/10 border-info/30',
    icon: <TrendingUp className="w-4 h-4" />,
  },
  {
    id: 'converted',
    label: 'Converted',
    color: 'text-success',
    bgColor: 'bg-success/10 border-success/30',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  {
    id: 'lost',
    label: 'Lost',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10 border-destructive/30',
    icon: <XCircle className="w-4 h-4" />,
  },
];

interface LeadKanbanBoardProps {
  leads: LeadWithAgent[];
  onStatusChange: (leadId: string, newStatus: string) => void;
  onLeadClick: (lead: LeadWithAgent) => void;
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

function DraggableLeadCard({
  lead,
  isArmed,
  setArmedLeadId,
  onLeadClick,
  isUpdating,
  clickTimerRef,
}: {
  lead: LeadWithAgent;
  isArmed: boolean;
  setArmedLeadId: React.Dispatch<React.SetStateAction<string | null>>;
  onLeadClick: (lead: LeadWithAgent) => void;
  isUpdating: boolean;
  clickTimerRef: React.MutableRefObject<Record<string, ReturnType<typeof setTimeout> | null>>;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    disabled: !isArmed || isUpdating,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        touchAction: 'none' as const,
      }
    : ({ touchAction: isArmed ? 'none' : 'manipulation' } as const);

  const toggleArmed = () => {
    setArmedLeadId((prev) => (prev === lead.id ? null : lead.id));
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
    if (clickTimerRef.current[lead.id]) {
      // Double-click detected - clear timer and arm for drag
      clearTimeout(clickTimerRef.current[lead.id]!);
      clickTimerRef.current[lead.id] = null;
      toggleArmed();
    } else {
      // First click - set timer for single-click action
      clickTimerRef.current[lead.id] = setTimeout(() => {
        clickTimerRef.current[lead.id] = null;
        // Single click - open lead info
        if (!isArmed && !isDragging) {
          onLeadClick(lead);
        }
      }, 280); // Wait 280ms to see if another click comes
    }
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
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-xs md:text-sm text-foreground truncate">
                  {lead.name || 'Unknown Lead'}
                </p>
                <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                  {lead.email || 'No Email'}
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
            {lead.phone && (
              <span className="flex items-center gap-1 truncate">
                <Phone className="w-2.5 h-2.5 md:w-3 md:h-3 shrink-0" />
                <span className="truncate">{lead.phone}</span>
              </span>
            )}
            {lead.email && (
              <span className="flex items-center gap-1 truncate">
                <Mail className="w-2.5 h-2.5 md:w-3 md:h-3 shrink-0" />
                <span className="truncate">{lead.email}</span>
              </span>
            )}
          </div>

          {lead.source && (
            <div className="flex items-center gap-1 text-[10px] md:text-xs">
              <Badge variant="outline" className="text-[9px] md:text-[10px] px-1 py-0 h-4">
                {lead.source}
              </Badge>
            </div>
          )}

          <div className="flex items-center justify-between gap-1 flex-wrap">
            {lead.lead_temperature && (
              <LeadTemperatureBadge temperature={lead.lead_temperature} size="sm" />
            )}
            {lead.assigned_agent && (
              <Badge variant="outline" className="text-[9px] md:text-[10px] px-1 py-0 h-4 ml-auto">
                {lead.assigned_agent.full_name || lead.assigned_agent.email}
              </Badge>
            )}
          </div>

          {lead.created_at && (
            <p className="text-[9px] text-muted-foreground">
              Added {format(parseISO(lead.created_at), 'MMM d, yyyy')}
            </p>
          )}

          {isArmed && (
            <p className="text-[9px] text-center text-primary animate-pulse">Drag to move • Double-tap/click again to cancel</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function LeadKanbanBoard({
  leads,
  onStatusChange,
  onLeadClick,
  isUpdating,
}: LeadKanbanBoardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [armedLeadId, setArmedLeadId] = useState<string | null>(null);
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const clickTimerRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const leadsByStatus = useMemo(() => {
    const grouped: Record<string, LeadWithAgent[]> = {};
    statusColumns.forEach((col) => {
      grouped[col.id] = leads.filter((l) => l.status === col.id);
    });
    return grouped;
  }, [leads]);

  const scrollBoard = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const scrollAmount = 320;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveLeadId(String(event.active.id));
  };

  const handleDragOver = (event: DragOverEvent) => {
    // If dragging over anything that isn't a status column, do nothing.
    if (!event.over) return;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const leadId = String(event.active.id);
    const targetStatus = event.over ? String(event.over.id) : null;

    if (targetStatus) {
      const lead = leads.find((l) => l.id === leadId);
      if (lead && lead.status !== targetStatus && !isUpdating) {
        onStatusChange(leadId, targetStatus);
      }
    }

    setActiveLeadId(null);
    setArmedLeadId(null);
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
            const columnLeads = leadsByStatus[column.id] || [];
            const isEmpty = columnLeads.length === 0;
            
            return (
              <KanbanColumn
                key={column.id}
                column={column}
                count={columnLeads.length}
                className={cn(isEmpty && 'hidden lg:flex')}
              >
                <ScrollArea className="flex-1 max-h-[50vh] md:max-h-[60vh]">
                  <div className="p-2 space-y-2 min-h-[150px] md:min-h-[200px]">
                    <AnimatePresence mode="popLayout">
                      {columnLeads.map((lead) => (
                        <DraggableLeadCard
                          key={lead.id}
                          lead={lead}
                          isArmed={armedLeadId === lead.id}
                          setArmedLeadId={setArmedLeadId}
                          onLeadClick={onLeadClick}
                          isUpdating={isUpdating}
                          clickTimerRef={clickTimerRef}
                        />
                      ))}
                    </AnimatePresence>

                    {isEmpty && (
                      <div className="flex items-center justify-center h-24 md:h-32 text-xs md:text-sm text-muted-foreground">
                        No leads
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

        {activeLeadId && (
          <p className="sr-only" aria-live="polite">
            Dragging lead {activeLeadId}
          </p>
        )}
      </div>
    </DndContext>
  );
}
