import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Briefcase, 
  Users,
  Calendar,
  RefreshCw,
  Search,
  TrendingUp
} from 'lucide-react';
import { useSalesData } from '@/hooks/useSalesData';
import { useAuth } from '@/contexts/AuthContext';
import { useCalendarSync } from '@/hooks/useCalendarSync';
import { useToast } from '@/hooks/use-toast';
import { trackButtonClick, trackEvent } from '@/hooks/useAnalyticsTracking';
import { PullToRefresh } from '@/components/shared/PullToRefresh';
import { CardListSkeleton } from '@/components/shared/skeletons';
import { SectionErrorBoundary } from '@/components/ErrorBoundary';
import { LeadsKanbanBoard } from '@/components/sales/LeadsKanbanBoard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SkipToContent } from '@/components/shared/SkipToContent';

// Lazy load tab content components
import LeadsTabContent from '@/components/sales/LeadsTabContent';
import OfferingsTabContent from '@/components/sales/OfferingsTabContent';
import SalesCalendarTabContent from '@/components/sales/SalesCalendarTabContent';

export default function SalesOperations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'leads';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { aiAgentType: _aiAgentType } = useAuth();
  const { toast } = useToast();

  // Shared sales data
  const salesData = useSalesData();
  const { syncCalendars, isSyncing: isCalendarSyncing } = useCalendarSync();

  const { stats, isLoading, refetchAll } = salesData;

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
    trackEvent({
      eventType: 'navigation',
      eventCategory: 'Sales Operations',
      eventAction: 'Tab Switch',
      eventLabel: value,
      metadata: {
        fromTab: activeTab,
        toTab: value,
        timestamp: new Date().toISOString()
      }
    });
  };

  const handleRefresh = useCallback(async () => {
    await refetchAll();
  }, [refetchAll]);

  const handleCalendarSync = useCallback(async () => {
    trackButtonClick('Calendar Sync', { 
      source: 'sales_operations_header',
      timestamp: new Date().toISOString() 
    });
    try {
      await syncCalendars(true);
      await refetchAll();
      toast({
        title: 'Calendars synced successfully',
        description: 'Your calendar events have been updated.',
      });
      trackEvent({
        eventType: 'sync',
        eventCategory: 'Calendar',
        eventAction: 'Success',
        eventLabel: 'Sales Operations',
        metadata: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      toast({
        title: 'Calendar sync failed',
        description: 'There was an error syncing your calendars. Please try again.',
        variant: 'destructive',
      });
      trackEvent({
        eventType: 'sync',
        eventCategory: 'Calendar',
        eventAction: 'Error',
        eventLabel: 'Sales Operations',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
    }
  }, [syncCalendars, refetchAll, toast]);

  return (
    <>
      <SkipToContent />
      <PullToRefresh onRefresh={handleRefresh}>
        <main id="main-content" className="space-y-3 animate-fade-in h-[calc(100vh-6rem)]">
        {/* Compact Header with inline Stats */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Title */}
          <div className="shrink-0">
            <h1 className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary" />
              Sales
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              Manage leads, offerings, and appointments
            </p>
          </div>

          {/* Inline Stats - Desktop only */}
          <div className="hidden lg:flex items-center gap-2 flex-1 justify-center">
            <button 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border hover:border-success/50 transition-colors focus:outline-none focus:ring-2 focus:ring-success/50 focus:ring-offset-2"
              onClick={() => {
                handleTabChange('leads');
                trackButtonClick('Total Leads Stat', { 
                  value: stats.totalLeads,
                  source: 'desktop_stats',
                  timestamp: new Date().toISOString()
                });
              }}
              aria-label={`View leads: ${isLoading ? 'Loading' : stats.totalLeads} total leads`}
            >
              <Users className="w-3.5 h-3.5 text-success" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">Total Leads</span>
              <span className="text-sm font-semibold">{isLoading ? '-' : stats.totalLeads}</span>
            </button>
            <button 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
              onClick={() => {
                handleTabChange('leads');
                trackButtonClick('Qualified Leads Stat', { 
                  value: stats.qualifiedLeads,
                  source: 'desktop_stats',
                  timestamp: new Date().toISOString()
                });
              }}
              aria-label={`View qualified leads: ${isLoading ? 'Loading' : stats.qualifiedLeads} qualified leads`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">Qualified</span>
              <span className="text-sm font-semibold">{isLoading ? '-' : stats.qualifiedLeads}</span>
            </button>
            <button 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border hover:border-info/50 transition-colors focus:outline-none focus:ring-2 focus:ring-info/50 focus:ring-offset-2"
              onClick={() => {
                handleTabChange('offerings');
                trackButtonClick('Offerings Stat', { 
                  value: stats.totalOfferings,
                  source: 'desktop_stats',
                  timestamp: new Date().toISOString()
                });
              }}
              aria-label={`View offerings: ${isLoading ? 'Loading' : stats.totalOfferings} total offerings`}
            >
              <Briefcase className="w-3.5 h-3.5 text-info" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">Offerings</span>
              <span className="text-sm font-semibold">{isLoading ? '-' : stats.totalOfferings}</span>
            </button>
            <button 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border hover:border-warning/50 transition-colors focus:outline-none focus:ring-2 focus:ring-warning/50 focus:ring-offset-2"
              onClick={() => {
                handleTabChange('calendar');
                trackButtonClick('AI Booked Appointments Stat', { 
                  value: stats.aiBookedAppointments,
                  source: 'desktop_stats',
                  timestamp: new Date().toISOString()
                });
              }}
              aria-label={`View AI booked appointments: ${isLoading ? 'Loading' : stats.aiBookedAppointments} AI booked appointments`}
            >
              <Calendar className="w-3.5 h-3.5 text-warning" aria-hidden="true" />
              <span className="text-xs text-muted-foreground">AI Booked</span>
              <span className="text-sm font-semibold">{isLoading ? '-' : stats.aiBookedAppointments}</span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCalendarSync}
              disabled={isCalendarSyncing}
              className="h-8"
              aria-label={isCalendarSyncing ? 'Syncing calendars...' : 'Sync calendars'}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isCalendarSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span className="hidden sm:inline">Sync Calendars</span>
              <span className="sm:hidden">Sync</span>
            </Button>
          </div>
        </div>

        {/* Mobile Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:hidden">
          <button 
            className="glass hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 rounded-lg text-left w-full"
            onClick={() => {
              handleTabChange('leads');
              trackButtonClick('Mobile Total Leads Stat', { 
                value: stats.totalLeads,
                source: 'mobile_stats',
                timestamp: new Date().toISOString()
              });
            }}
            aria-label={`View leads: ${isLoading ? 'Loading' : stats.totalLeads} total leads`}
          >
            <div className="p-2 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-success/10">
                <Users className="w-3.5 h-3.5 text-success" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Leads</p>
                <p className="text-base font-bold">{isLoading ? '-' : stats.totalLeads}</p>
              </div>
            </div>
          </button>
          <button 
            className="glass hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 rounded-lg text-left w-full"
            onClick={() => {
              handleTabChange('leads');
              trackButtonClick('Mobile Qualified Leads Stat', { 
                value: stats.qualifiedLeads,
                source: 'mobile_stats',
                timestamp: new Date().toISOString()
              });
            }}
            aria-label={`View qualified leads: ${isLoading ? 'Loading' : stats.qualifiedLeads} qualified leads`}
          >
            <div className="p-2 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <TrendingUp className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Qualified</p>
                <p className="text-base font-bold">{isLoading ? '-' : stats.qualifiedLeads}</p>
              </div>
            </div>
          </button>
          <button 
            className="glass hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 rounded-lg text-left w-full"
            onClick={() => {
              handleTabChange('offerings');
              trackButtonClick('Mobile Offerings Stat', { 
                value: stats.totalOfferings,
                source: 'mobile_stats',
                timestamp: new Date().toISOString()
              });
            }}
            aria-label={`View offerings: ${isLoading ? 'Loading' : stats.totalOfferings} total offerings`}
          >
            <div className="p-2 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-info/10">
                <Briefcase className="w-3.5 h-3.5 text-info" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Offerings</p>
                <p className="text-base font-bold">{isLoading ? '-' : stats.totalOfferings}</p>
              </div>
            </div>
          </button>
          <button 
            className="glass hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 rounded-lg text-left w-full"
            onClick={() => {
              handleTabChange('calendar');
              trackButtonClick('Mobile AI Booked Appointments Stat', { 
                value: stats.aiBookedAppointments,
                source: 'mobile_stats',
                timestamp: new Date().toISOString()
              });
            }}
            aria-label={`View AI booked appointments: ${isLoading ? 'Loading' : stats.aiBookedAppointments} AI booked appointments`}
          >
            <div className="p-2 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-warning/10">
                <Calendar className="w-3.5 h-3.5 text-warning" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">AI Booked</p>
                <p className="text-base font-bold">{isLoading ? '-' : stats.aiBookedAppointments}</p>
              </div>
            </div>
          </button>
        </div>

        {/* Tabs */}
        <Card className="glass flex-1 flex flex-col">
          <Tabs 
            value={activeTab} 
            onValueChange={handleTabChange} 
            className="flex-1 flex flex-col"
          >
            <div className="p-4 border-b">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="leads" className="text-xs sm:text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 sm:hidden" aria-hidden="true" />
                  <span className="hidden sm:inline">Leads</span>
                  <span className="sm:hidden">Leads</span>
                </TabsTrigger>
                <TabsTrigger value="offerings" className="text-xs sm:text-sm flex items-center gap-2">
                  <Briefcase className="w-4 h-4 sm:hidden" aria-hidden="true" />
                  <span className="hidden sm:inline">Offerings</span>
                  <span className="sm:hidden">Offerings</span>
                </TabsTrigger>
                <TabsTrigger value="calendar" className="text-xs sm:text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 sm:hidden" aria-hidden="true" />
                  <span className="hidden sm:inline">Calendar</span>
                  <span className="sm:hidden">Calendar</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="leads" className="mt-0 h-full">
                <SectionErrorBoundary name="Leads">
                  {isLoading ? (
                    <CardListSkeleton count={5} />
                  ) : (
                    <LeadsTabContent salesData={salesData} />
                  )}
                </SectionErrorBoundary>
              </TabsContent>

              <TabsContent value="offerings" className="mt-0 h-full">
                <SectionErrorBoundary name="Offerings">
                  {isLoading ? (
                    <CardListSkeleton count={5} />
                  ) : (
                    <OfferingsTabContent salesData={salesData} />
                  )}
                </SectionErrorBoundary>
              </TabsContent>

              <TabsContent value="calendar" className="mt-0 h-full">
                <SectionErrorBoundary name="Calendar">
                  {isLoading ? (
                    <CardListSkeleton count={5} />
                  ) : (
                    <SalesCalendarTabContent salesData={salesData} />
                  )}
                </SectionErrorBoundary>
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </main>
    </PullToRefresh>
    </>
  );
}
