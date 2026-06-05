import { useState, useEffect, useMemo } from 'react';
import { devError } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  User, Bell, Shield, Key, Calendar, Loader2, CheckCircle, AlertCircle, 
  ExternalLink, Unlink, ArrowLeft, Building2, Eye, EyeOff, ChevronDown, 
  PlayCircle, Smartphone, Search, Settings2, Palette, Lock, Activity,
  LogOut, AlertTriangle, Clock, Mail, Camera, Trash2, RefreshCw, HelpCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { AgentPriorityConfig } from '@/components/AgentPriorityConfig';
import { AuditLogViewer } from '@/components/settings/AuditLogViewer';
import { SecretRotationTracker } from '@/components/settings/SecretRotationTracker';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { ActiveSessionsCard } from '@/components/settings/sessions/ActiveSessionsCard';
import { TwoFactorAuth } from '@/components/settings/TwoFactorAuth';
import { PWAInstallGuide } from '@/components/pwa/PWAInstallGuide';
import { supabase } from '@/integrations/supabase/client';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useOnboardingTour, useResetTour } from '@/components/onboarding/OnboardingTour';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { UserManagementTab } from '@/components/settings/UserManagementTab';
import { DeletedItemsTab } from '@/components/settings/DeletedItemsTab';
import { SocialPlatformsTab } from '@/components/settings/SocialPlatformsTab';
import { UserCog } from 'lucide-react';

// Tab configuration
const SETTINGS_TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'users', label: 'Users', icon: UserCog },
  { id: 'integrations', label: 'Integrations', icon: Key },
  { id: 'display', label: 'Display', icon: Palette },
  { id: 'deleted', label: 'Deleted Items', icon: Trash2 },
  { id: 'advanced', label: 'Advanced', icon: Settings2 },
];

const DEFAULT_SETTINGS_TAB = 'profile';

function SettingsContent() {
  const { profile, isSuperAdmin, isClientAdmin, impersonatedRole, setImpersonatedRole, effectiveIsSuperAdmin, effectiveIsClientAdmin, orgFeatures, signOut, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { checkConnection, initiateOAuth, exchangeCode, disconnect, isLoading: calendarLoading, error: calendarError } = useGoogleCalendar();
  const { startTour } = useOnboardingTour();
  const resetTour = useResetTour();
  
  const [activeTab, setActiveTab] = useState(DEFAULT_SETTINGS_TAB);
  const [searchQuery, setSearchQuery] = useState('');
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [calendarStatus, setCalendarStatus] = useState<{
    connected: boolean;
    message?: string;
    setup_required?: boolean;
  } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentOrg, setCurrentOrg] = useState<{ name: string, ai_agent_type: string } | null>(null);
  const [isReturning, setIsReturning] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  
  // Profile edit state
  const [fullName, setFullName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(true);
  const [isRecoveringMessages, setIsRecoveringMessages] = useState(false);
  const [recoveryResult, setRecoveryResult] = useState<{ success: boolean; messages_recovered?: number; errors?: string[] } | null>(null);
  // Phone manager state
  const [orgPhoneCount, setOrgPhoneCount] = useState<number | null>(null);
  const [twilioEnabled, setTwilioEnabled] = useState<boolean>(false);
  const [isSearchingNumbers, setIsSearchingNumbers] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<Array<{ phone_number: string; friendly_name?: string; price_display?: string; free_eligible?: boolean }> | null>(null);
  const [selectedAreaCode, setSelectedAreaCode] = useState<string>("");
  const [isBuyingNumber, setIsBuyingNumber] = useState(false);
  const [showSocialIntegrations, setShowSocialIntegrations] = useState(true);
  const [showTwilioSection, setShowTwilioSection] = useState(false);
  const [showAdvancedIntegrationTools, setShowAdvancedIntegrationTools] = useState(false);
  const [showGooglePermissions, setShowGooglePermissions] = useState(false);

  // Initialize profile data
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setAvatarUrl(profile.avatar_url || null);
      setIsPageLoading(false);
    }
  }, [profile]);

  const handleReplayTour = () => {
    resetTour();
    navigate('/dashboard');
    setTimeout(() => {
      startTour();
    }, 500);
  };

  useEffect(() => {
    if (profile?.organization_id) {
      supabase
        .from('organizations')
        .select('name, ai_agent_type, twilio_enabled')
        .eq('id', profile.organization_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setCurrentOrg(data);
            setTwilioEnabled(data.twilio_enabled || false);
          }
        });

      // Fetch phone number count for Phone Manager UI
      supabase
        .from('phone_numbers')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .eq('is_active', true)
        .then(({ count }) => setOrgPhoneCount(count ?? 0));
    } else {
      setCurrentOrg(null);
      setOrgPhoneCount(null);
      setTwilioEnabled(false);
    }
  }, [profile?.organization_id]);

  const handleReturnToSuperAdmin = async () => {
    if (!profile) return;
    
    setIsReturning(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ organization_id: null })
        .eq('id', profile.id);

      if (error) throw error;

      await setImpersonatedRole(null);

      toast({
        title: "Returned to Super Admin View",
        description: "You are now viewing as Super Admin again.",
      });

      navigate('/organizations');
      window.location.reload();
    } catch (error) {
      devError('Error returning to super admin:', error);
      toast({
        title: "Error",
        description: "Failed to return to Super Admin view",
        variant: "destructive",
      });
    } finally {
      setIsReturning(false);
    }
  };

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    if (code && (effectiveIsSuperAdmin || effectiveIsClientAdmin)) {
      setIsConnecting(true);
      exchangeCode(code, '/settings').then((success) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('code');
        if (!nextParams.get('tab')) {
          nextParams.set('tab', 'integrations');
        }
        setSearchParams(nextParams, { replace: true });
        setIsConnecting(false);
        
        if (success) {
          toast({
            title: "Google Connected",
            description: "Your Google account has been connected successfully."
          });
          checkConnection().then(setCalendarStatus);
        } else {
          toast({
            title: "Connection Failed",
            description: calendarError || "Failed to connect to Google. Please try again.",
            variant: "destructive"
          });
        }
      });
    }
  }, [searchParams, effectiveIsSuperAdmin, effectiveIsClientAdmin, exchangeCode, calendarError, checkConnection, setSearchParams, toast]);

  // Check connection status on mount
  useEffect(() => {
    if ((effectiveIsSuperAdmin || effectiveIsClientAdmin) && !searchParams.get('code')) {
      checkConnection().then(setCalendarStatus);
    }
  }, [effectiveIsSuperAdmin, effectiveIsClientAdmin, checkConnection]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    
    setIsSavingProfile(true);
    try {
      const normalizedFullName = fullName.trim();
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: normalizedFullName })
        .eq('id', profile.id);

      if (error) throw error;

      setFullName(normalizedFullName);
      await refreshProfile();

      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully."
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to update profile";
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please select an image file.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image smaller than 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingPhoto(true);
    try {
      // Delete old avatar if exists
      if (profile.avatar_url) {
        const oldPath = profile.avatar_url.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('avatars').remove([`${profile.id}/${oldPath}`]);
        }
      }

      // Upload new avatar
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${profile.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      await refreshProfile();
      toast({
        title: 'Photo updated',
        description: 'Your profile photo has been updated successfully.',
      });
    } catch (error) {
      devError('Error uploading photo:', error);
      toast({
        title: 'Upload failed',
        description: 'Could not upload your photo. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleConnectCalendar = async () => {
    setIsConnecting(true);
    const authUrl = await initiateOAuth();
    if (authUrl) {
      window.location.href = authUrl;
    } else {
      setIsConnecting(false);
      toast({
        title: "Connection Error",
        description: calendarError || "Failed to initiate Google connection.",
        variant: "destructive"
      });
    }
  };

  const handleDisconnectCalendar = async () => {
    const success = await disconnect();
    if (success) {
      setCalendarStatus({ connected: false, message: 'Disconnected from Google' });
      toast({
        title: "Google Disconnected",
        description: "Your Google account has been disconnected."
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to disconnect calendar.",
        variant: "destructive"
      });
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }
    
    setIsChangingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('change-password', {
        body: { currentPassword, newPassword }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast({
        title: "Password Updated",
        description: "Your password has been changed successfully.",
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to change password";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogoutAllSessions = async () => {
    setIsLoggingOutAll(true);
    try {
      await signOut();
      toast({
        title: "Signed Out",
        description: "You have been signed out from all sessions.",
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to sign out";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoggingOutAll(false);
    }
  };

  const handleRecoverMessages = async () => {
    setIsRecoveringMessages(true);
    setRecoveryResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-facebook-messages', {
        body: {}
      });
      
      if (error) throw error;
      
      setRecoveryResult(data);
      toast({
        title: data.success ? "Messages Recovered" : "Recovery Issue",
        description: data.success 
          ? `Recovered ${data.messages_recovered} messages from ${data.senders_checked} conversations.` 
          : "Some messages could not be recovered.",
        variant: data.success ? "default" : "destructive"
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to recover messages";
      setRecoveryResult({ success: false, errors: [message] });
      toast({
        title: "Recovery Failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsRecoveringMessages(false);
    }
  };

  // Fetch extended profile data
  const [extendedProfile, setExtendedProfile] = useState<{
    created_at: string;
    totp_enabled: boolean;
  } | null>(null);

  useEffect(() => {
    if (profile?.id) {
      supabase
        .from('profiles')
        .select('created_at, totp_enabled')
        .eq('id', profile.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setExtendedProfile({
              created_at: data.created_at,
              totp_enabled: data.totp_enabled || false,
            });
          }
        });
    }
  }, [profile?.id]);

  // Compute account stats
  const accountStats = useMemo(() => {
    if (!profile || !extendedProfile) return null;
    
    const createdAt = new Date(extendedProfile.created_at);
    const accountAge = formatDistanceToNow(createdAt, { addSuffix: false });
    
    return {
      accountAge,
      memberSince: format(createdAt, 'MMMM yyyy'),
      totpEnabled: extendedProfile.totp_enabled,
      email: profile.email,
    };
  }, [profile, extendedProfile]);

  // Filter tabs based on search
  const filteredTabs = useMemo(() => {
    if (!searchQuery) return SETTINGS_TABS;
    return SETTINGS_TABS.filter(tab => 
      tab.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  // Get visible tabs based on role
  const visibleTabs = useMemo(() => {
    return filteredTabs.filter(tab => {
      // Advanced tab only for super admin
      if (tab.id === 'advanced' && !effectiveIsSuperAdmin) return false;
      
      // Integrations tab: Hide only for agent users (not for client admins or super admins)
      if (tab.id === 'integrations') {
        // Show for super admin and client admin only
        if (!effectiveIsSuperAdmin && !effectiveIsClientAdmin) return false;
      }
      
      // Users tabs for admins only
      if (tab.id === 'users' && !effectiveIsSuperAdmin && !effectiveIsClientAdmin) return false;
      
      return true;
    });
  }, [filteredTabs, effectiveIsSuperAdmin, effectiveIsClientAdmin, currentOrg]);

  useEffect(() => {
    const requestedTab = searchParams.get('tab') || DEFAULT_SETTINGS_TAB;
    const resolvedTab = visibleTabs.some((tab) => tab.id === requestedTab)
      ? requestedTab
      : visibleTabs[0]?.id || DEFAULT_SETTINGS_TAB;

    if (resolvedTab !== activeTab) {
      setActiveTab(resolvedTab);
    }

    if (searchParams.get('tab') !== resolvedTab) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', resolvedTab);
      setSearchParams(nextParams, { replace: true });
    }
  }, [activeTab, searchParams, setSearchParams, visibleTabs]);

  const handleTabChange = (nextTab: string) => {
    setActiveTab(nextTab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', nextTab);
    setSearchParams(nextParams, { replace: true });
  };

  if (isPageLoading) {
    return (
      <div className="space-y-6 animate-fade-in w-full">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-10 w-28" />
          ))}
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in w-full" data-tour="settings-content">
      {/* Header with Search and Help */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-primary" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">Manage your account, preferences, and integrations</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search settings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleReplayTour}
            title="View product tour"
            className="h-10 w-10"
          >
            <HelpCircle className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Quick Account Summary */}
      {accountStats && (
        <Card className="glass border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-14 h-14 border-2 border-primary/30">
                <AvatarImage src={avatarUrl || undefined} />
                <AvatarFallback className="bg-primary/20 text-primary font-semibold text-lg">
                  {profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-foreground truncate">{profile?.full_name || 'User'}</h2>
                <p className="text-sm text-muted-foreground truncate">{profile?.email}</p>
              </div>
              <div className="hidden sm:flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Member for</p>
                  <p className="font-medium text-foreground">{accountStats.accountAge}</p>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">2FA Status</p>
                  <Badge variant={accountStats.totpEnabled ? 'default' : 'outline'} className="mt-0.5">
                    {accountStats.totpEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                {currentOrg && (
                  <>
                    <Separator orientation="vertical" className="h-8" />
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Organization</p>
                      <p className="font-medium text-foreground truncate max-w-32">{currentOrg.name}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Return to Super Admin View - Shows when super admin is impersonating */}
      {isSuperAdmin && impersonatedRole && currentOrg && (
        <Card className="glass border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/20">
                  <Building2 className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    Currently viewing: <span className="text-warning">{currentOrg.name}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You're viewing this organization as {impersonatedRole === 'client_admin' ? 'Client Admin' : 'Agent'}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={handleReturnToSuperAdmin}
                disabled={isReturning}
                className="border-warning/30 hover:bg-warning/10"
              >
                {isReturning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Returning...
                  </>
                ) : (
                  <>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Return to Super Admin
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabbed Navigation */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6 w-full">
        <TabsList className="grid h-auto gap-1 bg-muted/50 p-1 w-full" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)` }}>
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                className="flex items-center justify-center gap-2 data-[state=active]:bg-background"
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6 w-full">
          {/* Profile Settings */}
          <Card className="glass">
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                <CardTitle>Profile Information</CardTitle>
              </div>
              <CardDescription>Update your personal information and profile picture</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary font-semibold text-2xl">
                    {profile?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Profile Photo</p>
                  <div>
                    <input
                      type="file"
                      id="avatar-upload"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isUploadingPhoto}
                      onClick={() => document.getElementById('avatar-upload')?.click()}
                    >
                      {isUploadingPhoto ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4 mr-2" />
                          Change Photo
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">JPG, PNG or GIF (max 5MB)</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input 
                    id="fullName" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Input id="email" value={profile?.email || ''} disabled className="pr-10" />
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/30">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Member since {accountStats?.memberSince}</p>
                  <p className="text-xs text-muted-foreground">Account created {accountStats?.accountAge} ago</p>
                </div>
              </div>

              <Button 
                onClick={handleSaveProfile} 
                disabled={isSavingProfile || fullName === profile?.full_name}
              >
                {isSavingProfile ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Getting Started / Tour */}
          <Card className="glass">
            <CardHeader>
              <div className="flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-primary" />
                <CardTitle>Getting Started</CardTitle>
              </div>
              <CardDescription>Take a guided tour of the CRM features</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                New to the platform? Take a quick tour to learn about key features like lead management, AI conversations, and more.
              </p>
              <Button onClick={handleReplayTour} variant="outline" className="gap-2">
                <PlayCircle className="w-4 h-4" />
                Start Product Tour
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6 w-full">
          <Card className="glass">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <CardTitle>
                  {orgFeatures?.communications_enabled ? 'Communication Notifications' : 'Notifications'}
                </CardTitle>
              </div>
              <CardDescription>
                Manage your notification preferences for all channels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationSettings />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        {(effectiveIsSuperAdmin || effectiveIsClientAdmin) && (
          <TabsContent value="users" className="space-y-6 w-full">
            <UserManagementTab />
          </TabsContent>
        )}


        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6 w-full">
          {/* Password Change */}
          <Card className="glass">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" />
                <CardTitle>Change Password</CardTitle>
              </div>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input 
                    id="currentPassword" 
                    type={showCurrentPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Input 
                      id="newPassword" 
                      type={showNewPassword ? "text" : "password"} 
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input 
                      id="confirmPassword" 
                      type={showConfirmPassword ? "text" : "password"} 
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Passwords do not match
                </p>
              )}
              <Button 
                variant="outline" 
                onClick={handleChangePassword}
                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Two-Factor Authentication - Admin Only */}
          {(isSuperAdmin || isClientAdmin) && (
            <TwoFactorAuth />
          )}

          {/* Active Sessions */}
          <ActiveSessionsCard />

          {/* Danger Zone */}
          <Card className="glass border-destructive/30">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <CardTitle className="text-destructive">Danger Zone</CardTitle>
              </div>
              <CardDescription>Irreversible and destructive actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                <div>
                  <p className="font-medium">Sign Out Everywhere</p>
                  <p className="text-sm text-muted-foreground">Sign out from all devices and sessions</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Sign out from all devices?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will sign you out from all devices including this one. You will need to sign in again.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleLogoutAllSessions} disabled={isLoggingOutAll}>
                        {isLoggingOutAll ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Signing out...
                          </>
                        ) : (
                          'Sign Out All'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6 w-full">
          {(effectiveIsSuperAdmin || effectiveIsClientAdmin) && (
            <Card className="glass border-primary/30">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>Integration Hub</CardTitle>
                    <CardDescription>Connect core services first, then expand into optional tools</CardDescription>
                  </div>
                  <Badge variant="secondary">Simplified View</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground">Google</p>
                  <p className="font-medium mt-1">{calendarStatus?.connected ? 'Connected' : 'Not connected'}</p>
                </div>
                <div className="rounded-lg border border-border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground">Twilio</p>
                  <p className="font-medium mt-1">{twilioEnabled ? 'Enabled' : 'Disabled'}</p>
                </div>
                <div className="rounded-lg border border-border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground">Social Channels</p>
                  <p className="font-medium mt-1">Manage in section below</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Google Calendar Integration */}
          {(effectiveIsSuperAdmin || effectiveIsClientAdmin) && (
            <Card className="glass border-primary/30">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <CardTitle>Google Integration</CardTitle>
                </div>
                <CardDescription>Connect your Google account for calendar and email features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* OAuth Scopes Disclosure */}
                {!calendarStatus?.connected && !calendarLoading && !isConnecting && (
                  <Collapsible open={showGooglePermissions} onOpenChange={setShowGooglePermissions}>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-between px-2">
                          <span className="flex items-center gap-2 font-medium">
                            <Shield className="w-4 h-4 text-primary" />
                            View Google permissions requested
                          </span>
                          <ChevronDown className={`w-4 h-4 transition-transform ${showGooglePermissions ? 'rotate-180' : ''}`} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2 px-2">
                        <ul className="space-y-2">
                          <li className="flex items-start gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="text-foreground font-medium">View your calendars</span>
                              <p className="text-muted-foreground">To check availability and prevent scheduling conflicts</p>
                            </div>
                          </li>
                          <li className="flex items-start gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="text-foreground font-medium">View and edit events</span>
                              <p className="text-muted-foreground">To create callbacks for qualified leads and sync bookings</p>
                            </div>
                          </li>
                        </ul>
                        <p className="text-xs text-muted-foreground mt-3">
                          Your Google data is encrypted and used only for scheduling and communication with leads.
                          <a href="/terms#google-calendar" target="_blank" className="text-primary hover:underline ml-1">
                            Learn more
                          </a>
                        </p>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}

                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  {calendarLoading || isConnecting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {isConnecting ? 'Connecting to Google...' : 'Checking connection...'}
                      </span>
                    </>
                  ) : calendarStatus?.connected ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <span className="text-foreground">Google account connected</span>
                        <p className="text-sm text-muted-foreground">
                          Calendar and email features are now available
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-5 h-5 text-amber-500" />
                      <div>
                        <p className="text-foreground font-medium">Google account not connected</p>
                        <p className="text-sm text-muted-foreground">{calendarStatus?.message || 'Click Connect to link your Google account'}</p>
                      </div>
                    </>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {calendarStatus?.connected ? (
                    <Button 
                      variant="outline" 
                      disabled={calendarLoading}
                      onClick={handleDisconnectCalendar}
                      className="text-destructive hover:text-destructive"
                    >
                      <Unlink className="w-4 h-4 mr-2" />
                      Disconnect Google
                    </Button>
                  ) : (
                    <Button 
                      disabled={calendarLoading || isConnecting}
                      onClick={handleConnectCalendar}
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Connect to Google
                        </>
                      )}
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    disabled={calendarLoading || isConnecting}
                    onClick={() => checkConnection().then(setCalendarStatus)}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Social Platforms */}
          {(effectiveIsSuperAdmin || effectiveIsClientAdmin) && (
            <Collapsible open={showSocialIntegrations} onOpenChange={setShowSocialIntegrations}>
              <Card className="glass border-primary/30">
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
                      <div className="text-left">
                        <CardTitle className="text-base">Social Channels</CardTitle>
                        <CardDescription>Facebook, Instagram and WhatsApp connections</CardDescription>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showSocialIntegrations ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    <SocialPlatformsTab />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {/* Twilio and API Tools */}
          {(effectiveIsSuperAdmin || effectiveIsClientAdmin) && (
            <Collapsible open={showTwilioSection} onOpenChange={setShowTwilioSection}>
              <Card className="glass border-primary/30">
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
                      <div className="text-left">
                        <CardTitle className="text-base">Twilio and Phone Numbers</CardTitle>
                        <CardDescription>Optional communication setup and number management</CardDescription>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showTwilioSection ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-6">
                    {/* API Integration (Super Admin Only) */}
                    {effectiveIsSuperAdmin && (
                      <Card className="glass border-primary/20">
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Key className="w-5 h-5 text-primary" />
                            <CardTitle>API Integrations</CardTitle>
                          </div>
                          <CardDescription>Configure external service connections</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="twilio">Twilio Account SID</Label>
                              <Input id="twilio" type="password" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="twilioToken">Twilio Auth Token</Label>
                              <Input id="twilioToken" type="password" placeholder="••••••••••••••••" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="twilioPhone">Twilio Phone Number</Label>
                            <Input id="twilioPhone" placeholder="+1234567890" />
                          </div>
                          <Button>Save API Keys</Button>
                        </CardContent>
                      </Card>
                    )}

                    <Card className="glass border-primary/20">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Lock className="w-5 h-5 text-primary" />
                          <CardTitle>Twilio Phone Numbers</CardTitle>
                        </div>
                        <CardDescription>Enable and configure Twilio phone number management for your organization</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Smartphone className="w-5 h-5 text-primary" />
                              <div>
                                <p className="font-medium">Enable Twilio Integration</p>
                                <p className="text-sm text-muted-foreground">Allow users to search and purchase phone numbers</p>
                              </div>
                            </div>
                            <Button
                              variant={twilioEnabled ? 'default' : 'outline'}
                              size="sm"
                              onClick={async () => {
                                try {
                                  const newValue = !twilioEnabled;
                                  const { error } = await supabase
                                    .from('organizations')
                                    .update({ twilio_enabled: newValue })
                                    .eq('id', profile?.organization_id);
                                  if (error) throw error;
                                  setTwilioEnabled(newValue);
                                  toast({
                                    title: newValue ? 'Enabled' : 'Disabled',
                                    description: `Twilio integration ${newValue ? 'enabled' : 'disabled'} for this organization`,
                                  });
                                } catch (err) {
                                  toast({
                                    title: 'Error',
                                    description: err instanceof Error ? err.message : 'Failed to update setting',
                                    variant: 'destructive',
                                  });
                                }
                              }}
                            >
                              {twilioEnabled ? 'Enabled' : 'Disabled'}
                            </Button>
                          </div>
                        </div>

                        {twilioEnabled && (
                          <div className="p-4 rounded-lg bg-primary/5 border border-primary/30 space-y-3">
                            <p className="text-sm text-muted-foreground">
                              Connect your Twilio account to provision subaccounts and manage phone numbers.
                            </p>
                            <Button
                              onClick={() => {
                                const state = btoa(JSON.stringify({ organization_id: profile?.organization_id }));
                                const redirectUrl = `https://oauth.twilio.com/v2/authorize?client_id=OQd0a5857073d609a3fa55396b69787746&response_type=code&scope=offline_access&state=${encodeURIComponent(state)}`;
                                window.location.href = redirectUrl;
                              }}
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Connect Twilio Account
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {twilioEnabled && (
                      <Card className="glass border-primary/20">
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <Smartphone className="w-5 h-5 text-primary" />
                            <CardTitle>Phone Manager</CardTitle>
                          </div>
                          <CardDescription>Manage your organization's Twilio phone number allocation</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {orgPhoneCount === 0 && (
                            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-500" />
                                <span className="font-medium">Claim Your Free Number</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-2">Your organization is eligible for 1 free phone number. Search by area code and claim it with one click.</p>
                            </div>
                          )}

                          {typeof orgPhoneCount === 'number' && orgPhoneCount >= 1 && (
                            <div className="p-4 rounded-lg bg-muted/50 border border-border">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-amber-500" />
                                <span className="font-medium">Free limit reached</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-2">You have used your 1 free number allocation. Contact support to add additional lines.</p>
                            </div>
                          )}

                          <div className="space-y-3">
                            <Label htmlFor="areaCode">Area Code</Label>
                            <div className="flex gap-2">
                              <Input id="areaCode" placeholder="e.g. 415" value={selectedAreaCode} onChange={(e) => setSelectedAreaCode(e.target.value)} />
                              <Button
                                variant="outline"
                                onClick={async () => {
                                  if (!profile?.organization_id) return;
                                  setIsSearchingNumbers(true);
                                  setAvailableNumbers(null);
                                  try {
                                    const { data, error } = await supabase.functions.invoke('search-available-numbers', {
                                      body: { country_code: 'US', area_code: selectedAreaCode },
                                    });
                                    if (error) throw error;
                                    setAvailableNumbers(data?.numbers || []);
                                  } catch (err) {
                                    const msg = err instanceof Error ? err.message : 'Failed to search numbers';
                                    toast({ title: 'Search Failed', description: msg, variant: 'destructive' });
                                  } finally {
                                    setIsSearchingNumbers(false);
                                  }
                                }}
                                disabled={isSearchingNumbers || (typeof orgPhoneCount === 'number' && orgPhoneCount >= 1)}
                                title={orgPhoneCount && orgPhoneCount >= 1 ? 'You have used your 1 free number allocation.' : ''}
                              >
                                {isSearchingNumbers ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Searching...
                                  </>
                                ) : (
                                  <>
                                    <Search className="w-4 h-4 mr-2" />
                                    Search Available Numbers
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>

                          {availableNumbers && availableNumbers.length > 0 && (
                            <div className="space-y-3">
                              <Label>Available Numbers</Label>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {availableNumbers.map((n) => (
                                  <div key={n.phone_number} className="flex items-center justify-between p-3 rounded-lg border border-border">
                                    <div>
                                      <p className="font-medium">{n.friendly_name || n.phone_number}</p>
                                      {n.price_display && (
                                        <p className="text-xs text-muted-foreground">Price: {n.price_display}</p>
                                      )}
                                    </div>
                                    <Button
                                      size="sm"
                                      onClick={async () => {
                                        setIsBuyingNumber(true);
                                        try {
                                          const { data, error } = await supabase.functions.invoke('buy-phone-number', {
                                            body: { phoneNumber: n.phone_number },
                                          });
                                          if (error) throw error;
                                          toast({ title: 'Number Claimed', description: `Successfully claimed ${n.phone_number}` });
                                          setOrgPhoneCount((prev) => (typeof prev === 'number' ? prev + 1 : 1));
                                        } catch (err) {
                                          const msg = err instanceof Error ? err.message : 'Failed to claim number';
                                          toast({ title: 'Purchase Failed', description: msg, variant: 'destructive' });
                                        } finally {
                                          setIsBuyingNumber(false);
                                        }
                                      }}
                                      disabled={isBuyingNumber || (typeof orgPhoneCount === 'number' && orgPhoneCount >= 1)}
                                      title={orgPhoneCount && orgPhoneCount >= 1 ? 'You have used your 1 free number allocation.' : ''}
                                    >
                                      {orgPhoneCount === 0 ? 'Claim Free' : 'Buy'}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}

          {(effectiveIsSuperAdmin || effectiveIsClientAdmin) && (
            <Collapsible open={showAdvancedIntegrationTools} onOpenChange={setShowAdvancedIntegrationTools}>
              <Card className="glass">
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between px-0 hover:bg-transparent">
                      <div className="text-left">
                        <CardTitle className="text-base">Advanced Integration Tools</CardTitle>
                        <CardDescription>Recovery and AI workflow tuning</CardDescription>
                      </div>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showAdvancedIntegrationTools ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-6">
                    {currentOrg?.ai_agent_type === 'jay' && <AgentPriorityConfig />}

                    <Card className="glass border-border/60">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-5 h-5 text-primary" />
                          <CardTitle>Message Recovery</CardTitle>
                        </div>
                        <CardDescription>
                          Recover missing AI and agent messages from Facebook Messenger conversations
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          This tool fetches conversation history from Facebook's API and recovers any messages
                          that weren't saved to our database.
                        </p>

                        {recoveryResult && (
                          <div className={`p-4 rounded-lg ${recoveryResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-destructive/10 border border-destructive/30'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              {recoveryResult.success ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-destructive" />
                              )}
                              <span className="font-medium">
                                {recoveryResult.success ? 'Recovery Complete' : 'Recovery Issues'}
                              </span>
                            </div>
                            {recoveryResult.messages_recovered !== undefined && (
                              <p className="text-sm text-muted-foreground">
                                Recovered {recoveryResult.messages_recovered} messages
                              </p>
                            )}
                            {recoveryResult.errors && recoveryResult.errors.length > 0 && (
                              <ul className="text-sm text-destructive list-disc list-inside mt-2">
                                {recoveryResult.errors.slice(0, 5).map((err, i) => (
                                  <li key={i}>{err}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        <Button
                          onClick={handleRecoverMessages}
                          disabled={isRecoveringMessages}
                        >
                          {isRecoveringMessages ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Recovering Messages...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Recover Missing Messages
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </TabsContent>

        {/* Display Tab */}
        <TabsContent value="display" className="space-y-6 w-full">
          {/* Theme Settings */}
          <Card className="glass">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                <CardTitle>Appearance</CardTitle>
              </div>
              <CardDescription>Customize the look and feel of the app</CardDescription>
            </CardHeader>
            <CardContent>
              <ThemeSwitcher />
            </CardContent>
          </Card>

          {/* PWA Installation Guide */}
          <Card className="glass">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                <CardTitle>Install App</CardTitle>
              </div>
              <CardDescription>Install AlCor Nexus as a standalone app on your device</CardDescription>
            </CardHeader>
            <CardContent>
              <PWAInstallGuide />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deleted" className="space-y-6 w-full">
          <DeletedItemsTab />
        </TabsContent>

        {/* Advanced Tab (Super Admin Only) */}
        <TabsContent value="advanced" className="space-y-6 w-full">
          {/* Message Recovery Tool */}
          {(effectiveIsSuperAdmin || effectiveIsClientAdmin) && (
            <Card className="glass">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-primary" />
                  <CardTitle>Message Recovery</CardTitle>
                </div>
                <CardDescription>
                  Recover missing AI and agent messages from Facebook Messenger conversations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This tool fetches conversation history from Facebook's API and recovers any messages 
                  that weren't saved to our database. Use this if agents are missing context on conversations.
                </p>
                
                {recoveryResult && (
                  <div className={`p-4 rounded-lg ${recoveryResult.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-destructive/10 border border-destructive/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {recoveryResult.success ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-destructive" />
                      )}
                      <span className="font-medium">
                        {recoveryResult.success ? 'Recovery Complete' : 'Recovery Issues'}
                      </span>
                    </div>
                    {recoveryResult.messages_recovered !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        Recovered {recoveryResult.messages_recovered} messages
                      </p>
                    )}
                    {recoveryResult.errors && recoveryResult.errors.length > 0 && (
                      <ul className="text-sm text-destructive mt-2 space-y-1">
                        {recoveryResult.errors.slice(0, 3).map((err, i) => (
                          <li key={i}>• {err}</li>
                        ))}
                        {recoveryResult.errors.length > 3 && (
                          <li>...and {recoveryResult.errors.length - 3} more errors</li>
                        )}
                      </ul>
                    )}
                  </div>
                )}

                <Button 
                  onClick={handleRecoverMessages}
                  disabled={isRecoveringMessages}
                >
                  {isRecoveringMessages ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Recovering Messages...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Recover Missing Messages
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Audit Logs */}
          {effectiveIsSuperAdmin && (
            <AuditLogViewer />
          )}

          {/* Secret Rotation Tracking */}
          {effectiveIsSuperAdmin && (
            <SecretRotationTracker />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Settings() {
  return (
    <ErrorBoundary fullPage>
      <SettingsContent />
    </ErrorBoundary>
  );
}
