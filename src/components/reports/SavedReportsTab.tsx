import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  FileText, 
  Calendar, 
  Mail, 
  Clock,
  Trash2,
  Settings,
  Play,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Loader2,
  Search,
  Copy,
  Eye,
  BarChart3,
  Users,
  DollarSign,
  UserCheck,
  BedDouble,
  ShoppingCart,
  Filter,
  SortAsc,
  SortDesc,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Tables } from '@/integrations/supabase/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useReports, useCreateReport, useUpdateReport, useDeleteReport, REPORT_TEMPLATES } from '@/hooks/useReports';
import { ScheduleReportDialog } from '@/components/reports/ScheduleReportDialog';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  getAgentAwareSavedReportTypeDefinition,
  getAgentAwareSavedReportTypes,
  type SavedReportType,
} from '@/lib/reportingAgentConfig';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const REPORT_TYPE_CONFIG: Record<string, { 
  icon: typeof FileText; 
  color: string;
  bgColor: string;
}> = {
  leads: { 
    icon: Users, 
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  revenue: { 
    icon: DollarSign, 
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  agents: { 
    icon: UserCheck, 
    color: 'text-info',
    bgColor: 'bg-info/10',
  },
  bookings: { 
    icon: BedDouble, 
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  orders: { 
    icon: ShoppingCart, 
    color: 'text-accent-foreground',
    bgColor: 'bg-accent/50',
  },
  operations: {
    icon: BarChart3,
    color: 'text-chart-3',
    bgColor: 'bg-chart-3/10',
  },
  custom: { 
    icon: BarChart3, 
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
};

type SortOption = 'newest' | 'oldest' | 'name' | 'type';
type FilterOption = 'all' | 'scheduled' | 'unscheduled';

type Report = Tables<'reports'>;

type ScheduleConfig = {
  is_scheduled: boolean;
  schedule_frequency?: string | null;
  schedule_day?: number | null;
  schedule_time?: string | null;
  recipient_emails?: string[] | null;
  config?: unknown;
};

export function SavedReportsTab() {
  const { profile, aiAgentType } = useAuth();
  const orgId = profile?.organization_id || '';
  
  const { data: reports = [], isLoading, refetch } = useReports(orgId);
  const createReport = useCreateReport(orgId);
  const updateReport = useUpdateReport();
  const deleteReport = useDeleteReport();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [sendingReport, setSendingReport] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  
  const [newReportName, setNewReportName] = useState('');
  const [newReportDesc, setNewReportDesc] = useState('');
  const [newReportType, setNewReportType] = useState<SavedReportType>('leads');

  const availableReportTypes = useMemo(() => getAgentAwareSavedReportTypes(aiAgentType), [aiAgentType]);
  const availableTemplates = useMemo(
    () => REPORT_TEMPLATES.filter((template) => availableReportTypes.includes(template.type as SavedReportType)),
    [availableReportTypes],
  );

  useEffect(() => {
    if (!availableReportTypes.includes(newReportType)) {
      setNewReportType(availableReportTypes[0] ?? 'custom');
    }
  }, [availableReportTypes, newReportType]);

  const filteredReports = useMemo(() => {
    let result = [...reports];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r => 
        r.name.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query) ||
        r.report_type.toLowerCase().includes(query)
      );
    }
    
    if (filterOption === 'scheduled') {
      result = result.filter(r => r.is_scheduled);
    } else if (filterOption === 'unscheduled') {
      result = result.filter(r => !r.is_scheduled);
    }
    
    result.sort((a, b) => {
      switch (sortOption) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          return a.report_type.localeCompare(b.report_type);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    
    return result;
  }, [reports, searchQuery, filterOption, sortOption]);

  const stats = useMemo(() => ({
    total: reports.length,
    scheduled: reports.filter(r => r.is_scheduled).length,
    unscheduled: reports.filter(r => !r.is_scheduled).length,
  }), [reports]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast.success('Reports refreshed');
  };

  const handleCreateReport = async () => {
    if (!newReportName.trim()) {
      toast.error('Please enter a report name');
      return;
    }
    
    await createReport.mutateAsync({
      name: newReportName,
      description: newReportDesc,
      report_type: newReportType,
      config: availableTemplates.find(t => t.type === newReportType)?.config || {},
    });
    
    setShowCreateDialog(false);
    setNewReportName('');
    setNewReportDesc('');
    setNewReportType(availableReportTypes[0] ?? 'custom');
  };

  const handleDuplicateReport = async (report: Report) => {
    await createReport.mutateAsync({
      name: `${report.name} (Copy)`,
      description: report.description,
      report_type: report.report_type,
      config: report.config,
    });
    toast.success('Report duplicated');
  };

  const handleScheduleReport = (report: Report) => {
    setSelectedReport(report);
    setShowScheduleDialog(true);
  };

  const handlePreviewReport = (report: Report) => {
    setSelectedReport(report);
    setShowPreviewDialog(true);
  };

  const handleSaveSchedule = async (scheduleConfig: ScheduleConfig) => {
    if (!selectedReport) return;
    
    await updateReport.mutateAsync({
      id: selectedReport.id,
      is_scheduled: scheduleConfig.is_scheduled,
      schedule_frequency: scheduleConfig.schedule_frequency,
      schedule_day: scheduleConfig.schedule_day,
      schedule_time: scheduleConfig.schedule_time,
      recipient_emails: scheduleConfig.recipient_emails,
      config: scheduleConfig.config as any,
    });
    
    toast.success(scheduleConfig.is_scheduled ? 'Report scheduled successfully' : 'Schedule disabled');
  };

  const handleDeleteReport = async () => {
    if (!deleteConfirmId) return;
    await deleteReport.mutateAsync(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const handleSendNow = async (report: Report) => {
    setSendingReport(report.id);
    try {
      const { error } = await supabase.functions.invoke('send-scheduled-reports', {
        body: { reportId: report.id, sendNow: true }
      });
      
      if (error) throw error;
      toast.success('Report sent to recipients');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send report');
    } finally {
      setSendingReport(null);
    }
  };

  const getScheduleDescription = (report: Report) => {
    if (!report.is_scheduled) return null;
    
    const freq = report.schedule_frequency;
    const day = report.schedule_day;
    const time = report.schedule_time?.slice(0, 5) || '09:00';
    
    if (freq === 'daily') return `Daily at ${time}`;
    if (freq === 'weekly') return `${DAYS_OF_WEEK[day ?? 0] || 'Day'} at ${time}`;
    if (freq === 'monthly') return `${day ?? 1}${getOrdinalSuffix(day ?? 1)} of month at ${time}`;
    return null;
  };

  const getOrdinalSuffix = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  const getReportTypeConfig = (type: string) => {
    return {
      ...(REPORT_TYPE_CONFIG[type] || REPORT_TYPE_CONFIG.custom),
      ...getAgentAwareSavedReportTypeDefinition(aiAgentType, (type as SavedReportType) || 'custom'),
    };
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-background via-primary/5 to-background shadow-sm">
        <CardContent className="p-4 md:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">Saved reports</Badge>
                <Badge variant="outline" className="text-muted-foreground">{stats.total} total</Badge>
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">Create repeatable reporting workflows</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Save the report views your team reuses most, then schedule them for email delivery or send them on demand.
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-3xl border border-border/60 bg-background/85 p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Quick Actions</p>
              <Button onClick={() => setShowCreateDialog(true)} className="w-full justify-start rounded-2xl">
                <Plus className="w-4 h-4 mr-2" />
                New report
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start rounded-2xl"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn('w-4 h-4 mr-2', isRefreshing && 'animate-spin')} />
                Refresh reports
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      {!isLoading && reports.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Reports</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <FileText className="w-8 h-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-success/5 to-success/10 border-success/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Scheduled</p>
                  <p className="text-2xl font-bold text-success">{stats.scheduled}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-success/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-muted/50 to-muted border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Unscheduled</p>
                  <p className="text-2xl font-bold">{stats.unscheduled}</p>
                </div>
                <XCircle className="w-8 h-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search & Filters */}
      {!isLoading && reports.length > 0 && (
        <Card className="border-border/60 bg-muted/10 shadow-none">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filterOption} onValueChange={(v: FilterOption) => setFilterOption(v)}>
              <SelectTrigger className="w-[140px] rounded-xl">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reports</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="unscheduled">Unscheduled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOption} onValueChange={(v: SortOption) => setSortOption(v)}>
              <SelectTrigger className="w-[130px] rounded-xl">
                {sortOption === 'oldest' ? <SortAsc className="w-4 h-4 mr-2" /> : <SortDesc className="w-4 h-4 mr-2" />}
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="type">Type</SelectItem>
              </SelectContent>
            </Select>
          </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="glass">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/3" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <Card className="glass">
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">
              {reports.length === 0 ? 'No Saved Reports' : 'No Reports Found'}
            </h3>
            <p className="text-muted-foreground mt-1 mb-4">
              {reports.length === 0 
                ? 'Create your first report to start tracking metrics'
                : 'Try adjusting your search or filters'
              }
            </p>
            {reports.length === 0 && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Report
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredReports.map((report) => {
            const typeConfig = getReportTypeConfig(report.report_type);
            const TypeIcon = typeConfig.icon;
            
            return (
              <Card key={report.id} className="glass hover:shadow-lg transition-all hover:border-primary/30">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", typeConfig.bgColor)}>
                        <TypeIcon className={cn("w-5 h-5", typeConfig.color)} />
                      </div>
                      <div className="space-y-1 flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{report.name}</CardTitle>
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", typeConfig.color)}
                        >
                          {typeConfig.label}
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border shadow-lg">
                        <DropdownMenuItem onClick={() => handlePreviewReport(report)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleScheduleReport(report)}>
                          <Calendar className="w-4 h-4 mr-2" />
                          Schedule
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleSendNow(report)}
                          disabled={!report.recipient_emails?.length}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Send Now
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateReport(report)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => setDeleteConfirmId(report.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {report.description}
                    </p>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      {report.is_scheduled ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-success" />
                          <span className="text-success font-medium">Scheduled</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Not scheduled</span>
                        </>
                      )}
                    </div>
                    
                    {report.is_scheduled && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {getScheduleDescription(report)}
                      </div>
                    )}
                    
                    {report.recipient_emails && report.recipient_emails.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        {report.recipient_emails.length} recipient{report.recipient_emails.length !== 1 && 's'}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {report.last_sent_at && (
                        <span>Sent {formatDistanceToNow(new Date(report.last_sent_at), { addSuffix: true })}</span>
                      )}
                      <span>Updated {formatDistanceToNow(new Date(report.updated_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleScheduleReport(report)}
                    >
                      <Settings className="w-3 h-3 mr-1" />
                      Configure
                    </Button>
                    {report.is_scheduled && report.recipient_emails?.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => handleSendNow(report)}
                            disabled={sendingReport === report.id}
                          >
                            {sendingReport === report.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Send now</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Report Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              Create New Report
            </DialogTitle>
            <DialogDescription>
              Start from a report type your team will actually reuse, then refine the schedule and recipients afterward.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Report Name</Label>
              <Input 
                placeholder="e.g., Weekly Lead Summary"
                value={newReportName}
                onChange={(e) => setNewReportName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                placeholder="What does this report track?"
                value={newReportDesc}
                onChange={(e) => setNewReportDesc(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Report Type</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {availableReportTypes.map((key) => {
                  const config = getReportTypeConfig(key);
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setNewReportType(key)}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-xl border text-left transition-all",
                        newReportType === key 
                          ? "border-primary bg-primary/5 ring-1 ring-primary" 
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", config.bgColor)}>
                        <Icon className={cn("w-4 h-4", config.color)} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{config.label}</p>
                          {newReportType === key && <Badge className="shrink-0">Selected</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{config.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateReport} disabled={createReport.isPending}>
              {createReport.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Report Preview
            </DialogTitle>
            <DialogDescription>
              Preview of what this report will include
            </DialogDescription>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-3">
                {(() => {
                  const config = getReportTypeConfig(selectedReport.report_type);
                  const Icon = config.icon;
                  return (
                    <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", config.bgColor)}>
                      <Icon className={cn("w-6 h-6", config.color)} />
                    </div>
                  );
                })()}
                <div>
                  <h3 className="text-lg font-semibold">{selectedReport.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedReport.description || 'No description'}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <Badge variant="outline">{getReportTypeConfig(selectedReport.report_type).label}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date Range</span>
                      <span>{((selectedReport.config || {}) as { date_range?: string }).date_range || 'Last 30 days'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Metrics</span>
                      <span>{((selectedReport.config || {}) as { included_metrics?: string[] }).included_metrics?.length || 0} selected</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Charts</span>
                      <span>{((selectedReport.config || {}) as { included_charts?: string[] }).included_charts?.length || 0} selected</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Schedule</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      {selectedReport.is_scheduled ? (
                        <Badge className="bg-success/20 text-success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    {selectedReport.is_scheduled && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Frequency</span>
                          <span className="capitalize">{selectedReport.schedule_frequency}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Time</span>
                          <span>{selectedReport.schedule_time?.slice(0, 5) || '09:00'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Recipients</span>
                          <span>{selectedReport.recipient_emails?.length || 0}</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {selectedReport.recipient_emails?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Recipients</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedReport.recipient_emails.map((email: string) => (
                        <Badge key={email} variant="secondary">{email}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowPreviewDialog(false);
              if (selectedReport) {
                handleScheduleReport(selectedReport);
              }
            }}>
              <Settings className="w-4 h-4 mr-2" />
              Configure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <ScheduleReportDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        report={selectedReport}
        onSave={handleSaveSchedule}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="Delete Report"
        description="Are you sure you want to delete this report? It will remain recoverable from Deleted Items for 5 hours, then it will be permanently removed."
        confirmLabel="Delete"
        onConfirm={handleDeleteReport}
        variant="destructive"
      />
    </div>
  );
}
