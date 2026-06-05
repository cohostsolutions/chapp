import { useState, useEffect } from "react";
import type { Tables } from '@/integrations/supabase/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Plus, Clock, Calendar, Mail, BarChart3, PieChart, TrendingUp, Users, MessageSquare, Zap } from "lucide-react";
import { toast } from "sonner";

type Report = Tables<'reports'>;

interface ScheduleReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: Report | null;
  onSave: (scheduleConfig: ScheduleConfig) => void;
}

interface ScheduleConfig {
  is_scheduled: boolean;
  schedule_frequency: 'daily' | 'weekly' | 'monthly';
  schedule_day: number;
  schedule_time: string;
  recipient_emails: string[];
  config: {
    included_metrics: string[];
    included_charts: string[];
    date_range: string;
  };
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const AVAILABLE_METRICS = [
  { id: 'total_leads', label: 'Total Pipeline Records', icon: Users, category: 'leads' },
  { id: 'new_leads', label: 'New Pipeline Records', icon: Users, category: 'leads' },
  { id: 'qualified_leads', label: 'Qualified Pipeline Records', icon: Users, category: 'leads' },
  { id: 'converted_leads', label: 'Converted Pipeline Records', icon: Users, category: 'leads' },
  { id: 'conversion_rate', label: 'Conversion Rate', icon: TrendingUp, category: 'leads' },
  { id: 'total_revenue', label: 'Total Revenue', icon: Zap, category: 'revenue' },
  { id: 'avg_order_value', label: 'Average Transaction Value', icon: Zap, category: 'revenue' },
  { id: 'order_count', label: 'Transaction Count', icon: Zap, category: 'revenue' },
  { id: 'total_conversations', label: 'Total Conversations', icon: MessageSquare, category: 'communications' },
  { id: 'total_messages', label: 'Total Messages', icon: MessageSquare, category: 'communications' },
  { id: 'avg_messages', label: 'Avg Messages/Conversation', icon: MessageSquare, category: 'communications' },
];

const AVAILABLE_CHARTS = [
  { id: 'leads_over_time', label: 'Pipeline Activity Over Time', icon: TrendingUp, description: 'Line chart showing pipeline acquisition trends' },
  { id: 'lead_sources', label: 'Source Distribution', icon: PieChart, description: 'Pie chart of where pipeline records come from' },
  { id: 'lead_status', label: 'Pipeline Status Distribution', icon: BarChart3, description: 'Bar chart of pipeline statuses' },
  { id: 'lead_temperature', label: 'Pipeline Temperature', icon: BarChart3, description: 'Distribution of hot, warm, cold pipeline records' },
  { id: 'channel_distribution', label: 'Channel Distribution', icon: BarChart3, description: 'Communications by channel' },
  { id: 'sales_funnel', label: 'Conversion Funnel', icon: TrendingUp, description: 'Pipeline progression funnel visualization' },
];

export function ScheduleReportDialog({ open, onOpenChange, report, onSave }: ScheduleReportDialogProps) {
  const [activeTab, setActiveTab] = useState('schedule');
  const [isScheduled, setIsScheduled] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [scheduleDay, setScheduleDay] = useState(1);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'total_leads', 'qualified_leads', 'converted_leads', 'total_revenue'
  ]);
  const [selectedCharts, setSelectedCharts] = useState<string[]>([
    'leads_over_time', 'lead_sources', 'lead_status'
  ]);
  const [dateRange, setDateRange] = useState('last_30_days');

  useEffect(() => {
    if (report) {
      setIsScheduled(report.is_scheduled || false);
      const freq = report.schedule_frequency;
      if (freq === 'daily' || freq === 'weekly' || freq === 'monthly') {
        setFrequency(freq);
      }
      setScheduleDay(report.schedule_day || 1);
      setScheduleTime(report.schedule_time?.slice(0, 5) || '09:00');
      setRecipientEmails(report.recipient_emails || []);
      
      // Load saved content config
      const config = (report.config || {}) as { included_metrics?: string[]; included_charts?: string[]; date_range?: string };
      if (config.included_metrics) setSelectedMetrics(config.included_metrics);
      if (config.included_charts) setSelectedCharts(config.included_charts);
      if (config.date_range) setDateRange(config.date_range);
    }
  }, [report]);

  const handleAddEmail = () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    if (recipientEmails.includes(email)) {
      toast.error("Email already added");
      return;
    }
    
    setRecipientEmails([...recipientEmails, email]);
    setNewEmail('');
  };

  const handleRemoveEmail = (email: string) => {
    setRecipientEmails(recipientEmails.filter(e => e !== email));
  };

  const toggleMetric = (metricId: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metricId) 
        ? prev.filter(id => id !== metricId)
        : [...prev, metricId]
    );
  };

  const toggleChart = (chartId: string) => {
    setSelectedCharts(prev => 
      prev.includes(chartId) 
        ? prev.filter(id => id !== chartId)
        : [...prev, chartId]
    );
  };

  const handleSave = () => {
    if (isScheduled && recipientEmails.length === 0) {
      toast.error("Please add at least one recipient email");
      return;
    }

    if (isScheduled && selectedMetrics.length === 0 && selectedCharts.length === 0) {
      toast.error("Please select at least one metric or chart to include");
      return;
    }

    onSave({
      is_scheduled: isScheduled,
      schedule_frequency: frequency,
      schedule_day: scheduleDay,
      schedule_time: scheduleTime,
      recipient_emails: recipientEmails,
      config: {
        included_metrics: selectedMetrics,
        included_charts: selectedCharts,
        date_range: dateRange,
      },
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Schedule Report
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Configure when this report is sent, who receives it, and what content the scheduled email should include.
          </p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[460px] pr-4">
            <TabsContent value="schedule" className="space-y-6 py-4 mt-0">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="schedule-toggle" className="text-base font-medium">
                    Enable Scheduled Emails
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically send this report via email
                  </p>
                </div>
                <Switch
                  id="schedule-toggle"
                  checked={isScheduled}
                  onCheckedChange={setIsScheduled}
                />
              </div>

              {isScheduled && (
                <>
                  {/* Frequency Selection */}
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={frequency} onValueChange={(v) => setFrequency(v as 'daily' | 'weekly' | 'monthly')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Day Selection (for weekly/monthly) */}
                  {frequency === 'weekly' && (
                    <div className="space-y-2">
                      <Label>Day of Week</Label>
                      <Select 
                        value={scheduleDay.toString()} 
                        onValueChange={(v) => setScheduleDay(parseInt(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map(day => (
                            <SelectItem key={day.value} value={day.value.toString()}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {frequency === 'monthly' && (
                    <div className="space-y-2">
                      <Label>Day of Month</Label>
                      <Select 
                        value={scheduleDay.toString()} 
                        onValueChange={(v) => setScheduleDay(parseInt(v))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                            <SelectItem key={day} value={day.toString()}>
                              {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Time Selection */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Time (PHT)
                    </Label>
                    <Input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                    />
                  </div>

                  {/* Recipients */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Recipients
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="Enter email address"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEmail())}
                      />
                      <Button type="button" size="icon" onClick={handleAddEmail}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {recipientEmails.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {recipientEmails.map(email => (
                          <Badge key={email} variant="secondary" className="gap-1">
                            {email}
                            <button
                              type="button"
                              onClick={() => handleRemoveEmail(email)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="content" className="space-y-6 py-4 mt-0">
              {/* Date Range */}
              <div className="space-y-2">
                <Label>Report Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                    <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                    <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                    <SelectItem value="last_year">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Metrics Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Metrics</Label>
                  <span className="text-xs text-muted-foreground">
                    {selectedMetrics.length} selected
                  </span>
                </div>
                <div className="space-y-2">
                  {['leads', 'revenue', 'communications'].map(category => (
                    <div key={category} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {category}
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {AVAILABLE_METRICS.filter(m => m.category === category).map(metric => {
                          const Icon = metric.icon;
                          return (
                            <div
                              key={metric.id}
                              className="flex items-center space-x-3 rounded-xl border p-3 hover:bg-muted/50 cursor-pointer"
                              onClick={() => toggleMetric(metric.id)}
                            >
                              <Checkbox
                                checked={selectedMetrics.includes(metric.id)}
                                onCheckedChange={() => toggleMetric(metric.id)}
                              />
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{metric.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Charts Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Charts & Visualizations</Label>
                  <span className="text-xs text-muted-foreground">
                    {selectedCharts.length} selected
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {AVAILABLE_CHARTS.map(chart => {
                    const Icon = chart.icon;
                    return (
                      <div
                        key={chart.id}
                        className="flex items-start space-x-3 rounded-xl border p-3 hover:bg-muted/50 cursor-pointer"
                        onClick={() => toggleChart(chart.id)}
                      >
                        <Checkbox
                          checked={selectedCharts.includes(chart.id)}
                          onCheckedChange={() => toggleChart(chart.id)}
                          className="mt-0.5"
                        />
                        <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{chart.label}</p>
                          <p className="text-xs text-muted-foreground">{chart.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
