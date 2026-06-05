import { useState, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  Building2, 
  Users, 
  Share2, 
  Loader2, 
  CheckCircle2,
  AlertTriangle,
  ArrowLeftRight,
  Undo2,
  Clock,
  Package,
  CalendarDays,
  MessageSquare,
  BookOpen,
  FileText,
  Workflow,
  GraduationCap,
  MessagesSquare,
  Bot,
  UserCog,
  ClipboardList,
  Home,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface AssetItem {
  id: string;
  name: string;
  subtitle?: string;
  status?: string;
}

interface AssetCategory {
  key: string;
  label: string;
  icon: React.ReactNode;
  items: AssetItem[];
  totalCount: number;
  selectedIds: string[];
  selectionMode: 'all' | 'custom';
  relatedTo?: string; // If this category is related to another (e.g., bookings related to leads)
}

interface AssetPreviewCategory {
  key: string;
  label: string;
  relatedTo?: string;
  totalCount: number;
  items: AssetItem[];
}

interface AssetPreviewResponse {
  categories: AssetPreviewCategory[];
}

interface MigrationLog {
  id: string;
  source_organization_id: string;
  target_organization_id: string;
  migrated_leads: string[];
  migrated_platforms: string[];
  migrated_bookings: string[];
  migrated_orders: string[];
  migrated_offerings: string[];
  migrated_room_units: string[];
  migrated_knowledge_entries: string[];
  migrated_knowledge_docs: string[];
  migrated_reports: string[];
  migrated_workflows: string[];
  migrated_calendar_events: string[];
  migrated_communications: string[];
  migrated_message_templates: string[];
  migrated_training_modules: string[];
  migrated_team_chats: string[];
  migrated_ai_conversations: string[];
  migrated_agent_priorities: string[];
  migrated_rubric_templates: string[];
  performed_at: string;
  can_undo_until: string;
  is_undone: boolean;
}

interface ValidationWarning {
  category: string;
  issue: string;
  severity: 'error' | 'warning';
}

interface MigrationValidationResponse {
  warnings: ValidationWarning[];
}

type AssetSelectionPayload =
  | { mode: 'all' }
  | { mode: 'ids'; ids: string[] };

type MigrationStep = 'select' | 'preview' | 'migrating' | 'complete';

export default function AssetMigration() {
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [sourceOrgId, setSourceOrgId] = useState<string>(searchParams.get('from') || '');
  const [targetOrgId, setTargetOrgId] = useState<string>(searchParams.get('to') || '');
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<MigrationStep>('select');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationResults, setMigrationResults] = useState<Record<string, number> | null>(null);

  // Asset categories
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Undo functionality
  const [recentMigration, setRecentMigration] = useState<MigrationLog | null>(null);
  const [undoTimeLeft, setUndoTimeLeft] = useState<number>(0);
  const [undoing, setUndoing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
  const [showValidationDialog, setShowValidationDialog] = useState(false);

  // Truncation tracking
  const [truncatedCategories, setTruncatedCategories] = useState<Record<string, number>>({});

  // Constants
  const PREVIEW_LIMIT = 500;
  const STORAGE_KEY = 'canvascapital_recent_migration';

  const categoryIcons: Record<string, React.ReactNode> = {
    leads: <Users className="w-4 h-4" />,
    platforms: <Share2 className="w-4 h-4" />,
    bookings: <CalendarDays className="w-4 h-4" />,
    orders: <Package className="w-4 h-4" />,
    offerings: <Package className="w-4 h-4" />,
    room_units: <Home className="w-4 h-4" />,
    knowledge_entries: <BookOpen className="w-4 h-4" />,
    knowledge_docs: <FileText className="w-4 h-4" />,
    reports: <ClipboardList className="w-4 h-4" />,
    workflows: <Workflow className="w-4 h-4" />,
    calendar_events: <CalendarDays className="w-4 h-4" />,
    communications: <MessageSquare className="w-4 h-4" />,
    message_templates: <MessageSquare className="w-4 h-4" />,
    training_modules: <GraduationCap className="w-4 h-4" />,
    team_chats: <MessagesSquare className="w-4 h-4" />,
    ai_conversations: <Bot className="w-4 h-4" />,
    agent_priorities: <UserCog className="w-4 h-4" />,
    rubric_templates: <ClipboardList className="w-4 h-4" />,
  };

  useEffect(() => {
    fetchOrganizations();
    // Restore undo state from localStorage
    restoreUndoState();
  }, []);

  useEffect(() => {
    if (!recentMigration || recentMigration.is_undone) return;

    const updateTimeLeft = () => {
      const canUndoUntil = new Date(recentMigration.can_undo_until).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((canUndoUntil - now) / 1000));
      setUndoTimeLeft(remaining);

      if (remaining === 0) {
        setRecentMigration(null);
      }
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [recentMigration]);

  // Persist undo state to localStorage
  useEffect(() => {
    if (recentMigration && !recentMigration.is_undone) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        migration: recentMigration,
        expiresAt: recentMigration.can_undo_until
      }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [recentMigration]);

  // Restore undo state from localStorage on mount
  const restoreUndoState = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { migration, expiresAt } = JSON.parse(stored);
        const expiryTime = new Date(expiresAt).getTime();
        
        if (Date.now() < expiryTime && !migration.is_undone) {
          setRecentMigration(migration);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (e) {
      devError('Failed to restore migration state:', e);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const fetchOrganizations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .eq('is_archived', false)
        .order('name');
      
      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      devError('Error fetching organizations:', error);
      toast({
        title: 'Failed to load organizations',
        description: 'Please refresh the page',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const isCategoryTruncated = (category: AssetCategory) => category.totalCount > category.items.length;

  const getSelectedCount = (category: AssetCategory) => {
    if (category.selectionMode === 'all') {
      return category.totalCount;
    }

    return category.selectedIds.length;
  };

  const getCategorySelectionPayload = (category: AssetCategory): AssetSelectionPayload | null => {
    if (category.selectionMode === 'all') {
      return category.totalCount > 0 ? { mode: 'all' } : null;
    }

    return category.selectedIds.length > 0 ? { mode: 'ids', ids: category.selectedIds } : null;
  };

  const buildSelectedAssets = () => {
    const assets: Record<string, AssetSelectionPayload> = {};

    for (const category of categories) {
      const payload = getCategorySelectionPayload(category);
      if (payload) {
        assets[category.key] = payload;
      }
    }

    return assets;
  };

  const categoryLabelByKey = categories.reduce<Record<string, string>>((accumulator, category) => {
    accumulator[category.key] = category.label;
    return accumulator;
  }, {});

  const loadPreview = async () => {
    if (!sourceOrgId || !targetOrgId) {
      toast({ title: 'Select organizations', description: 'Please select both source and target organizations.', variant: 'destructive' });
      return;
    }

    if (sourceOrgId === targetOrgId) {
      toast({ title: 'Invalid selection', description: 'Source and target organizations must be different.', variant: 'destructive' });
      return;
    }

    setLoadingPreview(true);
    try {
      const { data, error } = await supabase.rpc('get_asset_migration_preview', {
        p_source_org_id: sourceOrgId,
        p_preview_limit: PREVIEW_LIMIT,
      });

      if (error) throw error;

      const preview = (data || { categories: [] }) as AssetPreviewResponse;
      const nextTruncatedCategories: Record<string, number> = {};
      const nextCategories: AssetCategory[] = (preview.categories || []).map((category) => {
        if (category.totalCount > category.items.length) {
          nextTruncatedCategories[category.key] = category.totalCount;
        }

        return {
          key: category.key,
          label: category.label,
          icon: categoryIcons[category.key] || <Package className="w-4 h-4" />,
          items: category.items,
          totalCount: category.totalCount,
          selectedIds: category.items.map((item) => item.id),
          selectionMode: 'all',
          relatedTo: category.relatedTo,
        };
      });

      setTruncatedCategories(nextTruncatedCategories);
      setCategories(nextCategories);
      setStep('preview');
    } catch (error: unknown) {
      devError('Error loading preview:', error);
      const msg = error instanceof Error ? error.message : 'Failed to load assets preview.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setLoadingPreview(false);
    }
  };

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCategorySelection = (key: string, checked: boolean) => {
    setCategories(prev => prev.map(cat => 
      cat.key === key
        ? {
            ...cat,
            selectionMode: checked ? 'all' : 'custom',
            selectedIds: checked ? cat.items.map(i => i.id) : [],
          }
        : cat
    ));
  };

  const toggleItemSelection = (categoryKey: string, itemId: string, checked: boolean) => {
    setCategories(prev => prev.map(cat => {
      if (cat.key !== categoryKey) return cat;

      const baseSelectedIds = cat.selectionMode === 'all' ? cat.items.map(item => item.id) : cat.selectedIds;

      return {
        ...cat,
        selectionMode: 'custom',
        selectedIds: checked
          ? Array.from(new Set([...baseSelectedIds, itemId]))
          : baseSelectedIds.filter(id => id !== itemId),
      };
    }));
  };

  const getTotalSelected = () => categories.reduce((sum, cat) => sum + getSelectedCount(cat), 0);

  // Validation function for migration plan
  const validateMigrationPlan = (): ValidationWarning[] => {
    const warnings: ValidationWarning[] = [];
    
    // Check for orphaned relationships
    categories.forEach(cat => {
      if (cat.relatedTo && getSelectedCount(cat) > 0) {
        const parent = categories.find(c => c.key === cat.relatedTo);
        
        if (!parent || getSelectedCount(parent) === 0) {
          warnings.push({
            category: cat.label,
            issue: `Selected ${getSelectedCount(cat)} ${cat.label.toLowerCase()} but no ${parent?.label.toLowerCase() || cat.relatedTo} are selected. This will create orphaned records with broken references.`,
            severity: 'error'
          });
        }
      }

      if (isCategoryTruncated(cat) && cat.selectionMode === 'custom' && cat.selectedIds.length > 0) {
        warnings.push({
          category: cat.label,
          issue: `This category contains ${cat.totalCount} records, but only ${cat.items.length} are loaded in the preview. Custom selection will only migrate the previewed records you checked. Use “All” to migrate the entire category.`,
          severity: 'warning'
        });
      }
    });
    
    // Check for large migrations (potential timeout)
    const totalSelected = getTotalSelected();
    if (totalSelected > 1000) {
      warnings.push({
        category: 'Performance',
        issue: `Migrating ${totalSelected.toLocaleString()} assets may take several minutes.`,
        severity: 'warning'
      });
    }
    
    return warnings;
  };

  const handleMigrateClick = async () => {
    if (getTotalSelected() === 0) {
      toast({ title: 'No assets selected', description: 'Please select at least one asset to migrate.', variant: 'destructive' });
      return;
    }

    const assets = buildSelectedAssets();
    const warnings = [...validateMigrationPlan()];

    try {
      const { data, error } = await supabase.rpc('validate_asset_migration_plan', {
        p_source_org_id: sourceOrgId,
        p_assets: assets,
      });

      if (error) throw error;

      const response = (data || { warnings: [] }) as MigrationValidationResponse;
      warnings.push(...(response.warnings || []));
    } catch (error) {
      devError('Failed to validate migration plan:', error);
      toast({
        title: 'Validation failed',
        description: 'Unable to verify migration dependencies. Please try again.',
        variant: 'destructive'
      });
      return;
    }

    const errors = warnings.filter(w => w.severity === 'error');
    
    if (errors.length > 0 || warnings.length > 0) {
      setValidationWarnings(warnings);
      setShowValidationDialog(true);
      return;
    }
    
    // No issues - proceed to confirmation
    setShowConfirmDialog(true);
  };

  const executeMigration = async () => {
    setShowConfirmDialog(false);
    setMigrating(true);
    setStep('migrating');

    try {
      const assets = buildSelectedAssets();

      // Call edge function for cross-org migration
      const { data, error } = await supabase.functions.invoke('migrate-assets', {
        body: {
          sourceOrgId,
          targetOrgId,
          assets,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data?.migrationLog) {
        setRecentMigration(data.migrationLog as MigrationLog);
      }

      const results: Record<string, number> = {};
      for (const [key, count] of Object.entries((data?.results || {}) as Record<string, number>)) {
        const label = categoryLabelByKey[key] || key;
        results[label] = count;
      }

      if (Object.keys(results).length === 0) {
        for (const cat of categories) {
          const selectedCount = getSelectedCount(cat);
          if (selectedCount > 0) {
            results[cat.label] = selectedCount;
          }
        }
      }

      setMigrationResults(results);
      setStep('complete');

      const totalMigrated = Object.values(results).reduce((sum, count) => sum + count, 0);
      toast({ title: 'Migration complete', description: `Migrated ${totalMigrated} assets. You have 60 seconds to undo.` });
    } catch (error: unknown) {
      devError('Migration error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({ title: 'Migration failed', description: message, variant: 'destructive' });
      setStep('preview');
    } finally {
      setMigrating(false);
    }
  };

  const undoMigration = async () => {
    if (!recentMigration || undoTimeLeft === 0) return;

    // Immediately reset UI
    setStep('select');
    setUndoing(true);
    
    try {
      // Call edge function for undo
      const { data, error } = await supabase.functions.invoke('undo-migration', {
        body: { migrationId: recentMigration.id },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setRecentMigration(null);
      toast({ title: 'Migration undone ✅', description: 'All assets have been reverted to the source organization.', duration: 5000 });
    } catch (error: unknown) {
      devError('Undo error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({ title: 'Undo failed', description: message, variant: 'destructive' });
      setStep('complete'); // Revert back if undo failed
    } finally {
      setUndoing(false);
    }
  };

  const resetMigration = () => {
    setStep('select');
    setSourceOrgId('');
    setTargetOrgId('');
    setCategories([]);
    setExpandedCategories(new Set());
    setMigrationResults(null);
  };

  const sourceOrg = organizations.find(o => o.id === sourceOrgId);
  const targetOrg = organizations.find(o => o.id === targetOrgId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Asset Migration</h1>
        <p className="text-muted-foreground mt-1">Transfer all organization assets between organizations</p>
      </div>

      {/* Undo Banner */}
      <AnimatePresence>
        {recentMigration && undoTimeLeft > 0 && !recentMigration.is_undone && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Card className="border-warning bg-warning/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-warning" />
                    <div>
                      <p className="font-medium text-foreground">Migration can be undone</p>
                      <p className="text-sm text-muted-foreground">{undoTimeLeft} seconds remaining</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={undoMigration} disabled={undoing} className="border-warning text-warning hover:bg-warning/20">
                    {undoing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Undo2 className="w-4 h-4 mr-2" />}
                    Undo Migration
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {['select', 'preview', 'migrating', 'complete'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              step === s ? 'bg-primary text-primary-foreground' : 
              ['select', 'preview', 'migrating', 'complete'].indexOf(step) > i ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {['select', 'preview', 'migrating', 'complete'].indexOf(step) > i ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            {i < 3 && <div className="w-8 h-0.5 bg-border" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 'select' && (
          <motion.div key="select" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Card className="glass">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ArrowLeftRight className="w-5 h-5" />Select Organizations</CardTitle>
                <CardDescription>Choose the source and target organizations for the migration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Source Organization</label>
                    <Select value={sourceOrgId} onValueChange={setSourceOrgId}>
                      <SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger>
                      <SelectContent>
                        {organizations.map(org => (
                          <SelectItem key={org.id} value={org.id} disabled={org.id === targetOrgId}>{org.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-center py-4"><ArrowRight className="w-6 h-6 text-muted-foreground" /></div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Target Organization</label>
                    <Select value={targetOrgId} onValueChange={setTargetOrgId}>
                      <SelectTrigger><SelectValue placeholder="Select target..." /></SelectTrigger>
                      <SelectContent>
                        {organizations.map(org => (
                          <SelectItem key={org.id} value={org.id} disabled={org.id === sourceOrgId}>{org.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={loadPreview} disabled={!sourceOrgId || !targetOrgId || loadingPreview}>
                    {loadingPreview && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Preview Migration
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'preview' && (
          <motion.div key="preview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
            <Card className="glass border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" /><span className="font-medium">{sourceOrg?.name}</span></div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-success" /><span className="font-medium">{targetOrg?.name}</span></div>
                </div>
              </CardContent>
            </Card>

            {/* Asset Categories */}
            <div className="space-y-3">
              {Object.keys(truncatedCategories).length > 0 && (
                <Card className="border-warning/40 bg-warning/5">
                  <CardContent className="p-4 text-sm text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Some categories are preview-limited.</p>
                    <p>Choosing “All” on a preview-limited category migrates every matching record, not just the rows shown here.</p>
                    <p>If you switch that category to a custom selection, only the previewed records remain eligible for migration.</p>
                  </CardContent>
                </Card>
              )}

              {categories.map(cat => (
                <Card key={cat.key} className="glass">
                  <Collapsible open={expandedCategories.has(cat.key)} onOpenChange={() => toggleCategory(cat.key)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CollapsibleTrigger className="flex items-center gap-2 hover:text-primary transition-colors">
                          {cat.icon}
                          <CardTitle className="text-base">{cat.label} ({cat.totalCount})</CardTitle>
                          {expandedCategories.has(cat.key) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </CollapsibleTrigger>
                        <div className="flex items-center gap-3">
                          <Badge variant={getSelectedCount(cat) === cat.totalCount ? 'default' : 'secondary'}>
                            {getSelectedCount(cat)} selected
                          </Badge>
                          {isCategoryTruncated(cat) && (
                            <Badge variant="secondary" className="text-xs border-warning text-warning">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Previewing {cat.items.length} of {truncatedCategories[cat.key]}
                            </Badge>
                          )}
                          <div className="flex items-center gap-2">
                            <Checkbox
                              aria-label={`Select all ${cat.label}`}
                              checked={getSelectedCount(cat) === cat.totalCount && cat.totalCount > 0}
                              onCheckedChange={(checked) => toggleCategorySelection(cat.key, !!checked)}
                            />
                            <label className="text-sm">All</label>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="space-y-2 max-h-[250px] overflow-y-auto">
                          {cat.items.map(item => (
                            <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                              <Checkbox
                                aria-label={`Select ${item.name} in ${cat.label}`}
                                checked={cat.selectionMode === 'all' ? true : cat.selectedIds.includes(item.id)}
                                onCheckedChange={(checked) => toggleItemSelection(cat.key, item.id, !!checked)}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate text-sm">{item.name}</p>
                                {item.subtitle && <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>}
                              </div>
                              {item.status && <Badge variant="outline" className="text-xs">{item.status}</Badge>}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep('select')}>Back</Button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{getTotalSelected()} assets selected</span>
                <Button onClick={handleMigrateClick} disabled={getTotalSelected() === 0}>Migrate Assets</Button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'migrating' && (
          <motion.div key="migrating" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Card className="glass">
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  <div className="text-center">
                    <p className="text-lg font-medium">Migrating assets...</p>
                    <p className="text-muted-foreground">Moving {getTotalSelected()} assets</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 'complete' && migrationResults && (
          <motion.div key="complete" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Card className="glass border-success/30">
              <CardContent className="py-8">
                <div className="flex flex-col items-center gap-4">
                  <CheckCircle2 className="w-12 h-12 text-success" />
                  <div className="text-center">
                    <p className="text-lg font-medium">Migration Complete!</p>
                    <div className="mt-4 space-y-1">
                      {Object.entries(migrationResults).map(([key, count]) => (
                        <p key={key} className="text-sm text-muted-foreground">{key}: {count} migrated</p>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" onClick={resetMigration} className="mt-4">Start New Migration</Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Validation Dialog */}
      <AlertDialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Migration Validation Issues
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>The following issues were detected in your migration plan:</p>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {validationWarnings.map((warning, idx) => (
                  <Card key={idx} className={warning.severity === 'error' ? 'border-destructive' : 'border-warning'}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        {warning.severity === 'error' ? (
                          <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{warning.category}</p>
                          <p className="text-sm text-muted-foreground">{warning.issue}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {validationWarnings.some(w => w.severity === 'error') && (
                <p className="text-destructive font-medium text-sm">
                  ❌ Migration blocked: Please fix the errors above before proceeding.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back</AlertDialogCancel>
            {!validationWarnings.some(w => w.severity === 'error') && (
              <AlertDialogAction 
                onClick={() => {
                  setShowValidationDialog(false);
                  setShowConfirmDialog(true);
                }}
                className="bg-warning text-warning-foreground hover:bg-warning/90"
              >
                Proceed Anyway
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Confirm Asset Migration
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>You are about to migrate assets from <strong>{sourceOrg?.name}</strong> to <strong>{targetOrg?.name}</strong>.</p>
              <div className="bg-muted p-3 rounded-lg space-y-1 max-h-[200px] overflow-y-auto">
                {categories.filter(c => c.selectedIds.length > 0).map(cat => (
                  <p key={cat.key} className="text-sm"><strong>{cat.label}:</strong> {cat.selectedIds.length}</p>
                ))}
              </div>
              <p className="text-warning font-medium">This will transfer ownership of {getTotalSelected()} assets. You will have 60 seconds to undo.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeMigration} className="bg-warning text-warning-foreground hover:bg-warning/90">
              Confirm Migration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}