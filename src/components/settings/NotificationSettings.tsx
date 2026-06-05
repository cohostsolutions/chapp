import { useNotificationPreferences, NotificationPriority, DeliveryPreference, QuietWindow } from '@/hooks/useNotificationPreferences';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { 
  Bell, Mail, MessageSquare, Phone, MessageCircle, Volume2, Monitor, 
  AlertCircle, Users, ShoppingBag, Calendar, Moon, Sun,
  UserCheck, Bot, Shield, Building2, Activity, BookOpen, Smartphone,
  Clock, BellOff, Layers, DollarSign, Zap, Settings2, Plus, Trash2
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';
import { useCurrencySymbol } from '@/hooks/useMultiCurrency';

// Org-type specific labels
const orgTypeConfig = {
  jay: { primary: 'Lead', primaryPlural: 'Leads', icon: Users, color: 'text-blue-500' },
  may: { primary: 'Order', primaryPlural: 'Orders', icon: ShoppingBag, color: 'text-green-500' },
  cece: { primary: 'Booking', primaryPlural: 'Bookings', icon: Calendar, color: 'text-purple-500' },
};

// Notification type definitions for UI
const notificationTypes = {
  agent: [
    { key: 'lead_assignment', label: 'New Assignments', description: 'When assigned to you', icon: Users },
    { key: 'lead_status_change', label: 'Status Changes', description: 'When status updates', icon: Activity },
    { key: 'new_message', label: 'New Messages', description: 'Inbound communications', icon: MessageSquare },
    { key: 'training_reminder', label: 'Training', description: 'New modules available', icon: BookOpen },
  ],
  admin: [
    { key: 'new_business', label: 'New Business', description: 'New leads/orders/bookings', icon: Zap },
    { key: 'agent_takeover', label: 'Agent Takeover', description: 'AI needs human help', icon: UserCheck },
    { key: 'agent_handback', label: 'Handback', description: 'Returned to AI', icon: Bot },
    { key: 'agent_performance', label: 'Performance', description: 'Low scores, issues', icon: Activity },
    { key: 'daily_summary', label: 'Daily Summary', description: 'Daily activity digest', icon: Mail },
  ],
  superadmin: [
    { key: 'cross_org_alert', label: 'Cross-Org Alerts', description: 'Multi-org issues', icon: Building2 },
    { key: 'new_organization', label: 'New Orgs', description: 'Org creation', icon: Building2 },
    { key: 'security_alert', label: 'Security', description: 'Failed logins, threats', icon: Shield },
    { key: 'system_health', label: 'System Health', description: 'Webhooks, APIs', icon: AlertCircle },
  ],
};

const priorityColors: Record<NotificationPriority, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-400',
};

const soundLabels = {
  urgent: 'Urgent (loud)',
  default: 'Default',
  soft: 'Soft',
  silent: 'Silent',
};

export function NotificationSettings() {
  const currencySymbol = useCurrencySymbol();
  const { 
    preferences, isLoading, updatePreferences, isUpdating,
    snoozeNotifications, unsnoozeNotifications, updateDeliveryPreference,
    isSnoozed, snoozeRemaining
  } = useNotificationPreferences();
  const { isSuperAdmin, effectiveIsClientAdmin, effectiveIsAgent, orgFeatures } = useAuth();
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  const [newQuietWindow, setNewQuietWindow] = useState<Partial<QuietWindow>>({
    name: '',
    start: '22:00',
    end: '08:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    enabled: true,
  });

  // Determine org type and role
  const orgTypeData = orgFeatures as unknown as { ai_agent_type?: string } | null;
  const orgType = (orgTypeData?.ai_agent_type || 'cece') as keyof typeof orgTypeConfig;
  const config = orgTypeConfig[orgType] || orgTypeConfig.cece;

  // Determine what settings to show based on effective role
  const showAgentSettings = effectiveIsAgent || effectiveIsClientAdmin || isSuperAdmin;
  const showAdminSettings = effectiveIsClientAdmin || isSuperAdmin;
  const showSuperAdminSettings = isSuperAdmin && !effectiveIsClientAdmin && !effectiveIsAgent;

  // Get relevant notification types for current role
  const relevantTypes = [
    ...(showAgentSettings ? notificationTypes.agent : []),
    ...(showAdminSettings ? notificationTypes.admin : []),
    ...(showSuperAdminSettings ? notificationTypes.superadmin : []),
  ];

  useEffect(() => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  const requestBrowserPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      
      if (permission === 'granted' && preferences) {
        updatePreferences({ browser_notifications_enabled: true });
      }
    }
  };

  const handleAddQuietWindow = () => {
    if (!preferences || !newQuietWindow.name) return;
    
    const window: QuietWindow = {
      id: crypto.randomUUID(),
      name: newQuietWindow.name || 'Quiet Period',
      start: newQuietWindow.start || '22:00',
      end: newQuietWindow.end || '08:00',
      days: newQuietWindow.days || [0, 1, 2, 3, 4, 5, 6],
      enabled: true,
    };
    
    updatePreferences({
      quiet_windows: [...preferences.quiet_windows, window],
    });
    
    setNewQuietWindow({
      name: '',
      start: '22:00',
      end: '08:00',
      days: [0, 1, 2, 3, 4, 5, 6],
      enabled: true,
    });
  };

  const handleRemoveQuietWindow = (id: string) => {
    if (!preferences) return;
    updatePreferences({
      quiet_windows: preferences.quiet_windows.filter(w => w.id !== id),
    });
  };

  const handleToggleQuietWindow = (id: string) => {
    if (!preferences) return;
    updatePreferences({
      quiet_windows: preferences.quiet_windows.map(w => 
        w.id === id ? { ...w, enabled: !w.enabled } : w
      ),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!preferences) return null;

  return (
    <div className="space-y-6">
      {/* Snooze Banner */}
      {isSnoozed && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BellOff className="h-5 w-5 text-amber-600" />
                <div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200">Notifications Snoozed</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {snoozeRemaining > 0 ? `${snoozeRemaining} minutes remaining` : 'Snoozed indefinitely'}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => unsnoozeNotifications()}>
                Resume
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">Quick Actions</h3>
              <p className="text-sm text-muted-foreground">
                {browserPermission === 'granted' ? 'Notifications active' : 'Browser notifications disabled'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={browserPermission === 'granted' ? 'default' : 'secondary'}>
                {browserPermission === 'granted' ? 'Active' : 'Inactive'}
              </Badge>
              {browserPermission === 'default' && (
                <Button size="sm" onClick={requestBrowserPermission}>
                  Enable
                </Button>
              )}
              {!isSnoozed && (
                <Select onValueChange={(value) => snoozeNotifications(parseInt(value))}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Snooze" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="480">8 hours</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Settings */}
      <Tabs defaultValue="events" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="events" className="flex items-center gap-1">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Events</span>
          </TabsTrigger>
          <TabsTrigger value="delivery" className="flex items-center gap-1">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Delivery</span>
          </TabsTrigger>
          <TabsTrigger value="timing" className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Timing</span>
          </TabsTrigger>
          <TabsTrigger value="advanced" className="flex items-center gap-1">
            <Layers className="h-4 w-4" />
            <span className="hidden sm:inline">Advanced</span>
          </TabsTrigger>
        </TabsList>

        {/* Events Tab - Per-notification settings */}
        <TabsContent value="events" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Events</CardTitle>
              <CardDescription>
                Configure how each notification type is delivered
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {relevantTypes.map((type) => {
                const Icon = type.icon;
                const deliveryPref = preferences.delivery_preferences[type.key] || {
                  browser: true, email: false, sound: true, priority: 'medium' as NotificationPriority
                };
                
                return (
                  <div key={type.key} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <Label className="text-base">{type.label}</Label>
                          <p className="text-xs text-muted-foreground">{type.description}</p>
                        </div>
                      </div>
                      <div className={`h-3 w-3 rounded-full ${priorityColors[deliveryPref.priority]}`} />
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`${type.key}-browser`}
                          checked={deliveryPref.browser}
                          onCheckedChange={(checked) => 
                            updateDeliveryPreference({ type: type.key, updates: { browser: checked } })
                          }
                        />
                        <Label htmlFor={`${type.key}-browser`} className="text-xs flex items-center gap-1">
                          <Monitor className="h-3 w-3" /> Browser
                        </Label>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`${type.key}-email`}
                          checked={deliveryPref.email}
                          onCheckedChange={(checked) => 
                            updateDeliveryPreference({ type: type.key, updates: { email: checked } })
                          }
                        />
                        <Label htmlFor={`${type.key}-email`} className="text-xs flex items-center gap-1">
                          <Mail className="h-3 w-3" /> Email
                        </Label>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`${type.key}-sound`}
                          checked={deliveryPref.sound}
                          onCheckedChange={(checked) => 
                            updateDeliveryPreference({ type: type.key, updates: { sound: checked } })
                          }
                        />
                        <Label htmlFor={`${type.key}-sound`} className="text-xs flex items-center gap-1">
                          <Volume2 className="h-3 w-3" /> Sound
                        </Label>
                      </div>
                      
                      <Select
                        value={deliveryPref.priority}
                        onValueChange={(value: NotificationPriority) => 
                          updateDeliveryPreference({ type: type.key, updates: { priority: value } })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Delivery Tab - Methods and channels */}
        <TabsContent value="delivery" className="space-y-4 mt-4">
          {/* Device Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Device Preferences
              </CardTitle>
              <CardDescription>Control notifications per device type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label>Desktop Notifications</Label>
                    <p className="text-xs text-muted-foreground">Browser and desktop alerts</p>
                  </div>
                </div>
                <Switch
                  checked={preferences.desktop_enabled}
                  onCheckedChange={(checked) => updatePreferences({ desktop_enabled: checked })}
                  disabled={isUpdating}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label>Mobile Web Notifications</Label>
                    <p className="text-xs text-muted-foreground">In-app mobile alerts</p>
                  </div>
                </div>
                <Switch
                  checked={preferences.mobile_enabled}
                  onCheckedChange={(checked) => updatePreferences({ mobile_enabled: checked })}
                  disabled={isUpdating}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label>Mobile Push Notifications</Label>
                    <p className="text-xs text-muted-foreground">Push notifications to mobile device</p>
                  </div>
                </div>
                <Switch
                  checked={preferences.mobile_push_enabled}
                  onCheckedChange={(checked) => updatePreferences({ mobile_push_enabled: checked })}
                  disabled={isUpdating}
                />
              </div>
            </CardContent>
          </Card>

          {/* Notification Grouping */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Notification Grouping
              </CardTitle>
              <CardDescription>Bundle similar notifications together</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Grouping</Label>
                  <p className="text-xs text-muted-foreground">Group similar notifications instead of individual alerts</p>
                </div>
                <Switch
                  checked={preferences.grouping_enabled}
                  onCheckedChange={(checked) => updatePreferences({ grouping_enabled: checked })}
                  disabled={isUpdating}
                />
              </div>
              
              {preferences.grouping_enabled && (
                <div className="space-y-2">
                  <Label>Grouping Interval: {preferences.grouping_interval_minutes} minutes</Label>
                  <Slider
                    value={[preferences.grouping_interval_minutes]}
                    onValueChange={([value]) => updatePreferences({ grouping_interval_minutes: value })}
                    min={1}
                    max={30}
                    step={1}
                    disabled={isUpdating}
                  />
                  <p className="text-xs text-muted-foreground">
                    Notifications within this window will be grouped together
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Custom Sounds */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Notification Sounds
              </CardTitle>
              <CardDescription>Choose sounds for each priority level</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(['critical', 'high', 'medium', 'low'] as NotificationPriority[]).map((priority) => (
                <div key={priority} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${priorityColors[priority]}`} />
                    <Label className="capitalize">{priority} Priority</Label>
                  </div>
                  <Select
                    value={preferences.custom_sounds[priority]}
                    onValueChange={(value) => 
                      updatePreferences({
                        custom_sounds: { ...preferences.custom_sounds, [priority]: value }
                      })
                    }
                    disabled={isUpdating}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(soundLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Communication Channels */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Communication Channels
              </CardTitle>
              <CardDescription>Which message types trigger notifications</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={preferences.sms_enabled}
                  onCheckedChange={(checked) => updatePreferences({ sms_enabled: checked })}
                  disabled={isUpdating}
                />
                <Label className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" /> SMS
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={preferences.email_enabled}
                  onCheckedChange={(checked) => updatePreferences({ email_enabled: checked })}
                  disabled={isUpdating}
                />
                <Label className="flex items-center gap-1">
                  <Mail className="h-4 w-4" /> Email
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={preferences.call_enabled}
                  onCheckedChange={(checked) => updatePreferences({ call_enabled: checked })}
                  disabled={isUpdating}
                />
                <Label className="flex items-center gap-1">
                  <Phone className="h-4 w-4" /> Calls
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={preferences.whatsapp_enabled}
                  onCheckedChange={(checked) => updatePreferences({ whatsapp_enabled: checked })}
                  disabled={isUpdating}
                />
                <Label className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timing Tab */}
        <TabsContent value="timing" className="space-y-4 mt-4">
          {/* Simple Quiet Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Moon className="h-5 w-5" />
                Quick Quiet Hours
              </CardTitle>
              <CardDescription>Simple daily quiet period</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Daily Quiet Hours</Label>
                <Switch
                  checked={preferences.quiet_hours_enabled}
                  onCheckedChange={(checked) => updatePreferences({ quiet_hours_enabled: checked })}
                  disabled={isUpdating}
                />
              </div>
              
              {preferences.quiet_hours_enabled && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Moon className="h-3 w-3" /> Start
                    </Label>
                    <Select
                      value={preferences.quiet_hours_start?.slice(0, 5) || '22:00'}
                      onValueChange={(value) => updatePreferences({ quiet_hours_start: value })}
                      disabled={isUpdating}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={`${i.toString().padStart(2, '0')}:00`}>
                            {i.toString().padStart(2, '0')}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Sun className="h-3 w-3" /> End
                    </Label>
                    <Select
                      value={preferences.quiet_hours_end?.slice(0, 5) || '08:00'}
                      onValueChange={(value) => updatePreferences({ quiet_hours_end: value })}
                      disabled={isUpdating}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={`${i.toString().padStart(2, '0')}:00`}>
                            {i.toString().padStart(2, '0')}:00
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Multiple Quiet Windows */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Custom Quiet Windows
              </CardTitle>
              <CardDescription>Add multiple custom quiet periods</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Existing windows */}
              {preferences.quiet_windows.map((window) => (
                <div key={window.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={window.enabled}
                      onCheckedChange={() => handleToggleQuietWindow(window.id)}
                    />
                    <div>
                      <p className="font-medium text-sm">{window.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {window.start} - {window.end}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveQuietWindow(window.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              
              {/* Add new window */}
              <Separator />
              <div className="space-y-3">
                <Label>Add New Quiet Window</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Name (e.g., Lunch)"
                    value={newQuietWindow.name}
                    onChange={(e) => setNewQuietWindow({ ...newQuietWindow, name: e.target.value })}
                  />
                  <Select
                    value={newQuietWindow.start}
                    onValueChange={(value) => setNewQuietWindow({ ...newQuietWindow, start: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Start" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={`${i.toString().padStart(2, '0')}:00`}>
                          {i.toString().padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={newQuietWindow.end}
                    onValueChange={(value) => setNewQuietWindow({ ...newQuietWindow, end: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="End" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={`${i.toString().padStart(2, '0')}:00`}>
                          {i.toString().padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddQuietWindow}
                  disabled={!newQuietWindow.name}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Window
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Priority Bypass */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Priority Bypass
              </CardTitle>
              <CardDescription>Which priorities can interrupt quiet hours</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(['critical', 'high', 'medium', 'low'] as NotificationPriority[]).map((priority) => (
                <div key={priority} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${priorityColors[priority]}`} />
                    <Label className="capitalize">{priority}</Label>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={preferences.custom_priorities[priority]?.bypass_quiet ?? false}
                        onCheckedChange={(checked) => 
                          updatePreferences({
                            custom_priorities: {
                              ...preferences.custom_priorities,
                              [priority]: { ...preferences.custom_priorities[priority], bypass_quiet: checked }
                            }
                          })
                        }
                        disabled={isUpdating}
                      />
                      <span className="text-xs text-muted-foreground">Bypass quiet</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={preferences.custom_priorities[priority]?.force_sound ?? false}
                        onCheckedChange={(checked) => 
                          updatePreferences({
                            custom_priorities: {
                              ...preferences.custom_priorities,
                              [priority]: { ...preferences.custom_priorities[priority], force_sound: checked }
                            }
                          })
                        }
                        disabled={isUpdating}
                      />
                      <span className="text-xs text-muted-foreground">Force sound</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-4 mt-4">
          {/* Value-based Alerts */}
          {(showAdminSettings && orgType === 'cece') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Value-based Alerts
                </CardTitle>
                <CardDescription>Only notify for high-value transactions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Enable Value Filtering</Label>
                  <Switch
                    checked={preferences.value_alerts_enabled}
                    onCheckedChange={(checked) => updatePreferences({ value_alerts_enabled: checked })}
                    disabled={isUpdating}
                  />
                </div>
                
                {preferences.value_alerts_enabled && (
                  <>
                    {orgType === 'cece' && (
                      <div className="space-y-2">
                        <Label>Minimum Booking Value ({currencySymbol})</Label>
                        <Input
                          type="number"
                          value={preferences.min_booking_value}
                          onChange={(e) => updatePreferences({ min_booking_value: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                          disabled={isUpdating}
                        />
                        <p className="text-xs text-muted-foreground">
                          Only notify for bookings above this value
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Email Digest */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Digest
              </CardTitle>
              <CardDescription>Receive email summaries of notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Email Digest</Label>
                <Switch
                  checked={preferences.email_notifications_enabled}
                  onCheckedChange={(checked) => updatePreferences({ email_notifications_enabled: checked })}
                  disabled={isUpdating}
                />
              </div>
              
              {preferences.email_notifications_enabled && (
                <div className="space-y-2">
                  <Label>Digest Frequency</Label>
                  <Select
                    value={preferences.digest_frequency}
                    onValueChange={(value) => updatePreferences({ digest_frequency: value })}
                    disabled={isUpdating}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="realtime">Real-time (each notification)</SelectItem>
                      <SelectItem value="hourly">Hourly summary</SelectItem>
                      <SelectItem value="daily">Daily summary</SelectItem>
                      <SelectItem value="weekly">Weekly summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Global Sound Toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Global Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Master Sound Toggle</Label>
                  <p className="text-xs text-muted-foreground">Disable all notification sounds</p>
                </div>
                <Switch
                  checked={preferences.sound_enabled}
                  onCheckedChange={(checked) => updatePreferences({ sound_enabled: checked })}
                  disabled={isUpdating}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Browser Notifications</Label>
                  <p className="text-xs text-muted-foreground">Master toggle for all browser notifications</p>
                </div>
                <Switch
                  checked={preferences.browser_notifications_enabled}
                  onCheckedChange={(checked) => updatePreferences({ browser_notifications_enabled: checked })}
                  disabled={isUpdating || browserPermission !== 'granted'}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button size="lg" disabled={isUpdating}>
          {isUpdating ? 'Saving...' : 'Save All Preferences'}
        </Button>
      </div>
    </div>
  );
}
