import { useEffect, useState } from 'react';
import { devError } from '@/lib/logger';
import {
  ResponsiveDialog,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/shared/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  AGENT_SUB_ROLE_OPTIONS,
  MEMBER_ROLE_OPTIONS,
  useOrganizationMemberAssignment,
  type AvailableOrganizationUser,
} from '@/hooks/useOrganizationMemberAssignment';
import { Loader2, Building2, UserPlus, ChevronRight, Bot, Languages, X, Plus, Coins, Phone, Share2, Search, User } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { COUNTRY_PHONE_OPTIONS, getPhoneFormattingHint } from '@/lib/phone';

interface AddOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrganizationAdded: (org: unknown) => void;
}

const aiAgentOptions = [
  { value: 'jay', label: 'Jay', description: 'Sales Agent - Qualifies leads and hands off to human agents' },
  { value: 'may', label: 'May', description: 'Front Desk - Takes food orders and schedules pickups' },
  { value: 'cece', label: 'Cece', description: 'Concierge - Handles hotel/airbnb bookings and availability' },
];

const currencyOptions = [
  { value: 'PHP', label: 'Philippine Peso (₱)', symbol: '₱' },
  { value: 'USD', label: 'US Dollar ($)', symbol: '$' },
  { value: 'EUR', label: 'Euro (€)', symbol: '€' },
  { value: 'GBP', label: 'British Pound (£)', symbol: '£' },
  { value: 'JPY', label: 'Japanese Yen (¥)', symbol: '¥' },
  { value: 'AUD', label: 'Australian Dollar (A$)', symbol: 'A$' },
  { value: 'CAD', label: 'Canadian Dollar (C$)', symbol: 'C$' },
  { value: 'SGD', label: 'Singapore Dollar (S$)', symbol: 'S$' },
  { value: 'HKD', label: 'Hong Kong Dollar (HK$)', symbol: 'HK$' },
  { value: 'CNY', label: 'Chinese Yuan (¥)', symbol: '¥' },
  { value: 'KRW', label: 'South Korean Won (₩)', symbol: '₩' },
  { value: 'THB', label: 'Thai Baht (฿)', symbol: '฿' },
  { value: 'MYR', label: 'Malaysian Ringgit (RM)', symbol: 'RM' },
  { value: 'IDR', label: 'Indonesian Rupiah (Rp)', symbol: 'Rp' },
  { value: 'VND', label: 'Vietnamese Dong (₫)', symbol: '₫' },
];

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

const languageOptions = [
  { value: 'en', label: 'English' },
  { value: 'tl', label: 'Tagalog' },
  { value: 'ceb', label: 'Cebuano/Bisaya' },
  { value: 'ilo', label: 'Ilocano' },
  { value: 'es', label: 'Spanish' },
  { value: 'zh', label: 'Chinese (Mandarin)' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'de', label: 'German' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'it', label: 'Italian' },
  { value: 'other', label: 'Other...' },
];

export function AddOrganizationDialog({ open, onOpenChange, onOrganizationAdded }: AddOrganizationDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'org' | 'member'>('org');
  const [addMember, setAddMember] = useState(true);
  const [orgData, setOrgData] = useState({
    name: '',
    slug: '',
    ai_agent_type: 'jay' as 'jay' | 'may' | 'cece',
    currency_code: 'PHP',
    default_country_code: '+63',
    timezone: 'Asia/Manila',
    workflows_enabled: false,
    training_enabled: false,
    social_feed_enabled: false,
    communications_enabled: false,
  });
  const [allowedLanguages, setAllowedLanguages] = useState<string[]>(['en', 'tl', 'ceb']);
  const [customLanguageInputs, setCustomLanguageInputs] = useState<Record<number, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [availableUsers, setAvailableUsers] = useState<AvailableOrganizationUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AvailableOrganizationUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<'client_admin' | 'agent'>('agent');
  const [selectedSubRole, setSelectedSubRole] = useState('Sales');
  const [customSubRole, setCustomSubRole] = useState('');
  const { toast } = useToast();
  const { assignMemberToOrganization, fetchAvailableUsers, isAssigningMember, isLoadingUsers } = useOrganizationMemberAssignment();

  useEffect(() => {
    if (open && step === 'member') {
      void loadAvailableUsers();
    }
  }, [open, step]);

  const filteredUsers = availableUsers.filter((user) =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const loadAvailableUsers = async () => {
    try {
      const users = await fetchAvailableUsers();
      setAvailableUsers(users);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load available members',
        variant: 'destructive',
      });
    }
  };

  const handleOrgChange = (field: string, value: string) => {
    setOrgData((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'name' ? { slug: generateSlug(value) } : {}),
    }));
  };

  const handleLanguageChange = (index: number, value: string) => {
    const newLanguages = [...allowedLanguages];

    if (value === 'other') {
      setCustomLanguageInputs((prev) => ({ ...prev, [index]: '' }));
      newLanguages[index] = '';
    } else if (value === '') {
      newLanguages.splice(index, 1);
      setCustomLanguageInputs((prev) => {
        const updated = { ...prev };
        delete updated[index];
        return updated;
      });
    } else {
      newLanguages[index] = value;
      setCustomLanguageInputs((prev) => {
        const updated = { ...prev };
        delete updated[index];
        return updated;
      });
    }

    setAllowedLanguages(newLanguages);
  };

  const handleCustomLanguageInput = (index: number, value: string) => {
    setCustomLanguageInputs((prev) => ({ ...prev, [index]: value }));
    const newLanguages = [...allowedLanguages];
    newLanguages[index] = value.trim() ? `custom:${value.trim().toLowerCase()}` : '';
    setAllowedLanguages(newLanguages);
  };

  const addLanguageSlot = () => {
    if (allowedLanguages.length < 3) {
      setAllowedLanguages([...allowedLanguages, '']);
    }
  };

  const removeLanguage = (index: number) => {
    if (index === 0) return;

    const newLanguages = allowedLanguages.filter((_, i) => i !== index);
    setAllowedLanguages(newLanguages);
    setCustomLanguageInputs((prev) => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step === 'org') {
      if (!orgData.name.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Organization name is required',
          variant: 'destructive',
        });
        return;
      }

      if (addMember) {
        setStep('member');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const validLanguages = allowedLanguages.filter((language) => language && language.trim());

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: orgData.name.trim(),
          slug: orgData.slug || generateSlug(orgData.name),
          agent_assignment_method: 'round_robin',
          ai_agent_type: orgData.ai_agent_type,
          currency_code: orgData.currency_code,
          default_country_code: orgData.default_country_code,
          timezone: orgData.timezone,
          workflows_enabled: orgData.workflows_enabled,
          training_enabled: orgData.training_enabled,
          social_feed_enabled: orgData.social_feed_enabled,
          communications_enabled: orgData.communications_enabled,
          allowed_languages: validLanguages.length > 0 ? validLanguages : ['en'],
          language_lock_enabled: true,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      if (addMember && selectedUser) {
        const subRole = selectedRole === 'agent'
          ? selectedSubRole === 'Others'
            ? customSubRole.trim()
            : selectedSubRole
          : undefined;

        await assignMemberToOrganization({
          userId: selectedUser.id,
          organizationId: org.id,
          role: selectedRole,
          subRole,
        });
      }

      toast({
        title: 'Organization Created',
        description: `${orgData.name} has been created successfully`,
      });

      onOrganizationAdded(org);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      devError('Error creating organization:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create organization',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep('org');
    setAddMember(true);
    setOrgData({
      name: '',
      slug: '',
      ai_agent_type: 'jay',
      currency_code: 'PHP',
      default_country_code: '+63',
      timezone: 'Asia/Manila',
      workflows_enabled: false,
      training_enabled: false,
      social_feed_enabled: false,
      communications_enabled: false,
    });
    setAllowedLanguages(['en']);
    setCustomLanguageInputs({});
    setSearchTerm('');
    setAvailableUsers([]);
    setSelectedUser(null);
    setSelectedRole('agent');
    setSelectedSubRole('Sales');
    setCustomSubRole('');
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleClose}
      maxWidth="sm:max-w-[550px]"
      maxHeight="max-h-[75vh]"
      showCloseButton={false}
    >
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          {step === 'org' ? (
            <>
              <Building2 className="w-5 h-5 text-primary" />
              Add New Organization
            </>
          ) : (
            <>
              <UserPlus className="w-5 h-5 text-primary" />
              Add Members
            </>
          )}
        </ResponsiveDialogTitle>
      </ResponsiveDialogHeader>

      <ResponsiveDialogBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 'org' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name *</Label>
                <Input
                  id="org-name"
                  placeholder="Enter organization name"
                  value={orgData.name}
                  onChange={(e) => handleOrgChange('name', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-slug">Slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">/</span>
                  <Input
                    id="org-slug"
                    placeholder="organization-slug"
                    value={orgData.slug}
                    onChange={(e) => setOrgData((prev) => ({ ...prev, slug: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Used in URLs and as a unique identifier
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-agent">AI Agent *</Label>
                <Select
                  value={orgData.ai_agent_type}
                  onValueChange={(value: 'jay' | 'may' | 'cece') => setOrgData((prev) => ({ ...prev, ai_agent_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select AI agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {aiAgentOptions.map((agent) => (
                      <SelectItem key={agent.value} value={agent.value}>
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4" />
                          <div>
                            <span className="font-medium">{agent.label}</span>
                            <span className="text-muted-foreground ml-2 text-xs">- {agent.description}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose which AI will handle conversations for this organization
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency" className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-muted-foreground" />
                  Currency *
                </Label>
                <Select
                  value={orgData.currency_code}
                  onValueChange={(value) => setOrgData((prev) => ({ ...prev, currency_code: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyOptions.map((currency) => (
                      <SelectItem key={currency.value} value={currency.value}>
                        <span className="font-medium">{currency.symbol}</span>
                        <span className="text-muted-foreground ml-2">{currency.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Default currency for offerings, orders, room units, and reporting
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country-code" className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  Default Country Code *
                </Label>
                <Select
                  value={orgData.default_country_code}
                  onValueChange={(value) => setOrgData((prev) => ({ ...prev, default_country_code: value }))}
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
                  {getPhoneFormattingHint(orgData.default_country_code)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone" className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Timezone *
                </Label>
                <Select
                  value={orgData.timezone}
                  onValueChange={(value) => setOrgData((prev) => ({ ...prev, timezone: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {timezoneOptions.map((timezone) => (
                      <SelectItem key={timezone.value} value={timezone.value}>
                        <span className="mr-2">{timezone.country}</span>
                        <span>{timezone.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Used for availability checking, appointment scheduling, and calendar events
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Languages className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">AI Language Settings</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select up to 3 languages the AI can respond in. English is always the default.
                </p>

                <div className="space-y-2">
                  {allowedLanguages.map((lang, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex-1">
                        {customLanguageInputs[index] !== undefined ? (
                          <Input
                            placeholder="Enter language name (e.g., Tagalog)"
                            value={customLanguageInputs[index]}
                            onChange={(e) => handleCustomLanguageInput(index, e.target.value)}
                            autoFocus
                          />
                        ) : (
                          <Select
                            value={lang || ''}
                            onValueChange={(value) => handleLanguageChange(index, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select language" />
                            </SelectTrigger>
                            <SelectContent>
                              {languageOptions
                                .filter((option) => !allowedLanguages.includes(option.value) || option.value === lang || option.value === 'other')
                                .map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      {index > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLanguage(index)}
                          className="h-9 w-9"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      {index === 0 && (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                  ))}

                  {allowedLanguages.length < 3 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addLanguageSlot}
                      className="w-full mt-2"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Language ({allowedLanguages.length}/3)
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium">Feature Access</Label>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">Workflows</p>
                    <p className="text-xs text-muted-foreground">Enable workflow automation</p>
                  </div>
                  <Switch
                    checked={orgData.workflows_enabled}
                    onCheckedChange={(checked) => setOrgData((prev) => ({ ...prev, workflows_enabled: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">AI Training</p>
                    <p className="text-xs text-muted-foreground">Enable AI training for this organization</p>
                  </div>
                  <Switch
                    checked={orgData.training_enabled}
                    onCheckedChange={(checked) => setOrgData((prev) => ({ ...prev, training_enabled: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-start gap-3">
                    <Share2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Social Feed</p>
                      <p className="text-xs text-muted-foreground">Enable social post drafting, scheduling, ad management, and analytics</p>
                    </div>
                  </div>
                  <Switch
                    checked={orgData.social_feed_enabled}
                    onCheckedChange={(checked) => setOrgData((prev) => ({ ...prev, social_feed_enabled: checked }))}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div>
                  <p className="text-sm font-medium text-foreground">Add members</p>
                  <p className="text-xs text-muted-foreground">Assign an existing user to this organization during setup</p>
                </div>
                <Switch
                  checked={addMember}
                  onCheckedChange={setAddMember}
                />
              </div>
            </>
          ) : (
            <>
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 mb-4">
                <p className="text-sm text-foreground">
                  Adding members to: <span className="font-semibold">{orgData.name}</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label>Select User</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <ScrollArea className="h-[180px] rounded-lg border border-border">
                {isLoadingUsers ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <User className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {searchTerm ? 'No users found' : 'No available users without organization'}
                    </p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => setSelectedUser(user)}
                        className={`w-full p-3 rounded-lg text-left transition-colors ${
                          selectedUser?.id === user.id
                            ? 'bg-primary/20 border border-primary/30'
                            : 'hover:bg-secondary/50'
                        }`}
                      >
                        <p className="font-medium text-foreground text-sm">
                          {user.full_name || 'No name'}
                        </p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {selectedUser && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground">Selected member:</p>
                  <p className="font-medium text-foreground">
                    {selectedUser.full_name || selectedUser.email}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="member-role">Role</Label>
                <Select value={selectedRole} onValueChange={(value: 'client_admin' | 'agent') => setSelectedRole(value)}>
                  <SelectTrigger id="member-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBER_ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div>
                          <p className="font-medium">{role.label}</p>
                          <p className="text-xs text-muted-foreground">{role.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedRole === 'agent' && (
                <div className="space-y-2">
                  <Label htmlFor="member-sub-role">Sub Role</Label>
                  <Select value={selectedSubRole} onValueChange={setSelectedSubRole}>
                    <SelectTrigger id="member-sub-role">
                      <SelectValue placeholder="Select a sub role" />
                    </SelectTrigger>
                    <SelectContent>
                      {AGENT_SUB_ROLE_OPTIONS.map((subRole) => (
                        <SelectItem key={subRole} value={subRole}>
                          {subRole}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedRole === 'agent' && selectedSubRole === 'Others' && (
                <div className="space-y-2">
                  <Label htmlFor="custom-sub-role">Custom Sub Role</Label>
                  <Input
                    id="custom-sub-role"
                    placeholder="Enter sub role"
                    value={customSubRole}
                    onChange={(e) => setCustomSubRole(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          <ResponsiveDialogFooter className="gap-2 flex-row">
            {step === 'member' && (
              <Button type="button" variant="ghost" onClick={() => setStep('org')}>
                Back
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="glow" disabled={isSubmitting || isAssigningMember}>
              {isSubmitting || isAssigningMember ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isSubmitting ? 'Creating...' : 'Assigning member...'}
                </>
              ) : step === 'org' && addMember ? (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  <Building2 className="w-4 h-4 mr-2" />
                  Create Organization
                </>
              )}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogBody>
    </ResponsiveDialog>
  );
}