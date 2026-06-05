import { useState, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_CURRENCIES } from '@/hooks/useMultiCurrency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { COUNTRY_PHONE_OPTIONS, getPhoneFormattingHint } from '@/lib/phone';
import { 
  Building2, 
  ArrowLeft, 
  Save, 
  Loader2, 
  Users,
  Settings,
  Shuffle,
  ListOrdered,
  Eye,
  EyeOff,
  Phone,
  Share2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Organization {
  id: string;
  name: string;
  slug: string;
  agent_assignment_method: 'round_robin' | 'priority' | null;
  agent_shared_access: boolean;
  created_at: string;
  training_enabled?: boolean;
  training_pii_redaction?: boolean;
  training_retention_days?: number;
  workflows_enabled?: boolean;
  social_feed_enabled?: boolean;
  currency_code?: string;
  default_country_code?: string;
  timezone?: string;
}

// Timezone options (grouped by region)
const timezoneOptions = [
  { value: 'Asia/Manila', label: 'Philippines - Manila (GMT+8)', country: '🇵🇭' },
  { value: 'Asia/Tokyo', label: 'Japan - Tokyo (GMT+9)', country: '🇯🇵' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8)', country: '🇸🇬' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (GMT+8)', country: '🇭🇰' },
  { value: 'Asia/Bangkok', label: 'Thailand - Bangkok (GMT+7)', country: '🇹🇭' },
  { value: 'Asia/Jakarta', label: 'Indonesia - Jakarta (GMT+7)', country: '🇮🇩' },
  { value: 'Asia/Kuala_Lumpur', label: 'Malaysia - Kuala Lumpur (GMT+8)', country: '🇲🇾' },
  { value: 'Asia/Seoul', label: 'South Korea - Seoul (GMT+9)', country: '🇰🇷' },
  { value: 'Asia/Shanghai', label: 'China - Shanghai (GMT+8)', country: '🇨🇳' },
  { value: 'Asia/Dubai', label: 'UAE - Dubai (GMT+4)', country: '🇦🇪' },
  { value: 'Australia/Sydney', label: 'Australia - Sydney (GMT+10/+11)', country: '🇦🇺' },
  { value: 'America/New_York', label: 'USA - New York (GMT-5/-4)', country: '🇺🇸' },
  { value: 'America/Los_Angeles', label: 'USA - Los Angeles (GMT-8/-7)', country: '🇺🇸' },
  { value: 'America/Chicago', label: 'USA - Chicago (GMT-6/-5)', country: '🇺🇸' },
  { value: 'America/Toronto', label: 'Canada - Toronto (GMT-5/-4)', country: '🇨🇦' },
  { value: 'Europe/London', label: 'UK - London (GMT+0/+1)', country: '🇬🇧' },
  { value: 'Europe/Paris', label: 'France - Paris (GMT+1/+2)', country: '🇫🇷' },
  { value: 'Europe/Berlin', label: 'Germany - Berlin (GMT+1/+2)', country: '🇩🇪' },
];

interface Member {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

export default function OrganizationSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSuperAdmin, isClientAdmin, profile } = useAuth();
  const { toast } = useToast();
  
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    agent_assignment_method: 'round_robin' as 'round_robin' | 'priority',
    agent_shared_access: true,
    workflows_enabled: false,
    training_enabled: false,
    social_feed_enabled: false,
    training_pii_redaction: false,
    training_retention_days: null as number | null,
    currency_code: 'PHP',
    default_country_code: '+1',
    timezone: 'Asia/Manila',
  });

  // Determine which org to load
  const orgId = id || profile?.organization_id;

  useEffect(() => {
    if (orgId) {
      fetchOrganization();
      fetchMembers();
    }
  }, [orgId]);

  const fetchOrganization = async () => {
    if (!orgId) return;
    
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*, training_enabled, training_pii_redaction, training_retention_days, workflows_enabled, social_feed_enabled, currency_code, default_country_code, timezone')
        .eq('id', orgId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        // Cast to Organization type since migration may not be applied yet
        const org = data as unknown as Organization;
        setOrganization(org);
        setFormData({
          name: org.name,
          slug: org.slug,
          agent_assignment_method: org.agent_assignment_method || 'round_robin',
          agent_shared_access: org.agent_shared_access ?? true,
          workflows_enabled: !!org.workflows_enabled,
          training_enabled: !!org.training_enabled,
          social_feed_enabled: !!org.social_feed_enabled,
          training_pii_redaction: !!org.training_pii_redaction,
          training_retention_days: org.training_retention_days || null,
          currency_code: org.currency_code || 'PHP',
          default_country_code: org.default_country_code || '+1',
          timezone: org.timezone || 'Asia/Manila',
        });
      }
    } catch (error) {
      devError('Error fetching organization:', error);
      toast({
        title: "Error",
        description: "Failed to load organization",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    if (!orgId) return;
    
    try {
      const { data: profiles, error } = await supabase
        .from('profiles_safe')
        .select('id, email, full_name')
        .eq('organization_id', orgId);

      if (error) throw error;

      // Fetch roles for each member
      const membersWithRoles = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id);
          
          const role = roles?.[0]?.role || 'agent';
          return { ...profile, role };
        })
      );

      setMembers(membersWithRoles);
    } catch (error) {
      devError('Error fetching members:', error);
    }
  };

  const handleSave = async () => {
    if (!orgId) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: formData.name,
          slug: formData.slug,
          agent_assignment_method: formData.agent_assignment_method,
          agent_shared_access: formData.agent_shared_access,
          workflows_enabled: formData.workflows_enabled,
          training_enabled: formData.training_enabled,
          social_feed_enabled: formData.social_feed_enabled,
          training_pii_redaction: formData.training_pii_redaction,
          training_retention_days: formData.training_retention_days,
          currency_code: formData.currency_code,
          default_country_code: formData.default_country_code,
          timezone: formData.timezone,
        })
        .eq('id', orgId);

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Organization settings have been updated",
      });

      await queryClient.invalidateQueries({ queryKey: ['organization-currency', orgId] });
      await queryClient.invalidateQueries({ queryKey: ['organization-phone', orgId] });

      setOrganization(prev => prev ? { ...prev, ...formData } : null);
    } catch (error) {
      devError('Error saving organization:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Organization Not Found</h2>
        <p className="text-muted-foreground mb-4">The organization you're looking for doesn't exist.</p>
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  if (!isSuperAdmin && !isClientAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        {isSuperAdmin && (
          <Button variant="ghost" size="icon" onClick={() => navigate('/organizations')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Organization Settings</h1>
          <p className="text-muted-foreground mt-1">{organization.name}</p>
        </div>
      </div>

      {/* General Settings */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <CardTitle>General Settings</CardTitle>
          </div>
          <CardDescription>Basic organization information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">/</span>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency_code}
                onValueChange={(value) => setFormData(prev => ({ ...prev, currency_code: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.name} ({currency.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used for pricing, revenue reporting, and value thresholds across this organization.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="country-code" className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-muted-foreground" />
                Default Country Code
              </Label>
              <Select
                value={formData.default_country_code}
                onValueChange={(value) => setFormData(prev => ({ ...prev, default_country_code: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country code" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_PHONE_OPTIONS.map((country) => (
                    <SelectItem key={country.value} value={country.value}>
                      <span className="mr-2">{country.country}</span>
                      <span>{country.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {getPhoneFormattingHint(formData.default_country_code)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone" className="flex items-center gap-2">
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Timezone
              </Label>
              <Select
                value={formData.timezone}
                onValueChange={(value) => setFormData(prev => ({ ...prev, timezone: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezoneOptions.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      <span className="mr-2">{tz.country}</span>
                      <span>{tz.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used for availability checking, appointment scheduling, and calendar events
              </p>
            </div>
            {isSuperAdmin && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Feature Access</Label>
                  <div className="space-y-3 rounded-lg border border-border/60 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">Workflows</p>
                        <p className="text-xs text-muted-foreground">Enable workflow automation for this organization</p>
                      </div>
                      <Switch
                        checked={formData.workflows_enabled}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, workflows_enabled: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">AI Training</p>
                        <p className="text-xs text-muted-foreground">Enable AI training for this organization</p>
                      </div>
                      <Switch
                        id="training"
                        checked={formData.training_enabled}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, training_enabled: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <Share2 className="w-4 h-4 mt-0.5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Social Feed</p>
                          <p className="text-xs text-muted-foreground">Enable social posting, scheduling, ads, and analytics tools</p>
                        </div>
                      </div>
                      <Switch
                        checked={formData.social_feed_enabled}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, social_feed_enabled: checked }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {formData.training_enabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="pii">PII Redaction</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="pii"
                      checked={formData.training_pii_redaction}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, training_pii_redaction: checked }))}
                    />
                    <span className="text-sm text-muted-foreground">Mask PII in training transcripts</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retention">Retention Period (days)</Label>
                  <Input
                    id="retention"
                    type="number"
                    placeholder="Optional (e.g., 90)"
                    value={formData.training_retention_days || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, training_retention_days: e.target.value ? Number(e.target.value) : null }))}
                  />
                  <span className="text-xs text-muted-foreground">Leave empty for indefinite retention</span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agent Assignment */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <CardTitle>Agent Assignment</CardTitle>
          </div>
          <CardDescription>Configure how leads are assigned to agents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Assignment Method</Label>
            <Select
              value={formData.agent_assignment_method}
              onValueChange={(value: 'round_robin' | 'priority') => 
                setFormData(prev => ({ ...prev, agent_assignment_method: value }))
              }
            >
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="round_robin">
                  <div className="flex items-center gap-2">
                    <Shuffle className="w-4 h-4" />
                    <div>
                      <p className="font-medium">Round Robin</p>
                      <p className="text-xs text-muted-foreground">Distribute leads evenly</p>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="priority">
                  <div className="flex items-center gap-2">
                    <ListOrdered className="w-4 h-4" />
                    <div>
                      <p className="font-medium">Priority Based</p>
                      <p className="text-xs text-muted-foreground">Assign by agent priority</p>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 rounded-lg bg-secondary/50">
            {formData.agent_assignment_method === 'round_robin' ? (
              <div className="flex items-start gap-3">
                <Shuffle className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Round Robin Assignment</p>
                  <p className="text-sm text-muted-foreground">
                    Hot leads will be automatically assigned to the next available agent in rotation.
                    This ensures an even distribution of leads across your team.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <ListOrdered className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Priority Based Assignment</p>
                  <p className="text-sm text-muted-foreground">
                    Hot leads will be assigned to agents based on their priority level.
                    Configure agent priorities in the Agent Priority Config section below.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agent Access Control */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center gap-2">
            {formData.agent_shared_access ? (
              <Eye className="w-5 h-5 text-primary" />
            ) : (
              <EyeOff className="w-5 h-5 text-primary" />
            )}
            <CardTitle>Agent Access Control</CardTitle>
          </div>
          <CardDescription>Control what data agents can see</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
            <div className="space-y-1">
              <p className="font-medium text-foreground">Shared Conversation Access</p>
              <p className="text-sm text-muted-foreground">
                {formData.agent_shared_access 
                  ? "Agents can see all customer conversations in the organization"
                  : "Agents can only see conversations for leads assigned to them"
                }
              </p>
            </div>
            <Switch
              checked={formData.agent_shared_access}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, agent_shared_access: checked }))
              }
            />
          </div>
          
          <div className="p-4 rounded-lg border border-warning/30 bg-warning/10">
            <div className="flex items-start gap-3">
              {formData.agent_shared_access ? (
                <>
                  <Eye className="w-5 h-5 text-warning mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Full Team Visibility</p>
                    <p className="text-sm text-muted-foreground">
                      All agents can view all AI conversations and customer messages. 
                      This is useful for team collaboration and handoffs.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <EyeOff className="w-5 h-5 text-success mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Private Conversations</p>
                    <p className="text-sm text-muted-foreground">
                      Agents can only access conversations for leads they are assigned to.
                      This protects customer privacy between team members.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <CardTitle>Members ({members.length})</CardTitle>
            </div>
          </div>
          <CardDescription>Users in this organization</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No members yet</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      {member.full_name || 'No name'}
                    </p>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      member.role === 'client_admin'
                        ? 'bg-success/20 text-success border-success/30'
                        : 'bg-secondary text-muted-foreground'
                    }
                  >
                    {member.role === 'client_admin' ? 'Admin' : 'Agent'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button variant="glow" onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
