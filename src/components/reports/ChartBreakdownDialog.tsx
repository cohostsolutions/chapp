import { useState, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { User, Hotel, Calendar, Mail, Phone } from 'lucide-react';

export type ChartType = 'lead_source' | 'booking_source' | 'lead_temperature' | 'booking_status' | 'lead_status';

interface ChartBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chartType: ChartType;
  filterValue: string;
  displayLabel: string;
  count: number;
  color?: string;
}

interface BreakdownItem {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string;
  created_at: string;
  extra?: string;
}

export function ChartBreakdownDialog({
  open,
  onOpenChange,
  chartType,
  filterValue,
  displayLabel,
  count,
  color,
}: ChartBreakdownDialogProps) {
  const { profile } = useAuth();
  const [items, setItems] = useState<BreakdownItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && profile?.organization_id) {
      fetchBreakdownData();
    }
  }, [open, chartType, filterValue, profile?.organization_id]);

  const fetchBreakdownData = async () => {
    if (!profile?.organization_id) return;
    
    setIsLoading(true);
    try {
      let data: BreakdownItem[] = [];

      switch (chartType) {
        case 'lead_source': {
          // Build query based on filter value
          let query = supabase
            .from('leads')
            .select('id, name, email, phone, status, created_at, source')
            .eq('organization_id', profile.organization_id);
          
          // Handle 'unknown' as null or empty source
          if (filterValue === 'unknown' || filterValue.toLowerCase() === 'unknown') {
            query = query.or('source.is.null,source.eq.');
          } else {
            query = query.ilike('source', filterValue);
          }
          
          const { data: leads } = await query
            .order('created_at', { ascending: false })
            .limit(50);
          
          data = (leads || []).map(l => ({
            id: l.id,
            name: l.name,
            email: l.email,
            phone: l.phone,
            status: l.status,
            created_at: l.created_at,
          }));
          break;
        }

        case 'lead_temperature': {
          const { data: leads } = await supabase
            .from('leads')
            .select('id, name, email, phone, status, created_at, lead_temperature')
            .eq('organization_id', profile.organization_id)
            .eq('lead_temperature', filterValue as 'hot' | 'warm' | 'cold')
            .order('created_at', { ascending: false })
            .limit(50);
          
          data = (leads || []).map(l => ({
            id: l.id,
            name: l.name,
            email: l.email,
            phone: l.phone,
            status: l.status,
            created_at: l.created_at,
          }));
          break;
        }

        case 'lead_status': {
          const { data: leads } = await supabase
            .from('leads')
            .select('id, name, email, phone, status, created_at')
            .eq('organization_id', profile.organization_id)
            .eq('status', filterValue as 'new' | 'contacted' | 'qualified' | 'converted' | 'lost')
            .order('created_at', { ascending: false })
            .limit(50);
          
          data = (leads || []).map(l => ({
            id: l.id,
            name: l.name,
            email: l.email,
            phone: l.phone,
            status: l.status,
            created_at: l.created_at,
          }));
          break;
        }

        case 'booking_source': {
          // Fetch all bookings with calendar sync data for accurate source matching
          const { data: bookings } = await supabase
            .from('bookings')
            .select(`
              id, 
              check_in, 
              check_out, 
              status, 
              booking_source,
              calendar_event_id,
              room_unit_id,
              created_at,
              leads!bookings_lead_id_fkey(id, name, email, phone),
              room_units!bookings_room_unit_id_fkey(name, calendar_sources)
            `)
            .eq('organization_id', profile.organization_id)
            .order('created_at', { ascending: false })
            .limit(200);
          
          // Resolve actual source for each booking and filter by matching source
          const matchingBookings: typeof bookings = [];
          
          for (const booking of bookings || []) {
            let resolvedSource = booking.booking_source || 'unknown';
            
            // If from calendar import, try to resolve actual source
            if (['calendar', 'google'].includes(resolvedSource) && booking.calendar_event_id && booking.room_unit_id) {
              const { data: syncEvent } = await supabase
                .from('calendar_sync_events')
                .select('calendar_id, source_platform')
                .eq('google_event_id', booking.calendar_event_id)
                .maybeSingle();
              
              if (syncEvent?.source_platform && !['calendar', 'google', 'unknown'].includes(syncEvent.source_platform)) {
                resolvedSource = syncEvent.source_platform;
              } else if (syncEvent?.calendar_id) {
                const roomUnit = booking.room_units as { calendar_sources?: Record<string, string> } | null;
                const calendarSources = roomUnit?.calendar_sources || {};
                if (calendarSources[syncEvent.calendar_id]) {
                  resolvedSource = calendarSources[syncEvent.calendar_id];
                }
              }
            }
            
            // Check if this booking matches the filter
            if (resolvedSource === filterValue || 
                resolvedSource.toLowerCase() === filterValue.toLowerCase()) {
              matchingBookings.push(booking);
            }
            
            if (matchingBookings.length >= 50) break;
          }
          
          data = matchingBookings.map(b => {
            const lead = b.leads as { name: string; email?: string; phone?: string } | null;
            const room = b.room_units as { name: string } | null;
            return {
              id: b.id,
              name: lead?.name || 'Unknown Guest',
              email: lead?.email,
              phone: lead?.phone,
              status: b.status,
              created_at: b.created_at,
              extra: `${room?.name || 'Unknown Room'} • ${format(new Date(b.check_in), 'MMM d')} - ${format(new Date(b.check_out), 'MMM d, yyyy')}`,
            };
          });
          break;
        }

        case 'booking_status': {
          const { data: bookings } = await supabase
            .from('bookings')
            .select(`
              id, 
              check_in, 
              check_out, 
              status, 
              created_at,
              leads!bookings_lead_id_fkey(id, name, email, phone),
              room_units!bookings_room_unit_id_fkey(name)
            `)
            .eq('organization_id', profile.organization_id)
            .eq('status', filterValue)
            .order('created_at', { ascending: false })
            .limit(50);
          
          data = (bookings || []).map(b => {
            const lead = b.leads as { name: string; email?: string; phone?: string } | null;
            const room = b.room_units as { name: string } | null;
            return {
              id: b.id,
              name: lead?.name || 'Unknown Guest',
              email: lead?.email,
              phone: lead?.phone,
              status: b.status,
              created_at: b.created_at,
              extra: `${room?.name || 'Unknown Room'} • ${format(new Date(b.check_in), 'MMM d')} - ${format(new Date(b.check_out), 'MMM d, yyyy')}`,
            };
          });
          break;
        }
      }

      setItems(data);
    } catch (error) {
      devError('Error fetching breakdown data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = () => {
    switch (chartType) {
      case 'booking_source':
      case 'booking_status':
        return <Hotel className="h-5 w-5" />;
      default:
        return <User className="h-5 w-5" />;
    }
  };

  const getItemTypeLabel = () => {
    switch (chartType) {
      case 'booking_source':
      case 'booking_status':
        return 'bookings';
      default:
        return 'leads';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: color ? `${color}20` : 'hsl(var(--primary) / 0.1)' }}
            >
              <div style={{ color: color || 'hsl(var(--primary))' }}>
                {getIcon()}
              </div>
            </div>
            <div>
              <div>{displayLabel}</div>
              <div className="text-sm text-muted-foreground font-normal">
                {count} {getItemTypeLabel()}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="p-3 border rounded-lg">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-48" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No {getItemTypeLabel()} found
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div 
                  key={item.id} 
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      {item.extra && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {item.extra}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {item.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3" />
                            {item.email}
                          </span>
                        )}
                        {item.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {item.phone}
                          </span>
                        )}
                      </div>
                    </div>
                    {item.status && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {item.status}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              {items.length >= 50 && (
                <div className="text-center py-2 text-xs text-muted-foreground">
                  Showing first 50 results
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}