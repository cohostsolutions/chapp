import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, Phone, GripVertical, Loader2 } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { useSalesData } from '@/hooks/useSalesData';

interface LeadsKanbanBoardProps {
  leads: Record<string, ReturnType<typeof useSalesData>['leads']>;
  onLeadClick?: (lead: ReturnType<typeof useSalesData>['leads'][0]) => void;
  onStatusChange?: (leadId: string, newStatus: string) => void;
  isUpdating?: boolean;
}

const statusColumns = [
  { id: 'new', label: 'New', color: 'bg-blue-500/10 border-blue-200' },
  { id: 'contacted', label: 'Contacted', color: 'bg-purple-500/10 border-purple-200' },
  { id: 'qualified', label: 'Qualified', color: 'bg-green-500/10 border-green-200' },
  { id: 'converted', label: 'Converted', color: 'bg-emerald-500/10 border-emerald-200' },
  { id: 'lost', label: 'Lost', color: 'bg-red-500/10 border-red-200' },
];

type Lead = ReturnType<typeof useSalesData>['leads'][0];

// Droppable Column
function DroppableColumn({ 
  column, 
  leads, 
  onLeadClick,
  activeDragId,
}: { 
  column: typeof statusColumns[0]; 
  leads: Lead[];
  onLeadClick?: (lead: Lead) => void;
  activeDragId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div 
      ref={setNodeRef}
      className={`rounded-lg border ${column.color} p-3 min-h-[400px] flex flex-col transition-all ${
        isOver ? 'ring-2 ring-primary/50 bg-primary/5' : ''
      }`}
    >
      <div className="mb-3">
        <h3 className="font-semibold text-sm">{column.label}</h3>
        <p className="text-xs text-muted-foreground">
          {leads.length} lead{leads.length !== 1 ? 's' : ''}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 pr-4">
          {leads.map(lead => (
            <DraggableLeadCard 
              key={lead.id} 
              lead={lead} 
              onLeadClick={onLeadClick}
              isDragging={activeDragId === lead.id}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

// Draggable Lead Card
function DraggableLeadCard({ 
  lead, 
  onLeadClick,
  isDragging,
}: { 
  lead: Lead; 
  onLeadClick?: (lead: Lead) => void;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className={`glass border-0 cursor-pointer hover:shadow-md transition-shadow ${
        isDragging ? 'opacity-50' : ''
      }`}
      onClick={() => onLeadClick?.(lead)}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <div 
            {...attributes} 
            {...listeners}
            className="cursor-grab active:cursor-grabbing mt-0.5 touch-none"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{lead.name}</h4>
            <div className="space-y-1 mt-2 text-xs text-muted-foreground">
              {lead.email && (
                <div className="flex items-center gap-1 truncate">
                  <Mail className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="w-3 h-3 flex-shrink-0" />
                  <span>{lead.phone}</span>
                </div>
              )}
            </div>
            {lead.offerings && lead.offerings.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {lead.offerings.slice(0, 2).map(offering => (
                  <Badge key={offering.id} variant="secondary" className="text-[10px] py-0 px-1">
                    {offering.name.substring(0, 15)}...
                  </Badge>
                ))}
                {lead.offerings.length > 2 && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-1">
                    +{lead.offerings.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Lead Card for Overlay
function LeadCardOverlay({ lead }: { lead: Lead }) {
  return (
    <Card className="glass border-primary shadow-lg w-[250px]">
      <CardContent className="p-3">
        <h4 className="font-medium text-sm truncate">{lead.name}</h4>
        <div className="space-y-1 mt-2 text-xs text-muted-foreground">
          {lead.email && (
            <div className="flex items-center gap-1 truncate">
              <Mail className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.phone && (
            <div className="flex items-center gap-1">
              <Phone className="w-3 h-3 flex-shrink-0" />
              <span>{lead.phone}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function LeadsKanbanBoard({ leads, onLeadClick, onStatusChange, isUpdating }: LeadsKanbanBoardProps) {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveDragId(active.id as string);
    const lead = active.data?.current?.lead as Lead;
    if (lead) {
      setActiveLead(lead);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id && onStatusChange) {
      const leadId = active.id as string;
      const newStatus = over.id as string;
      
      // Find the lead's current status
      let currentStatus = '';
      for (const [status, statusLeads] of Object.entries(leads)) {
        if (statusLeads.some(l => l.id === leadId)) {
          currentStatus = status;
          break;
        }
      }
      
      // Only update if dropped on a different column
      if (currentStatus !== newStatus && statusColumns.some(c => c.id === newStatus)) {
        onStatusChange(leadId, newStatus);
      }
    }
    
    setActiveDragId(null);
    setActiveLead(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {isUpdating && (
        <div className="fixed bottom-4 right-4 bg-card border rounded-lg px-4 py-2 shadow-lg flex items-center gap-2 z-50">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm">Updating...</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statusColumns.map(column => (
          <DroppableColumn 
            key={column.id} 
            column={column} 
            leads={leads[column.id] || []}
            onLeadClick={onLeadClick}
            activeDragId={activeDragId}
          />
        ))}
      </div>
      <DragOverlay>
        {activeLead ? <LeadCardOverlay lead={activeLead} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
