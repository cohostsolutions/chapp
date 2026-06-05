import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CalendarCheck, 
  BedDouble, 
  Calendar,
  Plus,
  Search,
  RefreshCw,
  ArrowRight,
  Users,
  TrendingUp,
  BarChart3,
  SlidersHorizontal,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, parseISO } from 'date-fns';
import { useAccommodationData } from '@/hooks/useAccommodationData';
import { useAuth } from '@/contexts/AuthContext';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { PullToRefresh } from '@/components/shared/PullToRefresh';
import { CardListSkeleton } from '@/components/shared/skeletons';
import { SectionErrorBoundary } from '@/components/ErrorBoundary';
import { BookingKanbanBoard } from '@/components/bookings/BookingKanbanBoard';
import { useBookingCalendarSync } from '@/hooks/useBookingCalendarSync';
import { useFormatCurrency } from '@/hooks/useMultiCurrency';
import { AnalyticsTabContent } from '@/components/accommodation/AnalyticsTabContent';
import { PricingTabContent } from '@/components/accommodation/PricingTabContent';

// Lazy load the individual tab content components
import BookingsTabContent from '@/components/accommodation/BookingsTabContent';
import RoomsTabContent from '@/components/accommodation/RoomsTabContent';
import AvailabilityTabContent from '@/components/accommodation/AvailabilityTabContent';

export default function AccommodationHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'bookings';
  const actionParam = searchParams.get('action');
  const [activeTab, setActiveTab] = useState(initialTab);
  const { aiAgentType: _aiAgentType } = useAuth();
  const formatCurrency = useFormatCurrency();
  const _navigate = useNavigate();

  // Shared accommodation data
  const accommodationData = useAccommodationData();
  const { syncCalendars, isSyncing: isCalendarSyncing, syncHealth } = useCalendarSync();
  const { syncBooking, deleteCalendarEvent, isSyncing: isBookingSyncing } = useBookingCalendarSync();

  const { stats, isLoading, refetchAll, properties, selectedPropertyId, setSelectedPropertyId } = accommodationData;

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  const handleRefresh = useCallback(async () => {
    await refetchAll();
  }, [refetchAll]);

  const syncBadgeClass = {
    fresh: 'border-success/20 bg-success/10 text-success',
    warning: 'border-warning/20 bg-warning/10 text-warning',
    stale: 'border-destructive/20 bg-destructive/10 text-destructive',
    'never-synced': 'border-warning/20 bg-warning/10 text-warning',
    'no-integrations': 'border-border bg-muted text-muted-foreground',
  }[syncHealth.status];

  const syncBadgeLabel = {
    fresh: 'Calendar sync fresh',
    warning: 'Calendar sync delayed',
    stale: 'Calendar sync stale',
    'never-synced': 'Calendar sync pending',
    'no-integrations': 'No room calendars linked',
  }[syncHealth.status];

  const syncStatusCopy = syncHealth.status === 'no-integrations'
    ? 'Connect room calendars to merge third-party bookings into availability and AI responses.'
    : syncHealth.status === 'never-synced'
      ? 'Calendars are linked, but the first sync has not completed yet.'
      : syncHealth.status === 'fresh'
        ? `Last successful sync ${formatDistanceToNow(syncHealth.lastSyncTime as Date, { addSuffix: true })}.`
        : `Manual sync is recommended. Last successful sync ${formatDistanceToNow(syncHealth.lastSyncTime as Date, { addSuffix: true })}.`;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-3 animate-fade-in h-[calc(100vh-6rem)]">
        {/* Compact Header with inline Stats */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Title */}
          <div className="shrink-0">
            <h1 className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
              <BedDouble className="w-5 h-5 text-primary" />
              Accommodation
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Manage bookings, rooms, and availability
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={syncBadgeClass}>
                {syncHealth.status === 'fresh' ? (
                  <ShieldCheck className="mr-1 h-3 w-3" />
                ) : syncHealth.status === 'no-integrations' ? (
                  <Calendar className="mr-1 h-3 w-3" />
                ) : (
                  <AlertTriangle className="mr-1 h-3 w-3" />
                )}
                {syncBadgeLabel}
              </Badge>
              <p className="text-[11px] md:text-xs text-muted-foreground">
                {syncStatusCopy}
              </p>
            </div>
          </div>

          {/* Inline Stats - Desktop only */}
          <div className="hidden lg:flex items-center gap-2 flex-1 justify-center">
            <div 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border cursor-pointer hover:border-success/50 transition-colors"
              onClick={() => handleTabChange('bookings')}
            >
              <CalendarCheck className="w-3.5 h-3.5 text-success" />
              <span className="text-xs text-muted-foreground">Arriving Today</span>
              <span className="text-sm font-semibold">{isLoading ? '-' : stats.arrivingToday}</span>
            </div>
            <div 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleTabChange('bookings')}
            >
              <BedDouble className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">In-House</span>
              <span className="text-sm font-semibold">{isLoading ? '-' : stats.checkedIn}</span>
            </div>
            <div 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border cursor-pointer hover:border-warning/50 transition-colors"
              onClick={() => handleTabChange('bookings')}
            >
              <ArrowRight className="w-3.5 h-3.5 text-warning rotate-180" />
              <span className="text-xs text-muted-foreground">Departing Today</span>
              <span className="text-sm font-semibold">{isLoading ? '-' : stats.departingToday}</span>
            </div>
            <div 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border cursor-pointer hover:border-info/50 transition-colors"
              onClick={() => handleTabChange('rooms')}
            >
              <TrendingUp className="w-3.5 h-3.5 text-info" />
              <span className="text-xs text-muted-foreground">Occupancy</span>
              <span className="text-sm font-semibold">
                {isLoading ? '-' : (
                  stats.totalRooms > 0 
                    ? `${Math.round((stats.occupiedToday / stats.totalRooms) * 100)}%` 
                    : '0%'
                )}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Select
              value={selectedPropertyId}
              onValueChange={setSelectedPropertyId}
              disabled={properties.length === 0}
            >
              <SelectTrigger className="h-8 min-w-[160px]">
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All properties</SelectItem>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => syncCalendars(true).then(() => refetchAll())}
              disabled={isCalendarSyncing}
              className="h-8"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isCalendarSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Calendars</span>
              <span className="sm:hidden">Sync</span>
            </Button>
          </div>
        </div>

        {/* Mobile Stats - Only visible on smaller screens */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:hidden">
          <Card className="glass cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleTabChange('bookings')}>
            <CardContent className="p-2 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-success/10">
                <CalendarCheck className="w-3.5 h-3.5 text-success" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Arriving</p>
                <p className="text-base font-bold">{isLoading ? '-' : stats.arrivingToday}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleTabChange('bookings')}>
            <CardContent className="p-2 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <BedDouble className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">In-House</p>
                <p className="text-base font-bold">{isLoading ? '-' : stats.checkedIn}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleTabChange('bookings')}>
            <CardContent className="p-2 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-warning/10">
                <ArrowRight className="w-3.5 h-3.5 text-warning rotate-180" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Departing</p>
                <p className="text-base font-bold">{isLoading ? '-' : stats.departingToday}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleTabChange('rooms')}>
            <CardContent className="p-2 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-info/10">
                <TrendingUp className="w-3.5 h-3.5 text-info" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Occupancy</p>
                <p className="text-base font-bold">
                  {isLoading ? '-' : (
                    stats.totalRooms > 0 
                      ? `${Math.round((stats.occupiedToday / stats.totalRooms) * 100)}%` 
                      : '0%'
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Content - fills remaining height */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-5 h-auto p-1">
            <TabsTrigger 
              value="bookings" 
              className="flex items-center gap-2 py-2.5 data-[state=active]:shadow-sm"
            >
              <CalendarCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Bookings</span>
              {stats.pending + stats.upcoming > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {stats.pending + stats.upcoming}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="rooms" 
              className="flex items-center gap-2 py-2.5 data-[state=active]:shadow-sm"
            >
              <BedDouble className="w-4 h-4" />
              <span className="hidden sm:inline">Rooms</span>
              {stats.activeRooms > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {stats.activeRooms}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="availability" 
              className="flex items-center gap-2 py-2.5 data-[state=active]:shadow-sm"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Availability</span>
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="flex items-center gap-2 py-2.5 data-[state=active]:shadow-sm"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger 
              value="pricing" 
              className="flex items-center gap-2 py-2.5 data-[state=active]:shadow-sm"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Pricing</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-3 flex-1 min-h-0 overflow-auto">
            <TabsContent value="bookings" className="m-0 h-full focus-visible:ring-0 focus-visible:ring-offset-0">
              <SectionErrorBoundary name="Bookings">
                <BookingsTabContent 
                  accommodationData={accommodationData}
                  syncBooking={syncBooking}
                  deleteCalendarEvent={deleteCalendarEvent}
                  isSyncing={isBookingSyncing}
                  formatCurrency={formatCurrency}
                  openNewBooking={actionParam === 'new'}
                  onNewBookingOpened={() => setSearchParams({ tab: 'bookings' }, { replace: true })}
                />
              </SectionErrorBoundary>
            </TabsContent>

            <TabsContent value="rooms" className="m-0 h-full focus-visible:ring-0 focus-visible:ring-offset-0">
              <SectionErrorBoundary name="Room Units">
                <RoomsTabContent 
                  accommodationData={accommodationData}
                  formatCurrency={formatCurrency}
                />
              </SectionErrorBoundary>
            </TabsContent>

            <TabsContent value="availability" className="m-0 h-full focus-visible:ring-0 focus-visible:ring-offset-0">
              <SectionErrorBoundary name="Availability">
                <AvailabilityTabContent 
                  accommodationData={accommodationData}
                  formatCurrency={formatCurrency}
                  syncBooking={syncBooking}
                />
              </SectionErrorBoundary>
            </TabsContent>

            <TabsContent value="analytics" className="m-0 h-full focus-visible:ring-0 focus-visible:ring-offset-0">
              <SectionErrorBoundary name="Analytics">
                <AnalyticsTabContent 
                  bookings={accommodationData.bookings}
                  rooms={accommodationData.rooms}
                  isLoading={accommodationData.isLoading}
                  formatCurrency={formatCurrency}
                  propertyName={selectedPropertyId !== 'all' ? properties.find(p => p.id === selectedPropertyId)?.name : 'All Properties'}
                />
              </SectionErrorBoundary>
            </TabsContent>

            <TabsContent value="pricing" className="m-0 h-full focus-visible:ring-0 focus-visible:ring-offset-0">
              <SectionErrorBoundary name="Pricing">
                <PricingTabContent
                  properties={accommodationData.properties}
                  rooms={accommodationData.rooms}
                />
              </SectionErrorBoundary>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </PullToRefresh>
  );
}
