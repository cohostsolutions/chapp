import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import { format, subDays, startOfDay, eachDayOfInterval } from 'date-fns';
import { Users, MousePointerClick, TrendingUp, Calendar, CalendarX } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface DemoRequest {
  id: string;
  created_at: string;
  status: string;
  business_type: string;
}

interface AnalyticsEvent {
  id: string;
  created_at: string;
  event_action: string;
  event_label: string;
  metadata?: unknown;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8884d8', '#82ca9d', '#ffc658'];

export function DemoAnalyticsDashboard() {
  const [demoRequests, setDemoRequests] = useState<DemoRequest[]>([]);
  const [clickEvents, setClickEvents] = useState<AnalyticsEvent[]>([]);
  const [bookingEvents, setBookingEvents] = useState<AnalyticsEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange] = useState(30); // Last 30 days

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    const startDate = subDays(new Date(), dateRange).toISOString();

    const [demosResult, eventsResult, bookingEventsResult] = await Promise.all([
      supabase
        .from('demo_requests')
        .select('id, created_at, status, business_type')
        .gte('created_at', startDate)
        .order('created_at', { ascending: true }),
      supabase
        .from('analytics_events')
        .select('id, created_at, event_action, event_label')
        .eq('event_category', 'CTA')
        .eq('event_action', 'Click')
        .gte('created_at', startDate)
        .order('created_at', { ascending: true }),
      supabase
        .from('analytics_events')
        .select('id, created_at, event_action, event_label, metadata')
        .eq('event_category', 'CTA')
        .eq('event_action', 'Click')
        .in('event_label', ['Demo Call Booked', 'Demo Booking Skipped'])
        .gte('created_at', startDate)
        .order('created_at', { ascending: true })
    ]);

    if (demosResult.data) setDemoRequests(demosResult.data);
    if (eventsResult.data) setClickEvents(eventsResult.data);
    if (bookingEventsResult.data) setBookingEvents(bookingEventsResult.data);
    setIsLoading(false);
  };

  // Calculate metrics
  const totalDemoRequests = demoRequests.length;
  const scheduledDemos = demoRequests.filter(d => d.status === 'scheduled').length;
  const skippedDemos = demoRequests.filter(d => d.status === 'skipped').length;
  const getStartedClicks = clickEvents.filter(e => e.event_label === 'Get Started').length;
  const conversionRate = getStartedClicks > 0 
    ? ((totalDemoRequests / getStartedClicks) * 100).toFixed(1) 
    : '0';

  // Booking vs Skip metrics from analytics events
  const bookedCount = bookingEvents.filter(e => e.event_label === 'Demo Call Booked').length;
  const skippedCount = bookingEvents.filter(e => e.event_label === 'Demo Booking Skipped').length;
  const bookingRate = (bookedCount + skippedCount) > 0
    ? ((bookedCount / (bookedCount + skippedCount)) * 100).toFixed(1)
    : '0';

  // Trend data by day
  const trendData = eachDayOfInterval({
    start: subDays(new Date(), dateRange),
    end: new Date()
  }).map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    
    const clicks = clickEvents.filter(e => 
      format(new Date(e.created_at), 'yyyy-MM-dd') === dayStr
    ).length;
    
    const demos = demoRequests.filter(d => 
      format(new Date(d.created_at), 'yyyy-MM-dd') === dayStr
    ).length;

    return {
      date: format(day, 'MMM dd'),
      clicks,
      demos
    };
  });

  // Booking vs Skip trend data
  const bookingTrendData = eachDayOfInterval({
    start: subDays(new Date(), dateRange),
    end: new Date()
  }).map(day => {
    const dayStr = format(day, 'yyyy-MM-dd');
    
    const booked = bookingEvents.filter(e => 
      e.event_label === 'Demo Call Booked' &&
      format(new Date(e.created_at), 'yyyy-MM-dd') === dayStr
    ).length;
    
    const skipped = bookingEvents.filter(e => 
      e.event_label === 'Demo Booking Skipped' &&
      format(new Date(e.created_at), 'yyyy-MM-dd') === dayStr
    ).length;

    return {
      date: format(day, 'MMM dd'),
      booked,
      skipped
    };
  });

  // Business type distribution
  const businessTypeData = demoRequests.reduce((acc, demo) => {
    const type = demo.business_type || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(businessTypeData).map(([name, value]) => ({
    name,
    value
  }));

  // Booking vs Skip pie data
  const bookingPieData = [
    { name: 'Booked', value: bookedCount },
    { name: 'Skipped', value: skippedCount }
  ].filter(d => d.value > 0);

  // Status distribution
  const statusData = demoRequests.reduce((acc, demo) => {
    const status = demo.status || 'new';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barData = Object.entries(statusData).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  }));

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Demo Request Analytics</h2>
        <span className="text-sm text-muted-foreground">Last {dateRange} days</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MousePointerClick className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Button Clicks</p>
                <p className="text-2xl font-bold">{getStartedClicks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary/10">
                <Users className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Demo Requests</p>
                <p className="text-2xl font-bold">{totalDemoRequests}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <TrendingUp className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold">{conversionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Calendar className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Booked Calls</p>
                <p className="text-2xl font-bold">{bookedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <CalendarX className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Skipped Booking</p>
                <p className="text-2xl font-bold">{skippedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Booking Rate Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Demo Booking Rate</p>
              <p className="text-3xl font-bold">{bookingRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                {bookedCount} booked / {bookedCount + skippedCount} total submissions
              </p>
            </div>
            <div className="w-24 h-24">
              {bookingPieData.length > 0 && (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={bookingPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={40}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="hsl(142, 76%, 36%)" />
                      <Cell fill="hsl(25, 95%, 53%)" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <Tabs defaultValue="booking" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="booking">Booking Rates</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="sources">Request Sources</TabsTrigger>
          <TabsTrigger value="status">Status</TabsTrigger>
        </TabsList>

        <TabsContent value="booking">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Booked vs Skipped Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bookingTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar 
                      dataKey="booked" 
                      name="Booked Calls"
                      fill="hsl(142, 76%, 36%)" 
                      radius={[4, 4, 0, 0]}
                      stackId="a"
                    />
                    <Bar 
                      dataKey="skipped" 
                      name="Skipped"
                      fill="hsl(25, 95%, 53%)" 
                      radius={[4, 4, 0, 0]}
                      stackId="a"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Clicks vs Demo Requests Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="clicks" 
                      name="Button Clicks"
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.3}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="demos" 
                      name="Demo Requests"
                      stroke="hsl(var(--secondary))" 
                      fill="hsl(var(--secondary))" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Request Sources by Business Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Demo Request Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="value" name="Count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
